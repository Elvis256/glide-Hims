import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RxNotificationLog } from '../../database/entities/rx-notification.entity';
import { Prescription } from '../../database/entities/prescription.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { AfricasTalkingService, SMSResult } from '../integrations/africas-talking.service';

@Injectable()
export class RxNotificationService {
  private readonly logger = new Logger(RxNotificationService.name);

  constructor(
    @InjectRepository(RxNotificationLog)
    private readonly notificationLogRepo: Repository<RxNotificationLog>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
    private readonly smsService: AfricasTalkingService,
  ) {}

  async notifyPrescriptionReady(
    prescriptionId: string,
    tenantId: string,
  ): Promise<RxNotificationLog> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { id: prescriptionId, tenantId },
      relations: ['encounter', 'encounter.patient', 'encounter.facility'],
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    const patient = prescription.encounter?.patient;
    const facility = prescription.encounter?.facility;

    if (!patient?.phone) {
      throw new NotFoundException('Patient phone number not available');
    }

    const facilityName = facility?.name || 'the facility';
    const patientName = patient.fullName || 'Patient';
    const rxNumber = prescription.prescriptionNumber;

    const message = `Dear ${patientName}, your prescription #${rxNumber} is ready for collection at ${facilityName}. Please visit the pharmacy. Thank you.`;

    const log = this.notificationLogRepo.create({
      prescriptionId,
      patientId: patient.id,
      notificationType: 'ready' as const,
      channel: 'sms' as const,
      phoneNumber: patient.phone,
      message,
      status: 'pending' as const,
      tenantId,
    });

    const saved = await this.notificationLogRepo.save(log);

    try {
      const result: SMSResult = await this.smsService.sendSMS(patient.phone, message);

      saved.status = result.success ? 'sent' : 'failed';
      saved.externalId = result.messageId || null;
      saved.errorMessage = result.success ? null : result.status;
    } catch (error: any) {
      this.logger.error(`SMS send failed for prescription ${prescriptionId}`, error.message);
      saved.status = 'failed';
      saved.errorMessage = error.message;
    }

    return this.notificationLogRepo.save(saved);
  }

  async notifyRefillReminder(
    prescriptionId: string,
    tenantId: string,
  ): Promise<RxNotificationLog> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { id: prescriptionId, tenantId },
      relations: ['encounter', 'encounter.patient', 'encounter.facility'],
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    const patient = prescription.encounter?.patient;
    const facility = prescription.encounter?.facility;

    if (!patient?.phone) {
      throw new NotFoundException('Patient phone number not available');
    }

    const facilityName = facility?.name || 'the facility';
    const patientName = patient.fullName || 'Patient';

    const message = `Dear ${patientName}, your medication refill is due. Please visit ${facilityName} pharmacy or contact us. Thank you.`;

    const log = this.notificationLogRepo.create({
      prescriptionId,
      patientId: patient.id,
      notificationType: 'refill_reminder' as const,
      channel: 'sms' as const,
      phoneNumber: patient.phone,
      message,
      status: 'pending' as const,
      tenantId,
    });

    const saved = await this.notificationLogRepo.save(log);

    try {
      const result: SMSResult = await this.smsService.sendSMS(patient.phone, message);

      saved.status = result.success ? 'sent' : 'failed';
      saved.externalId = result.messageId || null;
      saved.errorMessage = result.success ? null : result.status;
    } catch (error: any) {
      this.logger.error(`Refill SMS failed for prescription ${prescriptionId}`, error.message);
      saved.status = 'failed';
      saved.errorMessage = error.message;
    }

    return this.notificationLogRepo.save(saved);
  }

  async getNotificationLog(
    prescriptionId: string,
    tenantId: string,
  ): Promise<RxNotificationLog[]> {
    return this.notificationLogRepo.find({
      where: { prescriptionId, tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async getPatientNotifications(
    patientId: string,
    tenantId: string,
  ): Promise<RxNotificationLog[]> {
    return this.notificationLogRepo.find({
      where: { patientId, tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllNotifications(
    tenantId: string,
    filters?: {
      notificationType?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<RxNotificationLog[]> {
    const qb = this.notificationLogRepo
      .createQueryBuilder('n')
      .where('n.tenant_id = :tenantId', { tenantId });

    if (filters?.notificationType) {
      qb.andWhere('n.notification_type = :type', { type: filters.notificationType });
    }
    if (filters?.status) {
      qb.andWhere('n.status = :status', { status: filters.status });
    }
    if (filters?.dateFrom) {
      qb.andWhere('n.created_at >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('n.created_at <= :dateTo', { dateTo: filters.dateTo });
    }

    qb.orderBy('n.created_at', 'DESC');
    return qb.getMany();
  }

  async resendNotification(
    notificationId: string,
    tenantId: string,
  ): Promise<RxNotificationLog> {
    const existing = await this.notificationLogRepo.findOne({
      where: { id: notificationId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Notification log not found');
    }

    const newLog = this.notificationLogRepo.create({
      prescriptionId: existing.prescriptionId,
      patientId: existing.patientId,
      notificationType: existing.notificationType,
      channel: existing.channel,
      phoneNumber: existing.phoneNumber,
      message: existing.message,
      status: 'pending' as const,
      tenantId,
    });

    const saved = await this.notificationLogRepo.save(newLog);

    try {
      const result: SMSResult = await this.smsService.sendSMS(
        existing.phoneNumber,
        existing.message,
      );

      saved.status = result.success ? 'sent' : 'failed';
      saved.externalId = result.messageId || null;
      saved.errorMessage = result.success ? null : result.status;
    } catch (error: any) {
      this.logger.error(`Resend SMS failed for notification ${notificationId}`, error.message);
      saved.status = 'failed';
      saved.errorMessage = error.message;
    }

    return this.notificationLogRepo.save(saved);
  }
}
