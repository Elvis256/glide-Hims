import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InAppNotification,
  InAppNotificationType,
} from '../../database/entities/in-app-notification.entity';
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
  async create(dto: CreateNotificationDto, tenantId?: string): Promise<InAppNotification> {
    const notification = this.notifRepo.create({
      ...dto,
      ...(tenantId ? { tenantId } : {}),
    });
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
  async notifyMany(
    userIds: string[],
    base: Omit<CreateNotificationDto, 'targetUserId'>,
    tenantId?: string,
  ): Promise<void> {
    const unique = [...new Set(userIds)];
    for (const targetUserId of unique) {
      await this.create({ ...base, targetUserId }, tenantId);
    }
  }

  /** Find users by role name(s) within a facility */
  async getUserIdsByRole(
    roleNames: string[],
    facilityId?: string,
    tenantId?: string,
  ): Promise<string[]> {
    const roleQb = this.roleRepo
      .createQueryBuilder('role')
      .where('LOWER(role.name) IN (:...names)', {
        names: roleNames.map((n) => n.toLowerCase()),
      });

    if (tenantId) {
      roleQb.andWhere('(role.tenant_id = :tenantId OR role.is_system_role = true)', { tenantId });
    }

    const roles = await roleQb.getMany();

    if (roles.length === 0) return [];

    const qb = this.userRoleRepo
      .createQueryBuilder('ur')
      .select('DISTINCT ur.userId', 'userId')
      .where('ur.roleId IN (:...roleIds)', { roleIds: roles.map((r) => r.id) });

    if (facilityId) {
      qb.andWhere('(ur.facilityId = :facilityId OR ur.facilityId IS NULL)', { facilityId });
    }

    if (tenantId) {
      qb.andWhere('ur.tenantId = :tenantId', { tenantId });
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

  async markRead(id: string, userId: string, tenantId?: string): Promise<void> {
    const where: any = { id, targetUserId: userId };
    if (tenantId) where.tenantId = tenantId;
    await this.notifRepo.update(where, { isRead: true, readByUserId: userId, readAt: new Date() });
  }

  async markAllRead(userId: string, tenantId?: string): Promise<void> {
    const where: any = { targetUserId: userId, isRead: false };
    if (tenantId) where.tenantId = tenantId;
    await this.notifRepo.update(where, { isRead: true, readByUserId: userId, readAt: new Date() });
  }

  // ─── Convenience helpers for domain events ───────────────────────────

  async notifyLabResultReady(
    orderedByUserId: string,
    patientName: string,
    testName: string,
    sampleId: string,
    facilityId?: string,
    tenantId?: string,
  ) {
    await this.create(
      {
        targetUserId: orderedByUserId,
        facilityId,
        type: InAppNotificationType.LAB_RESULT_READY,
        title: 'Lab Result Ready',
        message: `Results for ${testName} are ready for patient ${patientName}`,
        metadata: { referenceType: 'lab_sample', referenceId: sampleId },
      },
      tenantId,
    );
  }

  async notifyRadiologyResultReady(
    orderedByUserId: string,
    patientName: string,
    studyType: string,
    orderId: string,
    facilityId?: string,
    tenantId?: string,
  ) {
    await this.create(
      {
        targetUserId: orderedByUserId,
        facilityId,
        type: InAppNotificationType.RADIOLOGY_RESULT_READY,
        title: 'Radiology Report Ready',
        message: `${studyType} report is ready for patient ${patientName}`,
        metadata: { referenceType: 'imaging_order', referenceId: orderId },
      },
      tenantId,
    );
  }

  async notifyNewPrescription(
    patientName: string,
    prescriptionId: string,
    facilityId?: string,
    tenantId?: string,
  ) {
    const pharmacistIds = await this.getUserIdsByRole(['pharmacist', 'pharmacy'], facilityId);
    if (pharmacistIds.length === 0) return;
    await this.notifyMany(
      pharmacistIds,
      {
        facilityId,
        type: InAppNotificationType.PRESCRIPTION_CREATED,
        title: 'New Prescription',
        message: `New prescription for patient ${patientName}`,
        metadata: { referenceType: 'prescription', referenceId: prescriptionId },
      },
      tenantId,
    );
  }

  async notifyPrescriptionDispensed(
    patientName: string,
    prescriptionId: string,
    facilityId?: string,
    tenantId?: string,
  ) {
    const cashierIds = await this.getUserIdsByRole(
      ['cashier', 'billing', 'biller', 'receptionist'],
      facilityId,
    );
    if (cashierIds.length === 0) return;
    await this.notifyMany(
      cashierIds,
      {
        facilityId,
        type: InAppNotificationType.PRESCRIPTION_DISPENSED,
        title: 'Prescription Dispensed',
        message: `Medications dispensed for patient ${patientName} — ready for billing`,
        metadata: { referenceType: 'prescription', referenceId: prescriptionId },
      },
      tenantId,
    );
  }

  async notifyNewOrder(
    orderType: string,
    patientName: string,
    orderId: string,
    facilityId?: string,
    tenantId?: string,
  ) {
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
    await this.notifyMany(
      userIds,
      {
        facilityId,
        type,
        title: `New ${orderType} Order`,
        message: `New ${orderType} order for patient ${patientName}`,
        metadata: { referenceType: 'order', referenceId: orderId },
      },
      tenantId,
    );
  }

  async notifyBillReturned(
    doctorUserId: string,
    patientName: string,
    reason: string,
    encounterId: string,
    facilityId?: string,
    tenantId?: string,
  ) {
    await this.create(
      {
        targetUserId: doctorUserId,
        facilityId,
        type: InAppNotificationType.ENCOUNTER_STATUS_CHANGED,
        title: 'Bill Returned',
        message: `Bill returned for patient ${patientName}: ${reason}`,
        metadata: { referenceType: 'encounter', referenceId: encounterId },
      },
      tenantId,
    );
  }

  /** Patient added to a queue — notify the assigned doctor, or all on-duty
   * doctors of the target department if no specific doctor was picked. */
  async notifyPatientQueued(opts: {
    patientName: string;
    ticketNumber?: string;
    queueId: string;
    servicePoint: string;
    assignedDoctorId?: string | null;
    departmentRoleHints?: string[];
    facilityId?: string;
    tenantId?: string;
  }) {
    const {
      patientName,
      ticketNumber,
      queueId,
      servicePoint,
      assignedDoctorId,
      departmentRoleHints,
      facilityId,
      tenantId,
    } = opts;

    const title = ticketNumber ? `New Patient in Queue (${ticketNumber})` : 'New Patient in Queue';
    const message = `${patientName} is waiting at ${servicePoint}`;
    const base = {
      facilityId,
      type: InAppNotificationType.PATIENT_QUEUED,
      title,
      message,
      metadata: { referenceType: 'queue', referenceId: queueId, ticketNumber, servicePoint },
    };

    if (assignedDoctorId) {
      await this.create({ ...base, targetUserId: assignedDoctorId }, tenantId);
      return;
    }
    const roles =
      departmentRoleHints && departmentRoleHints.length ? departmentRoleHints : ['doctor'];
    const userIds = await this.getUserIdsByRole(roles, facilityId, tenantId);
    if (userIds.length === 0) return;
    await this.notifyMany(userIds, base, tenantId);
  }

  /** New invoice created — notify cashiers on duty (used for pay-at-billing). */
  async notifyInvoiceCreated(opts: {
    invoiceId: string;
    invoiceNumber: string;
    patientName?: string;
    totalAmount: number;
    facilityId?: string;
    tenantId?: string;
  }) {
    const { invoiceId, invoiceNumber, patientName, totalAmount, facilityId, tenantId } = opts;
    const userIds = await this.getUserIdsByRole(
      ['cashier', 'billing', 'reception'],
      facilityId,
      tenantId,
    );
    if (userIds.length === 0) return;
    await this.notifyMany(
      userIds,
      {
        facilityId,
        type: InAppNotificationType.INVOICE_CREATED,
        title: `New Bill: ${invoiceNumber}`,
        message: patientName
          ? `${patientName} — UGX ${Number(totalAmount || 0).toLocaleString()}`
          : `Amount UGX ${Number(totalAmount || 0).toLocaleString()}`,
        metadata: { referenceType: 'invoice', referenceId: invoiceId, invoiceNumber },
      },
      tenantId,
    );
  }

  /** Payment received — tell the queued doctor the patient has cleared billing. */
  async notifyPaymentCleared(opts: {
    doctorUserId: string;
    patientName: string;
    invoiceNumber: string;
    amount: number;
    facilityId?: string;
    tenantId?: string;
  }) {
    const { doctorUserId, patientName, invoiceNumber, amount, facilityId, tenantId } = opts;
    await this.create(
      {
        targetUserId: doctorUserId,
        facilityId,
        type: InAppNotificationType.ENCOUNTER_STATUS_CHANGED,
        title: 'Patient Cleared Billing',
        message: `${patientName} paid UGX ${Number(amount || 0).toLocaleString()} (${invoiceNumber}) and is now in your queue.`,
        metadata: { referenceType: 'invoice', invoiceNumber, amount },
      },
      tenantId,
    );
  }

  /** Patient transferred to another service point — notify staff there. */
  async notifyPatientTransferred(opts: {
    queueId: string;
    patientName: string;
    fromServicePoint: string;
    toServicePoint: string;
    reason?: string;
    facilityId?: string;
    tenantId?: string;
  }) {
    const { queueId, patientName, fromServicePoint, toServicePoint, reason, facilityId, tenantId } =
      opts;
    const roleMap: Record<string, string[]> = {
      laboratory: ['lab technician', 'lab', 'laboratory'],
      radiology: ['radiologist', 'radiology', 'radiographer'],
      pharmacy: ['pharmacist', 'pharmacy'],
      billing: ['cashier', 'billing', 'reception'],
      cashier: ['cashier', 'billing'],
      triage: ['nurse', 'triage'],
      vitals: ['nurse', 'triage'],
      consultation: ['doctor'],
      injection: ['nurse'],
      dressing: ['nurse'],
    };
    const roles = roleMap[toServicePoint.toLowerCase()] || ['nurse', 'doctor'];
    const userIds = await this.getUserIdsByRole(roles, facilityId, tenantId);
    if (userIds.length === 0) return;
    await this.notifyMany(
      userIds,
      {
        facilityId,
        type: InAppNotificationType.PATIENT_TRANSFERRED,
        title: `Incoming: ${patientName}`,
        message: reason
          ? `Transferred from ${fromServicePoint} → ${toServicePoint}. Reason: ${reason}`
          : `Transferred from ${fromServicePoint} → ${toServicePoint}.`,
        metadata: {
          referenceType: 'queue',
          referenceId: queueId,
          fromServicePoint,
          toServicePoint,
        },
      },
      tenantId,
    );
  }

  /** Patient called — broadcast to waiting-room display users (and counter staff
   * subscribed to the service point). */
  async notifyPatientCalled(opts: {
    queueId: string;
    patientName: string;
    ticketNumber?: string;
    servicePoint: string;
    counterNumber?: string;
    roomNumber?: string;
    facilityId?: string;
    tenantId?: string;
  }) {
    const {
      queueId,
      patientName,
      ticketNumber,
      servicePoint,
      counterNumber,
      roomNumber,
      facilityId,
      tenantId,
    } = opts;
    const location = roomNumber
      ? `Room ${roomNumber}`
      : counterNumber
        ? `Counter ${counterNumber}`
        : servicePoint;
    const userIds = await this.getUserIdsByRole(
      ['queue display', 'receptionist', 'reception'],
      facilityId,
      tenantId,
    );
    if (userIds.length === 0) return;
    await this.notifyMany(
      userIds,
      {
        facilityId,
        type: InAppNotificationType.PATIENT_CALLED,
        title: ticketNumber ? `Now Serving ${ticketNumber}` : 'Now Serving',
        message: `${patientName} → ${location}`,
        metadata: {
          referenceType: 'queue',
          referenceId: queueId,
          ticketNumber,
          servicePoint,
          counterNumber,
          roomNumber,
        },
      },
      tenantId,
    );
  }
}
