import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../database/entities/patient.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { LabSample } from '../../database/entities/lab-sample.entity';
import { Prescription } from '../../database/entities/prescription.entity';
import { CacheService } from '../cache/cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import { hashPii } from '../../common/crypto/pii-crypto';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 5;
const PORTAL_TOKEN_TTL = '7d';

interface OtpEntry {
  code: string;
  patientId: string;
  attempts: number;
  expiresAt: number;
}

export interface PatientTokenPayload {
  sub: string; // patient.id
  kind: 'patient';
  tenantId?: string;
}

@Injectable()
export class PatientPortalService {
  private readonly logger = new Logger(PatientPortalService.name);

  constructor(
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>,
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    @InjectRepository(Appointment) private readonly appointments: Repository<Appointment>,
    @InjectRepository(LabSample) private readonly labSamples: Repository<LabSample>,
    @InjectRepository(Prescription) private readonly prescriptions: Repository<Prescription>,
    private readonly cache: CacheService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // ─── OTP flow ──────────────────────────────────────────────────────────────

  async requestOtp(phone: string): Promise<{ ok: true; expiresInSeconds: number }> {
    const phoneHash = hashPii(phone, 'phone');
    const patient = await this.patients.findOne({ where: { phoneHash } });
    if (!patient) {
      // Do not leak presence — pretend success and short-circuit.
      this.logger.warn(`Portal OTP requested for unknown phone (hash=${phoneHash.slice(0, 8)}...)`);
      return { ok: true, expiresInSeconds: OTP_TTL_SECONDS };
    }

    // F-05: use CSPRNG so OTP cannot be predicted by observing earlier codes.
    const { randomInt } = await import('crypto');
    const code = String(randomInt(100000, 1000000));
    const entry: OtpEntry = {
      code,
      patientId: patient.id,
      attempts: 0,
      expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
    };
    await this.cache.set(this.otpKey(phoneHash), entry, OTP_TTL_SECONDS);

    const message = `Your patient portal verification code is ${code}. It expires in 5 minutes. Do not share this code.`;
    await this.notifications
      .sendSmsToPatient({
        patient: { phone: patient.phone, smsOptOut: patient.smsOptOut, fullName: patient.fullName },
        facilityId: (patient.metadata as any)?.facilityId || '',
        message,
        tenantId: patient.tenantId,
        transactional: true, // OTPs bypass opt-out
      })
      .catch((err) => this.logger.error(`Portal OTP SMS failed: ${err.message}`));

    return { ok: true, expiresInSeconds: OTP_TTL_SECONDS };
  }

  async verifyOtp(phone: string, code: string): Promise<{ accessToken: string; patient: any }> {
    const phoneHash = hashPii(phone, 'phone');
    const key = this.otpKey(phoneHash);
    const entry = await this.cache.get<OtpEntry>(key);
    if (!entry) throw new UnauthorizedException('OTP expired or never requested');

    if (entry.expiresAt < Date.now()) {
      await this.cache.del(key);
      throw new UnauthorizedException('OTP expired');
    }
    if (entry.attempts >= OTP_MAX_ATTEMPTS) {
      await this.cache.del(key);
      throw new UnauthorizedException('Too many attempts. Request a new code.');
    }
    if (entry.code !== code) {
      entry.attempts += 1;
      await this.cache.set(key, entry, Math.ceil((entry.expiresAt - Date.now()) / 1000));
      throw new UnauthorizedException('Incorrect code');
    }

    await this.cache.del(key);

    const patient = await this.patients.findOne({ where: { id: entry.patientId } });
    if (!patient) throw new NotFoundException('Patient record not found');

    const payload: PatientTokenPayload = {
      sub: patient.id,
      kind: 'patient',
      tenantId: patient.tenantId,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: PORTAL_TOKEN_TTL });

    return { accessToken, patient: this.publicProfile(patient) };
  }

  private otpKey(phoneHash: string) {
    return `portal:otp:${phoneHash}`;
  }

  // ─── Authenticated reads (called after PatientPortalGuard sets req.patientId) ──

  async getMe(patientId: string, ip?: string) {
    const patient = await this.patients.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    this.logAccess(patientId, 'patient_profile', 1, ip);
    return this.publicProfile(patient);
  }

  async listAppointments(patientId: string, ip?: string) {
    const rows = await this.appointments.find({
      where: { patientId },
      order: { appointmentDate: 'DESC', startTime: 'DESC' },
      take: 100,
    });
    this.logAccess(patientId, 'appointments', rows.length, ip);
    return rows.map((a) => ({
      id: a.id,
      number: a.appointmentNumber,
      date: a.appointmentDate,
      startTime: a.startTime,
      endTime: a.endTime,
      type: a.type,
      status: a.status,
      reason: a.reasonForVisit,
      notes: a.notes,
    }));
  }

  async listInvoices(patientId: string, ip?: string) {
    const rows = await this.invoices.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    this.logAccess(patientId, 'invoices', rows.length, ip);
    return rows.map((i) => ({
      id: i.id,
      number: i.invoiceNumber,
      status: i.status,
      total: Number(i.totalAmount),
      paid: Number(i.amountPaid),
      balance: Number(i.balanceDue),
      dueDate: i.dueDate,
      createdAt: i.createdAt,
    }));
  }

  async listLabResults(patientId: string, ip?: string) {
    // Return only released/completed samples; other states are still in-process and
    // shouldn't be visible to patients without a clinician's interpretation.
    const rows = await this.labSamples
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.results', 'r')
      .leftJoinAndSelect('s.test', 't')
      .where('s.patientId = :patientId', { patientId })
      .andWhere('s.status = :status', { status: 'COMPLETED' })
      .orderBy('s.updatedAt', 'DESC')
      .limit(100)
      .getMany();
    this.logAccess(patientId, 'lab_results', rows.length, ip);
    return rows.map((s: any) => ({
      id: s.id,
      sampleNumber: s.sampleNumber,
      testName: s.test?.name,
      status: s.status,
      collectedAt: s.collectedAt,
      releasedAt: s.updatedAt,
      results: (s.results || []).map((r: any) => ({
        id: r.id,
        parameter: r.parameter,
        value: r.value,
        unit: r.unit,
        referenceRange: r.referenceRange,
        flag: r.flag,
      })),
    }));
  }

  async listPrescriptions(patientId: string, ip?: string) {
    const rows = await this.prescriptions
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.items', 'items')
      .leftJoin('encounters', 'e', 'e.id = p.encounter_id')
      .where('e.patient_id = :patientId', { patientId })
      .orderBy('p.created_at', 'DESC')
      .limit(100)
      .getMany();
    this.logAccess(patientId, 'prescriptions', rows.length, ip);
    return rows.map((p: any) => ({
      id: p.id,
      number: p.prescriptionNumber,
      status: p.status,
      createdAt: p.createdAt,
      items: (p.items || []).map((it: any) => ({
        drug: it.drugName,
        dose: it.dose,
        frequency: it.frequency,
        duration: it.duration,
        instructions: it.instructions,
      })),
    }));
  }

  // ─── audit ─────────────────────────────────────────────────────────────────

  /** Fire-and-forget audit log for portal data access. */
  private logAccess(patientId: string, resource: string, count: number, ip?: string): void {
    this.auditLogs
      .save({
        action: 'PORTAL_VIEW',
        entityType: resource,
        entityId: patientId,
        actorType: 'patient',
        ipAddress: ip,
        newValue: { resource, resultCount: count },
      })
      .catch((err) => this.logger.warn(`Portal audit log failed: ${err.message}`));
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  private publicProfile(p: Patient) {
    return {
      id: p.id,
      mrn: p.mrn,
      fullName: p.fullName,
      gender: p.gender,
      dateOfBirth: p.dateOfBirth,
      phone: p.phone,
      email: p.email,
      bloodGroup: p.bloodGroup,
      photographUrl: p.photographUrl,
    };
  }
}
