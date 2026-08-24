import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NeuroObservation } from '../../database/entities/neuro-observation.entity';
import { Admission } from '../../database/entities/admission.entity';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { InAppNotificationType } from '../../database/entities/in-app-notification.entity';
import { requireTenantId } from '../../common/utils/tenant.util';
import { CreateNeuroObservationDto, QueryNeuroObservationDto } from './dto/neuro-observation.dto';

@Injectable()
export class NeuroObservationService {
  private readonly logger = new Logger(NeuroObservationService.name);

  constructor(
    @InjectRepository(NeuroObservation)
    private readonly repo: Repository<NeuroObservation>,
    @InjectRepository(Admission)
    private readonly admissionRepo: Repository<Admission>,
    // @Inject required alongside @Optional with a union type — see
    // scripts/find-untokenized-optional-injections.py.
    @Optional()
    @Inject(InAppNotificationsService)
    private readonly notifications: InAppNotificationsService | null,
  ) {}

  async create(dto: CreateNeuroObservationDto, userId: string, tenantId?: string): Promise<NeuroObservation> {
    const tid = requireTenantId(tenantId);
    const gcsTotal = (dto.gcsEye || 0) + (dto.gcsVerbal || 0) + (dto.gcsMotor || 0);
    const obs = this.repo.create({
      ...dto,
      gcsTotal: (dto.gcsEye && dto.gcsVerbal && dto.gcsMotor) ? gcsTotal : undefined,
      tenantId: tid,
      assessedById: userId,
    });
    const previous = await this.repo.findOne({
      where: { admissionId: dto.admissionId, tenantId: tid },
      order: { createdAt: 'DESC' },
    });

    const saved = await this.repo.save(obs);
    await this.alertOnNeuroDeterioration(saved, previous, tid);
    return saved;
  }

  /**
   * Neuro observations are charted BECAUSE somebody is worried about a head
   * injury or a falling conscious level, and the whole point of the chart is
   * the trend. Nothing looked at it: a GCS of 3 was filed as quietly as a GCS
   * of 15, and a two-point fall between observations — the classic trigger for
   * calling a doctor — went unremarked. Never throws: an alert that cannot be
   * sent must not lose the observation.
   */
  private async alertOnNeuroDeterioration(
    obs: NeuroObservation,
    previous: NeuroObservation | null,
    tenantId: string,
  ): Promise<void> {
    if (!this.notifications) return;
    try {
      const gcs = obs.gcsTotal ?? null;
      const reasons: string[] = [];

      if (gcs != null && gcs <= 8) {
        reasons.push(`GCS ${gcs} — unprotected airway, urgent review`);
      }
      if (gcs != null && previous?.gcsTotal != null && previous.gcsTotal - gcs >= 2) {
        reasons.push(`GCS fallen from ${previous.gcsTotal} to ${gcs}`);
      }
      if ((obs.avpu || '').toUpperCase() === 'U') {
        reasons.push('Unresponsive on AVPU');
      }
      if (reasons.length === 0) return;

      // An admission has no facility of its own — it reaches one through the
      // ward the patient is in.
      const admission = await this.admissionRepo.findOne({
        where: { id: obs.admissionId, tenantId },
        relations: ['ward'],
      });
      const facilityId = admission?.ward?.facilityId;

      const targets = await this.notifications.getUserIdsByRole(
        ['nurse', 'charge_nurse', 'nurse_supervisor', 'doctor', 'medical_officer'],
        facilityId,
        tenantId,
      );
      if (targets.length === 0) return;

      await this.notifications.notifyMany(
        targets,
        {
          type: InAppNotificationType.GENERAL,
          title: 'Neurological deterioration',
          message: `${admission?.admissionNumber ?? 'Admission'}: ${reasons.join('; ')}`,
          facilityId,
          metadata: {
            kind: 'neuro_deterioration',
            admissionId: obs.admissionId,
            gcsTotal: gcs,
            previousGcsTotal: previous?.gcsTotal ?? null,
            avpu: obs.avpu,
          },
        },
        tenantId,
      );
    } catch (err: any) {
      this.logger.warn(`Neuro deterioration alert failed: ${err.message}`);
    }
  }

  async list(query: QueryNeuroObservationDto, tenantId?: string): Promise<NeuroObservation[]> {
    const tid = requireTenantId(tenantId);
    const qb = this.repo.createQueryBuilder('neuro')
      .leftJoinAndSelect('neuro.assessedBy', 'assessedBy')
      .where('neuro.tenant_id = :tenantId', { tenantId: tid });

    if (query.admissionId) {
      qb.andWhere('neuro.admission_id = :admissionId', { admissionId: query.admissionId });
    }

    return qb.orderBy('neuro.created_at', 'DESC').getMany();
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const tid = requireTenantId(tenantId);
    await this.repo.softDelete({ id, tenantId: tid });
  }
}
