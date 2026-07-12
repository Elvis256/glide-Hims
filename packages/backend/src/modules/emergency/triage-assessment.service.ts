import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TriageAssessment } from '../../database/entities/triage-assessment.entity';
import { Queue } from '../../database/entities/queue.entity';
import { VitalsService } from '../vitals/vitals.service';
import { VitalSource } from '../../database/entities/vital.entity';
import { CreateTriageAssessmentDto } from './dto/create-triage-assessment.dto';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class TriageAssessmentService {
  private readonly logger = new Logger(TriageAssessmentService.name);

  constructor(
    @InjectRepository(TriageAssessment)
    private readonly triageRepo: Repository<TriageAssessment>,
    @InjectRepository(Queue)
    private readonly queueRepo: Repository<Queue>,
    private readonly vitalsService: VitalsService,
  ) {}

  async create(
    dto: CreateTriageAssessmentDto,
    userId: string,
    tenantId?: string,
  ): Promise<TriageAssessment> {
    const tid = requireTenantId(tenantId);
    const queue = await this.queueRepo.findOne({
      where: { id: dto.queueId, tenantId: tid },
    });
    if (!queue) throw new NotFoundException('Queue entry not found');

    // Check for existing triage assessment on this queue
    const existing = await this.triageRepo.findOne({
      where: { queueId: dto.queueId, tenantId: tid },
    });
    if (existing) {
      throw new BadRequestException(
        'Triage assessment already exists for this queue. Use reassess endpoint instead.',
      );
    }

    // Create the triage assessment
    const assessment = this.triageRepo.create({
      queueId: dto.queueId,
      encounterId: queue.encounterId || null,
      patientId: queue.patientId,
      facilityId: queue.facilityId,
      chiefComplaint: dto.chiefComplaint,
      onset: dto.onset,
      duration: dto.duration,
      severity: dto.severity,
      esiLevel: dto.esiLevel,
      acuityColor: dto.acuityColor,
      painScore: dto.painScore,
      painLocation: dto.painLocation,
      painCharacter: dto.painCharacter,
      mobilityStatus: dto.mobilityStatus,
      mentalStatus: dto.mentalStatus,
      consciousnessLevel: dto.consciousnessLevel,
      supplementalOxygen: dto.supplementalOxygen ?? false,
      temperature: dto.temperature,
      pulse: dto.pulse,
      bpSystolic: dto.bpSystolic,
      bpDiastolic: dto.bpDiastolic,
      respiratoryRate: dto.respiratoryRate,
      oxygenSaturation: dto.oxygenSaturation,
      bloodGlucose: dto.bloodGlucose,
      weight: dto.weight,
      disposition: dto.disposition,
      nursingNotes: dto.nursingNotes,
      assessedById: userId,
      tenantId: tid,
    });

    const saved = await this.triageRepo.save(assessment);

    // Mirror vitals to the vitals table if encounter exists
    if (queue.encounterId && this.hasVitals(dto)) {
      try {
        await this.vitalsService.recordFromSource({
          encounterId: queue.encounterId,
          patientId: queue.patientId,
          source: VitalSource.EMERGENCY_TRIAGE,
          sourceRefId: saved.id,
          recordedById: userId,
          tenantId,
          temperature: dto.temperature,
          pulse: dto.pulse,
          bpSystolic: dto.bpSystolic,
          bpDiastolic: dto.bpDiastolic,
          respiratoryRate: dto.respiratoryRate,
          oxygenSaturation: dto.oxygenSaturation,
          bloodGlucose: dto.bloodGlucose,
          weight: dto.weight,
          consciousnessLevel: dto.consciousnessLevel,
          supplementalOxygen: dto.supplementalOxygen,
        });
      } catch (e: any) {
        this.logger.warn(`Failed to mirror triage vitals: ${e?.message}`);
      }
    }

    // Compute NEWS/MEWS and store on assessment
    const scores = this.vitalsService.computeEarlyWarningScores({
      temperature: dto.temperature,
      pulse: dto.pulse,
      bpSystolic: dto.bpSystolic,
      respiratoryRate: dto.respiratoryRate,
      oxygenSaturation: dto.oxygenSaturation,
      consciousnessLevel: dto.consciousnessLevel,
      supplementalOxygen: dto.supplementalOxygen,
    });
    if (scores) {
      saved.newsScore = scores.newsScore;
      saved.mewsScore = scores.mewsScore;
      await this.triageRepo.save(saved);
    }

    // Update queue with triage assessment reference + backward compat JSONB
    await this.queueRepo.update(queue.id, {
      triageAssessmentId: saved.id,
      triageData: this.buildTriageDataJsonb(saved),
      triageDataUpdatedAt: new Date(),
      triageDataUpdatedById: userId,
    });

    return saved;
  }

  async reassess(
    originalId: string,
    dto: CreateTriageAssessmentDto,
    userId: string,
    tenantId?: string,
  ): Promise<TriageAssessment> {
    const tid = requireTenantId(tenantId);
    const original = await this.triageRepo.findOne({
      where: { id: originalId, tenantId: tid },
    });
    if (!original) throw new NotFoundException('Original triage assessment not found');

    const queue = await this.queueRepo.findOne({
      where: { id: original.queueId, tenantId: tid },
    });
    if (!queue) throw new NotFoundException('Queue entry not found');

    const assessment = this.triageRepo.create({
      queueId: original.queueId,
      encounterId: original.encounterId,
      patientId: original.patientId,
      facilityId: original.facilityId,
      chiefComplaint: dto.chiefComplaint,
      onset: dto.onset,
      duration: dto.duration,
      severity: dto.severity,
      esiLevel: dto.esiLevel,
      acuityColor: dto.acuityColor,
      painScore: dto.painScore,
      painLocation: dto.painLocation,
      painCharacter: dto.painCharacter,
      mobilityStatus: dto.mobilityStatus,
      mentalStatus: dto.mentalStatus,
      consciousnessLevel: dto.consciousnessLevel,
      supplementalOxygen: dto.supplementalOxygen ?? false,
      temperature: dto.temperature,
      pulse: dto.pulse,
      bpSystolic: dto.bpSystolic,
      bpDiastolic: dto.bpDiastolic,
      respiratoryRate: dto.respiratoryRate,
      oxygenSaturation: dto.oxygenSaturation,
      bloodGlucose: dto.bloodGlucose,
      weight: dto.weight,
      disposition: dto.disposition,
      nursingNotes: dto.nursingNotes,
      assessedById: userId,
      reassessmentOf: originalId,
      tenantId: tid,
    });

    const saved = await this.triageRepo.save(assessment);

    // Compute scores
    const scores = this.vitalsService.computeEarlyWarningScores({
      temperature: dto.temperature,
      pulse: dto.pulse,
      bpSystolic: dto.bpSystolic,
      respiratoryRate: dto.respiratoryRate,
      oxygenSaturation: dto.oxygenSaturation,
      consciousnessLevel: dto.consciousnessLevel,
      supplementalOxygen: dto.supplementalOxygen,
    });
    if (scores) {
      saved.newsScore = scores.newsScore;
      saved.mewsScore = scores.mewsScore;
      await this.triageRepo.save(saved);
    }

    // Mirror vitals
    if (original.encounterId && this.hasVitals(dto)) {
      try {
        await this.vitalsService.recordFromSource({
          encounterId: original.encounterId,
          patientId: original.patientId,
          source: VitalSource.EMERGENCY_TRIAGE,
          sourceRefId: saved.id,
          recordedById: userId,
          tenantId,
          temperature: dto.temperature,
          pulse: dto.pulse,
          bpSystolic: dto.bpSystolic,
          bpDiastolic: dto.bpDiastolic,
          respiratoryRate: dto.respiratoryRate,
          oxygenSaturation: dto.oxygenSaturation,
          bloodGlucose: dto.bloodGlucose,
          weight: dto.weight,
          consciousnessLevel: dto.consciousnessLevel,
          supplementalOxygen: dto.supplementalOxygen,
        });
      } catch (e: any) {
        this.logger.warn(`Failed to mirror reassessment vitals: ${e?.message}`);
      }
    }

    // Update queue backward compat JSONB with latest triage
    await this.queueRepo.update(queue.id, {
      triageAssessmentId: saved.id,
      triageData: this.buildTriageDataJsonb(saved),
      triageDataUpdatedAt: new Date(),
      triageDataUpdatedById: userId,
    });

    return saved;
  }

  async getByQueue(queueId: string, tenantId?: string): Promise<TriageAssessment[]> {
    const tid = requireTenantId(tenantId);
    return this.triageRepo.find({
      where: { queueId, tenantId: tid },
      order: { createdAt: 'DESC' },
    });
  }

  async getByEncounter(encounterId: string, tenantId?: string): Promise<TriageAssessment[]> {
    const tid = requireTenantId(tenantId);
    return this.triageRepo.find({
      where: { encounterId, tenantId: tid },
      order: { createdAt: 'DESC' },
    });
  }

  async getById(id: string, tenantId?: string): Promise<TriageAssessment> {
    const tid = requireTenantId(tenantId);
    const a = await this.triageRepo.findOne({
      where: { id, tenantId: tid },
    });
    if (!a) throw new NotFoundException('Triage assessment not found');
    return a;
  }

  private hasVitals(dto: CreateTriageAssessmentDto): boolean {
    return !!(
      dto.temperature ||
      dto.pulse ||
      dto.bpSystolic ||
      dto.respiratoryRate ||
      dto.oxygenSaturation
    );
  }

  private buildTriageDataJsonb(a: TriageAssessment): Record<string, any> {
    return {
      chiefComplaint: a.chiefComplaint,
      onset: a.onset,
      duration: a.duration,
      severity: a.severity,
      esiLevel: a.esiLevel,
      acuityColor: a.acuityColor,
      painScore: a.painScore,
      painLocation: a.painLocation,
      mobilityStatus: a.mobilityStatus,
      mentalStatus: a.mentalStatus,
      consciousnessLevel: a.consciousnessLevel,
      supplementalOxygen: a.supplementalOxygen,
      newsScore: a.newsScore,
      mewsScore: a.mewsScore,
      disposition: a.disposition,
      nursingNotes: a.nursingNotes,
      vitalsSummary: {
        temperature: a.temperature,
        pulse: a.pulse,
        bpSystolic: a.bpSystolic,
        bpDiastolic: a.bpDiastolic,
        respiratoryRate: a.respiratoryRate,
        oxygenSaturation: a.oxygenSaturation,
        bloodGlucose: a.bloodGlucose,
        weight: a.weight,
      },
      assessedById: a.assessedById,
      assessedAt: a.createdAt,
      reassessmentOf: a.reassessmentOf,
    };
  }
}
