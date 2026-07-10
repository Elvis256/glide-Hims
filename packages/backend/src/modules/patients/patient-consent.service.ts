import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { PatientConsent, ConsentType } from '../../database/entities/patient-consent.entity';
import { AuditLogService } from '../../common/interceptors/audit-log.service';

@Injectable()
export class PatientConsentService {
  private readonly logger = new Logger(PatientConsentService.name);

  constructor(
    @InjectRepository(PatientConsent)
    private consentRepo: Repository<PatientConsent>,
    private auditLogService: AuditLogService,
  ) {}

  async recordConsent(params: {
    patientId: string;
    consentType: ConsentType;
    version?: string;
    accepted?: boolean;
    ipAddress?: string;
    userAgent?: string;
    recordedById?: string;
    witnessedById?: string;
    tenantId?: string;
  }): Promise<PatientConsent> {
    const version = params.version || '1.0';

    // Idempotent: if same patient+type+version already active, return it
    const existing = await this.consentRepo.findOne({
      where: {
        patientId: params.patientId,
        consentType: params.consentType,
        version,
        withdrawnAt: IsNull(),
        deletedAt: IsNull(),
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      },
    });
    if (existing) {
      return existing;
    }

    const consent = this.consentRepo.create({
      patientId: params.patientId,
      consentType: params.consentType,
      version,
      accepted: params.accepted !== false,
      acceptedAt: new Date(),
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      recordedById: params.recordedById || null,
      witnessedById: params.witnessedById || null,
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
    });

    return this.consentRepo.save(consent);
  }

  async getActiveConsents(patientId: string, tenantId?: string): Promise<PatientConsent[]> {
    return this.consentRepo.find({
      where: {
        patientId,
        withdrawnAt: IsNull(),
        deletedAt: IsNull(),
        ...(tenantId ? { tenantId } : {}),
      },
      order: { acceptedAt: 'DESC' },
    });
  }

  async withdrawConsent(params: {
    consentId: string;
    patientId: string;
    reason: string;
    withdrawnById: string;
    tenantId?: string;
  }): Promise<PatientConsent> {
    const consent = await this.consentRepo.findOne({
      where: {
        id: params.consentId,
        patientId: params.patientId,
        withdrawnAt: IsNull(),
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      },
    });
    if (!consent) {
      throw new NotFoundException('Active consent not found');
    }

    consent.withdrawnAt = new Date();
    consent.withdrawnReason = params.reason;
    consent.withdrawnById = params.withdrawnById;
    const saved = await this.consentRepo.save(consent);

    this.auditLogService
      .log({
        userId: params.withdrawnById,
        action: 'CONSENT_WITHDRAWN',
        entityType: 'PatientConsent',
        entityId: consent.id,
        newValue: {
          patientId: params.patientId,
          consentType: consent.consentType,
          reason: params.reason,
        },
        tenantId: params.tenantId,
      })
      .catch((err) => this.logger.warn(`Audit log failed: ${err.message}`));

    return saved;
  }

  async getConsentHistory(patientId: string, tenantId?: string): Promise<PatientConsent[]> {
    return this.consentRepo.find({
      where: {
        patientId,
        ...(tenantId ? { tenantId } : {}),
      },
      order: { createdAt: 'DESC' },
      withDeleted: true,
    });
  }
}
