import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InAppNotification, NotificationType } from '../../database/entities/in-app-notification.entity';
import { NotificationsGateway } from './notifications.gateway';
import { UserRole } from '../../database/entities/user-role.entity';
import { Role } from '../../database/entities/role.entity';

export interface CreateNotificationDto {
  userId: string;
  facilityId?: string;
  type: NotificationType;
  title: string;
  message?: string;
  referenceType?: string;
  referenceId?: string;
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
    this.gateway.sendToUser(dto.userId, {
      id: saved.id,
      type: saved.type,
      title: saved.title,
      message: saved.message,
      referenceType: saved.referenceType,
      referenceId: saved.referenceId,
      isRead: false,
      createdAt: saved.createdAt,
    });
    return saved;
  }

  /** Notify multiple users at once */
  async notifyMany(userIds: string[], base: Omit<CreateNotificationDto, 'userId'>): Promise<void> {
    const unique = [...new Set(userIds)];
    for (const userId of unique) {
      await this.create({ ...base, userId });
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

  async getForUser(userId: string, page = 1, limit = 30) {
    const [data, total] = await this.notifRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notifRepo.count({ where: { userId, isRead: false } });
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.notifRepo.update({ id, userId }, { isRead: true });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
  }

  // ─── Convenience helpers for domain events ───────────────────────────

  async notifyLabResultReady(orderedByUserId: string, patientName: string, testName: string, sampleId: string, facilityId?: string) {
    await this.create({
      userId: orderedByUserId,
      facilityId,
      type: NotificationType.LAB_RESULT_READY,
      title: 'Lab Result Ready',
      message: `Results for ${testName} are ready for patient ${patientName}`,
      referenceType: 'lab_sample',
      referenceId: sampleId,
    });
  }

  async notifyRadiologyResultReady(orderedByUserId: string, patientName: string, studyType: string, orderId: string, facilityId?: string) {
    await this.create({
      userId: orderedByUserId,
      facilityId,
      type: NotificationType.RADIOLOGY_RESULT_READY,
      title: 'Radiology Report Ready',
      message: `${studyType} report is ready for patient ${patientName}`,
      referenceType: 'imaging_order',
      referenceId: orderId,
    });
  }

  async notifyNewPrescription(patientName: string, prescriptionId: string, facilityId?: string) {
    const pharmacistIds = await this.getUserIdsByRole(['pharmacist', 'pharmacy'], facilityId);
    if (pharmacistIds.length === 0) return;
    await this.notifyMany(pharmacistIds, {
      facilityId,
      type: NotificationType.NEW_PRESCRIPTION,
      title: 'New Prescription',
      message: `New prescription for patient ${patientName}`,
      referenceType: 'prescription',
      referenceId: prescriptionId,
    });
  }

  async notifyPrescriptionDispensed(patientName: string, prescriptionId: string, facilityId?: string) {
    const cashierIds = await this.getUserIdsByRole(['cashier', 'billing', 'biller', 'receptionist'], facilityId);
    if (cashierIds.length === 0) return;
    await this.notifyMany(cashierIds, {
      facilityId,
      type: NotificationType.PRESCRIPTION_DISPENSED,
      title: 'Prescription Dispensed',
      message: `Medications dispensed for patient ${patientName} — ready for billing`,
      referenceType: 'prescription',
      referenceId: prescriptionId,
    });
  }

  async notifyNewOrder(orderType: string, patientName: string, orderId: string, facilityId?: string) {
    // Determine target roles based on order type
    let roleNames: string[];
    switch (orderType.toLowerCase()) {
      case 'lab':
      case 'laboratory':
        roleNames = ['lab technician', 'lab', 'laboratory'];
        break;
      case 'radiology':
      case 'imaging':
        roleNames = ['radiologist', 'radiology', 'radiographer'];
        break;
      default:
        roleNames = ['nurse', 'doctor'];
        break;
    }
    const userIds = await this.getUserIdsByRole(roleNames, facilityId);
    if (userIds.length === 0) return;
    await this.notifyMany(userIds, {
      facilityId,
      type: NotificationType.NEW_ORDER,
      title: `New ${orderType} Order`,
      message: `New ${orderType} order for patient ${patientName}`,
      referenceType: 'order',
      referenceId: orderId,
    });
  }

  async notifyBillReturned(doctorUserId: string, patientName: string, reason: string, encounterId: string, facilityId?: string) {
    await this.create({
      userId: doctorUserId,
      facilityId,
      type: NotificationType.BILL_RETURNED,
      title: 'Bill Returned',
      message: `Bill returned for patient ${patientName}: ${reason}`,
      referenceType: 'encounter',
      referenceId: encounterId,
    });
  }
}
