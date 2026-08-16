import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull, Not, In, DataSource } from 'typeorm';
import { Ward } from '../../database/entities/ward.entity';
import { Bed, BedStatus } from '../../database/entities/bed.entity';
import { Admission, AdmissionStatus } from '../../database/entities/admission.entity';
import { BedTransfer } from '../../database/entities/bed-transfer.entity';
import { requireTenantId } from '../../common/utils/tenant.util';

/**
 * Bed-board, census, and short-term reservations.
 *
 * Three concerns kept off `IpdService` because they're cross-cutting:
 *   - real-time wall-board view (wards → beds → occupant)
 *   - management census (occupancy %, ALOS, bed-turnover)
 *   - reservations with TTL (planned admissions + theatre-list holds)
 *
 * Reservations live in `bed.notes` as a JSON envelope (no migration needed):
 *   {"reserved":{"until":"...","by":"...","reason":"..."}}
 * That keeps the bed.status enum honest (RESERVED is a real state) while still
 * letting the service auto-release when the timer expires without a cron.
 */
@Injectable()
export class BedBoardService {
  private readonly logger = new Logger(BedBoardService.name);

  constructor(
    @InjectRepository(Ward) private readonly wardRepo: Repository<Ward>,
    @InjectRepository(Bed) private readonly bedRepo: Repository<Bed>,
    @InjectRepository(Admission) private readonly admissionRepo: Repository<Admission>,
    @InjectRepository(BedTransfer) private readonly transferRepo: Repository<BedTransfer>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Wall-board snapshot. Returns the smallest payload the UI needs to render a
   * coloured grid: ward name → beds[{number, type, status, currentPatient,
   * losHours, expectedDischarge}]. ~1 SQL roundtrip per ward; fine for the
   * 5–30 wards a typical facility has.
   */
  async getBedBoard(facilityId?: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    await this.expirePastReservations(tenantId);

    const wards = await this.wardRepo.find({
      where: {
        ...(facilityId ? { facilityId } : {}),
        tenantId: tid,
      },
      order: { name: 'ASC' },
    });
    if (!wards.length) return [];

    const wardIds = wards.map((w) => w.id);
    const beds = await this.bedRepo.find({
      where: { wardId: In(wardIds), tenantId: tid },
      order: { bedNumber: 'ASC' },
    });

    const liveAdmissions = await this.admissionRepo.find({
      where: {
        bedId: In(beds.map((b) => b.id)),
        status: AdmissionStatus.ADMITTED,
        tenantId: tid,
      },
      relations: ['patient', 'attendingDoctor'],
    });
    const byBed = new Map(liveAdmissions.map((a) => [a.bedId, a]));

    return wards.map((ward) => {
      const wardBeds = beds.filter((b) => b.wardId === ward.id);
      return {
        ward: {
          id: ward.id,
          name: ward.name,
          code: ward.code || '',
          totalBeds: wardBeds.length,
          occupied: wardBeds.filter((b) => b.status === BedStatus.OCCUPIED).length,
          available: wardBeds.filter((b) => b.status === BedStatus.AVAILABLE).length,
          reserved: wardBeds.filter((b) => b.status === BedStatus.RESERVED).length,
          maintenance: wardBeds.filter(
            (b) => b.status === BedStatus.MAINTENANCE || b.status === BedStatus.CLEANING,
          ).length,
        },
        beds: wardBeds.map((bed) => {
          const adm = byBed.get(bed.id);
          const reservation = this.parseReservation(bed.notes);
          return {
            id: bed.id,
            number: bed.bedNumber,
            type: bed.type,
            status: bed.status,
            dailyRate: Number(bed.dailyRate || 0),
            reservation,
            currentPatient: adm
              ? {
                  admissionId: adm.id,
                  patientId: adm.patientId,
                  name: adm.patient?.fullName,
                  mrn: adm.patient?.mrn,
                  admittedAt: adm.admissionDate,
                  losHours: this.hoursBetween(adm.admissionDate, new Date()),
                  attendingDoctor: adm.attendingDoctor?.fullName ?? null,
                }
              : null,
          };
        }),
      };
    });
  }

  /**
   * Census aggregates for a date range. ALOS and turnover are computed off
   * discharged admissions in the window; daily census lists the average daily
   * occupancy per ward (admitted-on-day / total-beds).
   */
  async getCensus(facilityId: string, dateFrom: string, dateTo: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);

    const wards = await this.wardRepo.find({
      where: {
        ...(facilityId ? { facilityId } : {}),
        tenantId: tid,
      },
    });
    const totalBeds = await this.bedRepo.count({
      where: {
        ward: { facilityId, tenantId: tid } as any,
        tenantId: tid,
      },
    });

    // Discharges within window — used for ALOS + turnover
    const discharges = await this.admissionRepo.find({
      where: {
        status: In([
          AdmissionStatus.DISCHARGED,
          AdmissionStatus.DECEASED,
          AdmissionStatus.ABSCONDED,
        ]),
        dischargeDate: Between(start, end),
        tenantId: tid,
      },
      select: ['id', 'admissionDate', 'dischargeDate', 'wardId'],
    });

    const totalLosHours = discharges.reduce(
      (acc, a) => acc + this.hoursBetween(a.admissionDate, a.dischargeDate),
      0,
    );
    const alosDays = discharges.length ? totalLosHours / 24 / discharges.length : 0;

    // Daily occupancy snapshot. We approximate by counting admissions that
    // *overlap* each midnight in the range; cheaper than building a calendar
    // table and accurate to the nearest day (which is what census reports want).
    const overlapping = await this.admissionRepo.find({
      where: [
        {
          admissionDate: Between(new Date(0), end) as any,
          dischargeDate: IsNull() as any,
          tenantId: tid,
        },
        {
          admissionDate: Between(new Date(0), end) as any,
          dischargeDate: Between(start, new Date('9999-12-31')) as any,
          tenantId: tid,
        },
      ],
      select: ['id', 'admissionDate', 'dischargeDate', 'wardId'],
    });

    const days: { date: string; occupied: number; occupancyPct: number }[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const midnight = new Date(d);
      midnight.setHours(12, 0, 0, 0); // mid-day census standard
      const occupied = overlapping.filter(
        (a) =>
          new Date(a.admissionDate) <= midnight &&
          (!a.dischargeDate || new Date(a.dischargeDate) >= midnight),
      ).length;
      days.push({
        date: midnight.toISOString().slice(0, 10),
        occupied,
        occupancyPct: totalBeds ? Math.round((occupied / totalBeds) * 1000) / 10 : 0,
      });
    }

    const avgDaily = days.length ? days.reduce((a, d) => a + d.occupied, 0) / days.length : 0;

    return {
      window: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
      totalBeds,
      wardCount: wards.length,
      discharges: discharges.length,
      alosDays: Math.round(alosDays * 10) / 10,
      avgDailyCensus: Math.round(avgDaily * 10) / 10,
      avgOccupancyPct: totalBeds ? Math.round((avgDaily / totalBeds) * 1000) / 10 : 0,
      bedTurnover: totalBeds ? Math.round((discharges.length / totalBeds) * 100) / 100 : 0,
      daily: days,
    };
  }

  /**
   * Reserve a bed for a planned admission. Sets status=RESERVED and stores the
   * envelope in bed.notes. Default hold = 4h; max 72h to stop dead reservations.
   */
  async reserveBed(
    bedId: string,
    holdHours: number,
    reason: string,
    userId: string,
    tenantId?: string,
  ): Promise<Bed> {
    const tid = requireTenantId(tenantId);
    return this.dataSource.transaction(async (manager) => {
      // Lock: a concurrent admission also locks the bed row, so reserve
      // cannot clobber a just-occupied bed
      const bed = await manager.findOne(Bed, {
        where: { id: bedId, tenantId: tid },
        lock: { mode: 'pessimistic_write' },
      });
      if (!bed) throw new NotFoundException('Bed not found');
      if (bed.status !== BedStatus.AVAILABLE) {
        throw new BadRequestException(`Bed is ${bed.status}; only AVAILABLE beds can be reserved`);
      }
      const hours = Math.min(Math.max(holdHours || 4, 1), 72);
      const until = new Date(Date.now() + hours * 3600 * 1000);
      bed.status = BedStatus.RESERVED;
      bed.notes = JSON.stringify({
        reserved: { until: until.toISOString(), by: userId, reason: reason || '' },
      });
      return manager.save(bed);
    });
  }

  async releaseReservation(bedId: string, tenantId?: string): Promise<Bed> {
    const tid = requireTenantId(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const bed = await manager.findOne(Bed, {
        where: { id: bedId, tenantId: tid },
        lock: { mode: 'pessimistic_write' },
      });
      if (!bed) throw new NotFoundException('Bed not found');
      if (bed.status !== BedStatus.RESERVED) {
        throw new BadRequestException('Bed is not reserved');
      }
      bed.status = BedStatus.AVAILABLE;
      bed.notes = '';
      return manager.save(bed);
    });
  }

  /**
   * Build the bed-day line items for an admission so a discharge invoice can
   * be created. Walks BedTransfer history; each segment becomes one line
   * (ward + bed + nights × dailyRate). Partial-day rules: any portion of a
   * day after midnight bills as a full day (industry standard).
   */
  async computeBedDayCharges(admissionId: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const admission = await this.admissionRepo.findOne({
      where: { id: admissionId, tenantId: tid },
      relations: ['bed', 'ward'],
    });
    if (!admission) throw new NotFoundException('Admission not found');

    // If the first night was already billed at admission time (priced
    // "Bed Charge (first night)" line), exclude one day here so the
    // discharge invoice doesn't bill it again.
    const preBilled = await this.admissionRepo.query(
      `SELECT 1
         FROM invoice_items ii
         JOIN invoices i ON i.id = ii.invoice_id
        WHERE ii.reference_type = 'admission'
          AND ii.reference_id = $1
          AND ii.unit_price > 0
          AND i.tenant_id = $2
          AND i.status NOT IN ('cancelled', 'written_off')
        LIMIT 1`,
      [admissionId, tid],
    );
    let daysAlreadyBilled = preBilled.length > 0 ? 1 : 0;

    const transfers = await this.transferRepo.find({
      where: { admissionId, tenantId: tid },
      relations: ['fromBed', 'fromWard', 'toBed', 'toWard'],
      order: { transferTime: 'ASC' },
    });

    const end = admission.dischargeDate ? new Date(admission.dischargeDate) : new Date();
    const segments: Array<{
      bed: Bed | undefined;
      ward: Ward | undefined;
      from: Date;
      to: Date;
    }> = [];
    let cursor = new Date(admission.admissionDate);
    // The stay STARTS in the bed the patient was admitted to — which is not
    // admission.bed once a transfer has happened, because the transfer moves
    // admission.bedId to the new bed. Taking admission.bed here priced the
    // whole pre-transfer stay at the post-transfer bed's rate: a patient moved
    // from a general bed to ICU was billed the ICU rate for both segments.
    // The first transfer's fromBed is the bed the admission actually began in.
    let curBed: Bed | undefined = transfers[0]?.fromBed ?? admission.bed;
    let curWard: Ward | undefined = transfers[0]?.fromWard ?? admission.ward;

    // walk transfers — each transfer closes the current segment
    for (const t of transfers) {
      const at = new Date(t.transferTime);
      segments.push({ bed: curBed, ward: curWard, from: cursor, to: at });
      cursor = at;
      curBed = t.toBed;
      curWard = t.toWard;
    }
    segments.push({ bed: curBed, ward: curWard, from: cursor, to: end });

    const billable = segments.filter((s) => s.bed && s.to > s.from);

    // Days are counted for the STAY and then split across the beds occupied,
    // rather than rounded up per segment. Rounding each segment up made every
    // transfer manufacture a billable day: admitted 08:00, moved to ICU at
    // 14:00, moved back at 20:00, discharged 10:00 the next morning is 26
    // hours, but billed as three full days — one of them at the ICU rate.
    const segmentHours = billable.map((s) => Math.max(0, this.hoursBetween(s.from, s.to)));
    const totalHours = segmentHours.reduce((sum, h) => sum + h, 0);
    const totalDays = Math.max(1, Math.ceil(totalHours / 24));

    // Apportion by time spent, largest-remainder so the parts sum to exactly
    // totalDays and a stay costs the same whether or not the patient moved.
    const exact = segmentHours.map((h) => (totalHours > 0 ? (h / totalHours) * totalDays : 0));
    const dayPerSegment = exact.map(Math.floor);
    const shortfall = totalDays - dayPerSegment.reduce((sum, d) => sum + d, 0);
    const byRemainder = exact
      .map((v, i) => ({ i, remainder: v - Math.floor(v) }))
      .sort((a, b) => b.remainder - a.remainder);
    for (let k = 0; k < shortfall && byRemainder.length > 0; k++) {
      dayPerSegment[byRemainder[k % byRemainder.length].i] += 1;
    }

    return billable
      .map((s, idx) => {
        let days = dayPerSegment[idx];
        if (daysAlreadyBilled > 0) {
          const deduct = Math.min(days, daysAlreadyBilled);
          days -= deduct;
          daysAlreadyBilled -= deduct;
        }
        const rate = Number(s.bed!.dailyRate || 0);
        return {
          serviceCode: `BED-${s.bed!.bedNumber}`,
          description: `${s.ward?.name || 'Ward'} bed ${s.bed!.bedNumber} (${s.from
            .toISOString()
            .slice(0, 10)} → ${s.to.toISOString().slice(0, 10)}, ${days}d)`,
          chargeType: 'bed' as const,
          quantity: days,
          unitPrice: rate,
          referenceType: 'admission',
          referenceId: admissionId,
        };
      })
      .filter((line) => line.unitPrice > 0 && line.quantity > 0); // skip zero-rate beds and fully pre-billed segments
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Auto-clear RESERVED beds whose hold has expired. Cheap to call per request. */
  private async expirePastReservations(tenantId?: string): Promise<void> {
    const tid = requireTenantId(tenantId);
    const now = new Date();
    const reserved = await this.bedRepo.find({
      where: { status: BedStatus.RESERVED, tenantId: tid },
    });
    const expiredBeds: typeof reserved = [];
    for (const bed of reserved) {
      const r = this.parseReservation(bed.notes);
      if (r && new Date(r.until) <= now) {
        bed.status = BedStatus.AVAILABLE;
        bed.notes = '';
        expiredBeds.push(bed);
        this.logger.log(`Reservation expired on bed ${bed.bedNumber}`);
      } else if (!r) {
        // RESERVED with no readable hold: the envelope was overwritten at some
        // point, so there is no expiry to reach and the bed would sit held for
        // good. Release it rather than lose a bed to a lost timer.
        bed.status = BedStatus.AVAILABLE;
        bed.notes = '';
        expiredBeds.push(bed);
        this.logger.warn(
          `Bed ${bed.bedNumber} was RESERVED with no readable reservation; releasing it`,
        );
      }
    }
    if (expiredBeds.length > 0) {
      await this.bedRepo.save(expiredBeds);
    }
  }

  private parseReservation(notes?: string): { until: string; by: string; reason: string } | null {
    if (!notes) return null;
    try {
      const j = JSON.parse(notes);
      return j?.reserved || null;
    } catch {
      return null;
    }
  }

  private hoursBetween(a: Date | string, b: Date | string): number {
    return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 36e5);
  }
}
