import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InAppNotification,
  InAppNotificationType,
} from '../../database/entities/in-app-notification.entity';
import { NotificationGateway } from './notification.gateway';
import { CreateInAppNotificationDto } from './dto/in-app-notification.dto';

@Injectable()
export class InAppNotificationService {
  private readonly logger = new Logger(InAppNotificationService.name);

  constructor(
    @InjectRepository(InAppNotification)
    private readonly notificationRepo: Repository<InAppNotification>,
    private readonly gateway: NotificationGateway,
  ) {}

  /**
   * Create a notification and push it via WebSocket
   */
  async create(dto: CreateInAppNotificationDto): Promise<InAppNotification> {
    const notification = this.notificationRepo.create(dto);
    const saved = await this.notificationRepo.save(notification);

    const payload = {
      id: saved.id,
      type: saved.type,
      title: saved.title,
      message: saved.message,
      metadata: saved.metadata,
      senderName: saved.senderName,
      createdAt: saved.createdAt,
      isRead: false,
    };

    // Push to the right audience
    if (dto.targetUserId) {
      this.gateway.sendToUser(dto.targetUserId, 'notification', payload);
    }
    if (dto.targetDepartmentId) {
      this.gateway.sendToDepartmentOnly(
        dto.targetDepartmentId,
        'notification',
        payload,
      );
    }
    // Always send to facility room so everyone in the facility can see it
    this.gateway.sendToFacility(dto.facilityId, 'notification', payload);

    this.logger.log(
      `Notification created: ${dto.type} → dept=${dto.targetDepartmentId || 'all'}, user=${dto.targetUserId || 'all'}`,
    );

    return saved;
  }

  /**
   * Create notification without blocking the caller (fire-and-forget)
   */
  notify(dto: CreateInAppNotificationDto): void {
    this.create(dto).catch((err) => {
      this.logger.error(`Failed to create notification: ${err.message}`);
    });
  }

  /**
   * Get notifications for a user (their personal + their department + facility-wide)
   */
  async getUserNotifications(
    userId: string,
    facilityId: string,
    departmentId?: string,
    limit = 50,
    offset = 0,
  ) {
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.facility_id = :facilityId', { facilityId });

    if (departmentId) {
      qb.andWhere(
        '(n.target_user_id = :userId OR n.target_department_id = :departmentId OR (n.target_user_id IS NULL AND n.target_department_id IS NULL))',
        { userId, departmentId },
      );
    } else {
      qb.andWhere(
        '(n.target_user_id = :userId OR (n.target_user_id IS NULL AND n.target_department_id IS NULL))',
        { userId },
      );
    }

    qb.orderBy('n.created_at', 'DESC').take(limit).skip(offset);

    const [notifications, total] = await qb.getManyAndCount();
    return { notifications, total };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(
    userId: string,
    facilityId: string,
    departmentId?: string,
  ): Promise<number> {
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.facility_id = :facilityId', { facilityId })
      .andWhere('n.is_read = false');

    if (departmentId) {
      qb.andWhere(
        '(n.target_user_id = :userId OR n.target_department_id = :departmentId OR (n.target_user_id IS NULL AND n.target_department_id IS NULL))',
        { userId, departmentId },
      );
    } else {
      qb.andWhere(
        '(n.target_user_id = :userId OR (n.target_user_id IS NULL AND n.target_department_id IS NULL))',
        { userId },
      );
    }

    return qb.getCount();
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(id: string, userId: string): Promise<void> {
    await this.notificationRepo.update(id, {
      isRead: true,
      readByUserId: userId,
      readAt: new Date(),
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(
    userId: string,
    facilityId: string,
    departmentId?: string,
  ): Promise<void> {
    const qb = this.notificationRepo
      .createQueryBuilder()
      .update(InAppNotification)
      .set({ isRead: true, readByUserId: userId, readAt: new Date() })
      .where('facility_id = :facilityId', { facilityId })
      .andWhere('is_read = false');

    if (departmentId) {
      qb.andWhere(
        '(target_user_id = :userId OR target_department_id = :departmentId OR (target_user_id IS NULL AND target_department_id IS NULL))',
        { userId, departmentId },
      );
    } else {
      qb.andWhere(
        '(target_user_id = :userId OR (target_user_id IS NULL AND target_department_id IS NULL))',
        { userId },
      );
    }

    await qb.execute();
  }
}
