import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull, Not, In } from 'typeorm';
import { Ward } from '../../database/entities/ward.entity';
import { Bed, BedStatus } from '../../database/entities/bed.entity';
import { Admission, AdmissionStatus } from '../../database/entities/admission.entity';
import { BedTransfer } from '../../database/entities/bed-transfer.entity';

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
  ) {}

  /**
   * Wall-board snapshot. Returns the smallest payload the UI needs to render a
   * coloured grid: ward name → beds[{number, type, status, currentPatient,
   * losHours, expectedDischarge}]. ~1 SQL roundtrip per ward; fine for the
   * 5–30 wards a typical facility has.
   */
  async getBedBoard(facilityId?: string, tenantId?: string) {
    await this.expirePastReservations(tenantId);

    const wards = await this.wardRepo.find({
      where: {
        ...(facilityId ? { facilityId } : {}),
        ...(tenantId ? { tenantId } : {}),
      },
      order: { name: 'ASC' },
    });
    if (!wards.length) return [];

    const wardIds = wards.map((w) => w.id);
    const beds = await this.bedRepo.find({
      where: { wardId: In(wardIds), ...(tenantId ? { tenantId } : {}) },
      order: { bedNumber: 'ASC' },
    });

    const liveAdmissions = await this.admissionRepo.find({
      where: {
        bedId: In(beds.map((b) => b.id)),
        status: AdmissionStatus.ADMITTED,
        ...(tenantId ? { tenantId } : {}),
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
          code: (ward as any).code || '',
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
  async getCensus(
    facilityId: string,
    dateFrom: string,
    dateTo: string,
    tenantId?: string,
  ) {
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);

    const wards = await this.wardRepo.find({
      where: {
        ...(facilityId ? { facilityId } : {}),
        ...(tenantId ? { tenantId } : {}),
      },
    });
    const totalBeds = await this.bedRepo.count({
      where: {
        ward: { facilityId, ...(tenantId ? { tenantId } : {}) } as any,
        ...(tenantId ? { tenantId } : {}),
      },
    });

    // Discharges within window — used for ALOS + turnover
    const discharges = await this.admissionRepo.find({
      where: {
        status: In([AdmissionStatus.DISCHARGED, AdmissionStatus.DECEASED, AdmissionStatus.ABSCONDED]),
        dischargeDate: Between(start, end) as any,
        ...(tenantId ? { tenantId } : {}),
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
          ...(tenantId ? { tenantId } : {}),
        },
        {
          admissionDate: Between(new Date(0), end) as any,
          dischargeDate: Between(start, new Date('9999-12-31')) as any,
          ...(tenantId ? { tenantId } : {}),
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

    const avgDaily = days.length
      ? days.reduce((a, d) => a + d.occupied, 0) / days.length
      : 0;

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
    const bed = await this.bedRepo.findOne({
      where: { id: bedId, ...(tenantId ? { tenantId } : {}) },
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
    return this.bedRepo.save(bed);
  }

  async releaseReservation(bedId: string, tenantId?: string): Promise<Bed> {
    const bed = await this.bedRepo.findOne({
      where: { id: bedId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!bed) throw new NotFoundException('Bed not found');
    if (bed.status !== BedStatus.RESERVED) {
      throw new BadRequestException('Bed is not reserved');
    }
    bed.status = BedStatus.AVAILABLE;
    bed.notes = '';
    return this.bedRepo.save(bed);
  }

  /**
   * Build the bed-day line items for an admission so a discharge invoice can
   * be created. Walks BedTransfer history; each segment becomes one line
   * (ward + bed + nights × dailyRate). Partial-day rules: any portion of a
   * day after midnight bills as a full day (industry standard).
   */
  async computeBedDayCharges(admissionId: string, tenantId?: string) {
    const admission = await this.admissionRepo.findOne({
      where: { id: admissionId, ...(tenantId ? { tenantId } : {}) },
      relations: ['bed', 'ward'],
    });
    if (!admission) throw new NotFoundException('Admission not found');

    const transfers = await this.transferRepo.find({
      where: { admissionId, ...(tenantId ? { tenantId } : {}) },
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
    let curBed: Bed | undefined = admission.bed;
    let curWard: Ward | undefined = admission.ward;

    // walk transfers — each transfer closes the current segment
    for (const t of transfers) {
      const at = new Date(t.transferTime);
      segments.push({ bed: curBed, ward: curWard, from: cursor, to: at });
      cursor = at;
      curBed = t.toBed;
      curWard = t.toWard;
    }
    segments.push({ bed: curBed, ward: curWard, from: cursor, to: end });

    return segments
      .filter((s) => s.bed && s.to > s.from)
      .map((s) => {
        const days = Math.max(1, Math.ceil(this.hoursBetween(s.from, s.to) / 24));
        const rate = Number(s.bed!.dailyRate || 0);
        return {
          serviceCode: `BED-${s.bed!.bedNumber}`,
          description: `${s.ward?.name || 'Ward'} bed ${s.bed!.bedNumber} (${
            s.from.toISOString().slice(0, 10)
          } → ${s.to.toISOString().slice(0, 10)}, ${days}d)`,
          chargeType: 'bed' as const,
          quantity: days,
          unitPrice: rate,
          referenceType: 'admission',
          referenceId: admissionId,
        };
      })
      .filter((line) => line.unitPrice > 0); // skip zero-rate beds (unbilled)
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Auto-clear RESERVED beds whose hold has expired. Cheap to call per request. */
  private async expirePastReservations(tenantId?: string): Promise<void> {
    const now = new Date();
    const reserved = await this.bedRepo.find({
      where: { status: BedStatus.RESERVED, ...(tenantId ? { tenantId } : {}) },
    });
    for (const bed of reserved) {
      const r = this.parseReservation(bed.notes);
      if (r && new Date(r.until) <= now) {
        bed.status = BedStatus.AVAILABLE;
        bed.notes = '';
        await this.bedRepo.save(bed);
        this.logger.log(`Reservation expired on bed ${bed.bedNumber}`);
      }
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
