import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InAppNotification, InAppNotificationType } from '../../database/entities/in-app-notification.entity';
import { NotificationsGateway } from './notifications.gateway';
import { UserRole } from '../../database/entities/user-role.entity';
import { Role } from '../../database/entities/role.entity';

export interface CreateNotificationDto {
  targetUserId: string;
  facilityId?: string;
  targetDepartmentId?: string;
  senderUserId?: string;
  senderName?: string;
  type: InAppNotificationType;
  title: string;
  message?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class InAppNotificationsService {
  private readonly logger = new Logger(InAppNotificationsService.name);

  constructor(
    @InjectRepository(InAppNotification)
    private notifRepo: Repository<InAppNotification>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    private gateway: NotificationsGateway,
  ) {}

  /** Create a notification, save it, and push via WebSocket */
  async create(dto: CreateNotificationDto): Promise<InAppNotification> {
    const notification = this.notifRepo.create(dto);
    const saved = await this.notifRepo.save(notification);
    this.gateway.sendToUser(dto.targetUserId, {
      id: saved.id,
      type: saved.type,
      title: saved.title,
      message: saved.message,
      metadata: saved.metadata,
      isRead: false,
      createdAt: saved.createdAt,
    });
    return saved;
  }

  /** Notify multiple users at once */
  async notifyMany(userIds: string[], base: Omit<CreateNotificationDto, 'targetUserId'>): Promise<void> {
    const unique = [...new Set(userIds)];
    for (const targetUserId of unique) {
      await this.create({ ...base, targetUserId });
    }
  }

  /** Find users by role name(s) within a facility */
  async getUserIdsByRole(roleNames: string[], facilityId?: string): Promise<string[]> {
    const roles = await this.roleRepo
      .createQueryBuilder('role')
      .where('LOWER(role.name) IN (:...names)', {
        names: roleNames.map((n) => n.toLowerCase()),
      })
      .getMany();

    if (roles.length === 0) return [];

    const qb = this.userRoleRepo
      .createQueryBuilder('ur')
      .select('DISTINCT ur.userId', 'userId')
      .where('ur.roleId IN (:...roleIds)', { roleIds: roles.map((r) => r.id) });

    if (facilityId) {
      qb.andWhere('(ur.facilityId = :facilityId OR ur.facilityId IS NULL)', { facilityId });
    }

    const rows = await qb.getRawMany();
    return rows.map((r) => r.userId);
  }

  async getForUser(userId: string, page = 1, limit = 30, tenantId?: string) {
    const where: any = { targetUserId: userId };
    if (tenantId) where.tenantId = tenantId;
    const [data, total] = await this.notifRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async getUnreadCount(userId: string, tenantId?: string): Promise<number> {
    const where: any = { targetUserId: userId, isRead: false };
    if (tenantId) where.tenantId = tenantId;
    return this.notifRepo.count({ where });
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.notifRepo.update({ id, targetUserId: userId }, { isRead: true, readByUserId: userId, readAt: new Date() });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifRepo.update({ targetUserId: userId, isRead: false }, { isRead: true, readByUserId: userId, readAt: new Date() });
  }

  // ─── Convenience helpers for domain events ───────────────────────────

  async notifyLabResultReady(orderedByUserId: string, patientName: string, testName: string, sampleId: string, facilityId?: string) {
    await this.create({
      targetUserId: orderedByUserId,
      facilityId,
      type: InAppNotificationType.LAB_RESULT_READY,
      title: 'Lab Result Ready',
      message: `Results for ${testName} are ready for patient ${patientName}`,
      metadata: { referenceType: 'lab_sample', referenceId: sampleId },
    });
  }

  async notifyRadiologyResultReady(orderedByUserId: string, patientName: string, studyType: string, orderId: string, facilityId?: string) {
    await this.create({
      targetUserId: orderedByUserId,
      facilityId,
      type: InAppNotificationType.RADIOLOGY_RESULT_READY,
      title: 'Radiology Report Ready',
      message: `${studyType} report is ready for patient ${patientName}`,
      metadata: { referenceType: 'imaging_order', referenceId: orderId },
    });
  }

  async notifyNewPrescription(patientName: string, prescriptionId: string, facilityId?: string) {
    const pharmacistIds = await this.getUserIdsByRole(['pharmacist', 'pharmacy'], facilityId);
    if (pharmacistIds.length === 0) return;
    await this.notifyMany(pharmacistIds, {
      facilityId,
      type: InAppNotificationType.PRESCRIPTION_CREATED,
      title: 'New Prescription',
      message: `New prescription for patient ${patientName}`,
      metadata: { referenceType: 'prescription', referenceId: prescriptionId },
    });
  }

  async notifyPrescriptionDispensed(patientName: string, prescriptionId: string, facilityId?: string) {
    const cashierIds = await this.getUserIdsByRole(['cashier', 'billing', 'biller', 'receptionist'], facilityId);
    if (cashierIds.length === 0) return;
    await this.notifyMany(cashierIds, {
      facilityId,
      type: InAppNotificationType.PRESCRIPTION_DISPENSED,
      title: 'Prescription Dispensed',
      message: `Medications dispensed for patient ${patientName} — ready for billing`,
      metadata: { referenceType: 'prescription', referenceId: prescriptionId },
    });
  }

  async notifyNewOrder(orderType: string, patientName: string, orderId: string, facilityId?: string) {
    let roleNames: string[];
    let type: InAppNotificationType;
    switch (orderType.toLowerCase()) {
      case 'lab':
      case 'laboratory':
        roleNames = ['lab technician', 'lab', 'laboratory'];
        type = InAppNotificationType.LAB_ORDER_CREATED;
        break;
      case 'radiology':
      case 'imaging':
        roleNames = ['radiologist', 'radiology', 'radiographer'];
        type = InAppNotificationType.RADIOLOGY_ORDER_CREATED;
        break;
      default:
        roleNames = ['nurse', 'doctor'];
        type = InAppNotificationType.GENERAL;
        break;
    }
    const userIds = await this.getUserIdsByRole(roleNames, facilityId);
    if (userIds.length === 0) return;
    await this.notifyMany(userIds, {
      facilityId,
      type,
      title: `New ${orderType} Order`,
      message: `New ${orderType} order for patient ${patientName}`,
      metadata: { referenceType: 'order', referenceId: orderId },
    });
  }

  async notifyBillReturned(doctorUserId: string, patientName: string, reason: string, encounterId: string, facilityId?: string) {
    await this.create({
      targetUserId: doctorUserId,
      facilityId,
      type: InAppNotificationType.ENCOUNTER_STATUS_CHANGED,
      title: 'Bill Returned',
      message: `Bill returned for patient ${patientName}: ${reason}`,
      metadata: { referenceType: 'encounter', referenceId: encounterId },
    });
  }
}
