import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { NotificationConfig, NotificationType, NotificationProvider } from '../../database/entities/notification-config.entity';
import { PatientReminder, ReminderStatus, ReminderChannel, ReminderType } from '../../database/entities/patient-reminder.entity';
import { Patient } from '../../database/entities/patient.entity';
import { CreateNotificationConfigDto, SendReminderDto, ScheduleReminderDto, TestNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationConfig)
    private configRepo: Repository<NotificationConfig>,
    @InjectRepository(PatientReminder)
    private reminderRepo: Repository<PatientReminder>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
  ) {}

  // Configuration Management
  async getConfig(facilityId: string, type?: NotificationType): Promise<NotificationConfig[]> {
    const where: any = { facilityId };
    if (type) where.type = type;
    return this.configRepo.find({ where });
  }

  async createOrUpdateConfig(dto: CreateNotificationConfigDto): Promise<NotificationConfig> {
    let config = await this.configRepo.findOne({
      where: { facilityId: dto.facilityId, type: dto.type },
    });

    if (config) {
      Object.assign(config, dto);
    } else {
      config = this.configRepo.create(dto);
    }

    return this.configRepo.save(config);
  }

  async testConfiguration(dto: TestNotificationDto): Promise<{ success: boolean; message: string }> {
    const configs = await this.getConfig(dto.facilityId, dto.type);
    const config = configs[0];

    if (!config) {
      return { success: false, message: 'No configuration found' };
    }

    try {
      if (dto.type === NotificationType.EMAIL || dto.type === NotificationType.BOTH) {
        if (dto.testEmail) {
          await this.sendEmail(config, dto.testEmail, 'Test Email', 'This is a test email from HIMS.');
        }
      }

      if (dto.type === NotificationType.SMS || dto.type === NotificationType.BOTH) {
        if (dto.testPhone) {
          await this.sendSms(config, dto.testPhone, 'Test SMS from HIMS');
        }
      }

      // Update test status
      config.lastTestedAt = new Date();
      config.testSuccessful = true;
      await this.configRepo.save(config);

      return { success: true, message: 'Test notification sent successfully' };
    } catch (error) {
      config.lastTestedAt = new Date();
      config.testSuccessful = false;
      await this.configRepo.save(config);

      return { success: false, message: error.message };
    }
  }

  // Email Sending
  async sendEmail(config: NotificationConfig, to: string, subject: string, body: string): Promise<void> {
    if (!config.smtpHost || !config.smtpUser) {
      throw new Error('SMTP configuration incomplete');
    }

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
    });

    await transporter.sendMail({
      from: `"${config.fromName || 'HIMS'}" <${config.fromEmail || config.smtpUser}>`,
      to,
      subject,
      html: body,
    });

    this.logger.log(`Email sent to ${to}`);
  }

  // SMS Sending
  async sendSms(config: NotificationConfig, phone: string, message: string): Promise<void> {
    if (!config.smsApiUrl || !config.smsApiKey) {
      throw new Error('SMS configuration incomplete');
    }

    // Support multiple SMS providers
    switch (config.provider) {
      case NotificationProvider.AFRICAS_TALKING:
        await this.sendAfricasTalkingSms(config, phone, message);
        break;
      case NotificationProvider.TWILIO:
        await this.sendTwilioSms(config, phone, message);
        break;
      default:
        await this.sendGenericSms(config, phone, message);
    }
  }

  private async sendAfricasTalkingSms(config: NotificationConfig, phone: string, message: string): Promise<void> {
    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': config.smsApiKey!,
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        username: config.smsUsername || 'sandbox',
        to: phone,
        message,
        from: config.smsSenderId || '',
      }),
    });

    if (!response.ok) {
      throw new Error(`Africa's Talking SMS failed: ${response.statusText}`);
    }

    this.logger.log(`SMS sent to ${phone} via Africa's Talking`);
  }

  private async sendTwilioSms(config: NotificationConfig, phone: string, message: string): Promise<void> {
    const auth = Buffer.from(`${config.smsApiKey}:${config.smsApiSecret}`).toString('base64');
    const accountSid = config.extraConfig?.accountSid || config.smsUsername;

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
      body: new URLSearchParams({
        To: phone,
        From: config.smsSenderId || '',
        Body: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Twilio SMS failed: ${response.statusText}`);
    }

    this.logger.log(`SMS sent to ${phone} via Twilio`);
  }

  private async sendGenericSms(config: NotificationConfig, phone: string, message: string): Promise<void> {
    // Generic SMS API - customize based on provider
    const response = await fetch(config.smsApiUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.smsApiKey}`,
      },
      body: JSON.stringify({
        to: phone,
        message,
        from: config.smsSenderId,
        ...config.extraConfig,
      }),
    });

    if (!response.ok) {
      throw new Error(`SMS API failed: ${response.statusText}`);
    }

    this.logger.log(`SMS sent to ${phone} via custom provider`);
  }

  // Reminder Management
  async sendImmediateReminder(facilityId: string, dto: SendReminderDto, userId?: string): Promise<PatientReminder> {
    const patient = await this.patientRepo.findOne({ where: { id: dto.patientId } });
    if (!patient) throw new Error('Patient not found');

    const reminder = this.reminderRepo.create({
      facilityId,
      patientId: dto.patientId,
      type: dto.type,
      channel: dto.channel,
      subject: dto.subject,
      message: dto.message,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      scheduledFor: new Date(),
      createdById: userId,
    });

    await this.reminderRepo.save(reminder);

    // Send immediately
    await this.processReminder(reminder);

    return reminder;
  }

  async scheduleReminder(facilityId: string, dto: ScheduleReminderDto, userId?: string): Promise<PatientReminder> {
    const reminder = this.reminderRepo.create({
      facilityId,
      ...dto,
      createdById: userId,
    });

    return this.reminderRepo.save(reminder);
  }

  async processReminder(reminder: PatientReminder): Promise<void> {
    try {
      const configs = await this.getConfig(reminder.facilityId);
      const patient = reminder.patient || await this.patientRepo.findOne({ where: { id: reminder.patientId } });

      if (!patient) {
        throw new Error('Patient not found');
      }

      const emailConfig = configs.find(c => c.type === NotificationType.EMAIL || c.type === NotificationType.BOTH);
      const smsConfig = configs.find(c => c.type === NotificationType.SMS || c.type === NotificationType.BOTH);

      // Send Email
      if ((reminder.channel === ReminderChannel.EMAIL || reminder.channel === ReminderChannel.BOTH) && emailConfig?.isEnabled && patient.email) {
        await this.sendEmail(emailConfig, patient.email, reminder.subject, reminder.message);
      }

      // Send SMS
      if ((reminder.channel === ReminderChannel.SMS || reminder.channel === ReminderChannel.BOTH) && smsConfig?.isEnabled && patient.phone) {
        await this.sendSms(smsConfig, patient.phone, reminder.message);
      }

      reminder.status = ReminderStatus.SENT;
      reminder.sentAt = new Date();
    } catch (error) {
      reminder.status = ReminderStatus.FAILED;
      reminder.errorMessage = error.message;
      reminder.retryCount++;
      this.logger.error(`Failed to send reminder ${reminder.id}: ${error.message}`);
    }

    await this.reminderRepo.save(reminder);
  }

  // Process pending reminders (called by cron job)
  async processPendingReminders(): Promise<number> {
    const now = new Date();
    const pendingReminders = await this.reminderRepo.find({
      where: {
        status: ReminderStatus.PENDING,
        scheduledFor: LessThanOrEqual(now),
      },
      take: 100,
    });

    for (const reminder of pendingReminders) {
      await this.processReminder(reminder);
    }

    return pendingReminders.length;
  }

  async getReminderHistory(facilityId: string, patientId?: string, limit = 50): Promise<PatientReminder[]> {
    const where: any = { facilityId };
    if (patientId) where.patientId = patientId;

    return this.reminderRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async cancelReminder(id: string): Promise<PatientReminder> {
    const reminder = await this.reminderRepo.findOne({ where: { id } });
    if (!reminder) throw new Error('Reminder not found');
    
    reminder.status = ReminderStatus.CANCELLED;
    return this.reminderRepo.save(reminder);
  }

  // Send thank you message after patient visit/payment
  async sendThankYouMessage(
    facilityId: string,
    patientId: string,
    patientName: string,
    receiptNumber?: string,
  ): Promise<{ success: boolean; channel?: string; error?: string }> {
    try {
      const patient = await this.patientRepo.findOne({ where: { id: patientId } });
      if (!patient) {
        return { success: false, error: 'Patient not found' };
      }

      const configs = await this.getConfig(facilityId);
      const smsConfig = configs.find(c => c.type === NotificationType.SMS && c.isEnabled);
      const emailConfig = configs.find(c => c.type === NotificationType.EMAIL && c.isEnabled);

      // Construct thank you message
      const hospitalName = smsConfig?.fromName || emailConfig?.fromName || 'Our Hospital';
      const smsMessage = `Dear ${patientName}, thank you for visiting ${hospitalName}. We wish you good health! ${receiptNumber ? `Receipt: ${receiptNumber}` : ''}`;
      
      const emailSubject = `Thank you for visiting ${hospitalName}`;
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e11d48;">Thank You for Your Visit!</h2>
          <p>Dear ${patientName},</p>
          <p>We sincerely thank you for choosing <strong>${hospitalName}</strong> for your healthcare needs.</p>
          ${receiptNumber ? `<p>Your receipt number: <strong>${receiptNumber}</strong></p>` : ''}
          <p>We wish you good health and a speedy recovery. If you have any concerns, please don't hesitate to contact us.</p>
          <br/>
          <p>Best regards,<br/><strong>${hospitalName}</strong></p>
        </div>
      `;

      let channelUsed = '';

      // Try SMS first (preferred for immediate delivery)
      if (smsConfig && patient.phone) {
        try {
          await this.sendSms(smsConfig, patient.phone, smsMessage);
          channelUsed = 'sms';
          this.logger.log(`Thank you SMS sent to patient ${patientId}`);
        } catch (smsError) {
          this.logger.warn(`SMS failed for patient ${patientId}: ${smsError.message}`);
        }
      }

      // Also send email if available
      if (emailConfig && patient.email) {
        try {
          await this.sendEmail(emailConfig, patient.email, emailSubject, emailBody);
          channelUsed = channelUsed ? 'both' : 'email';
          this.logger.log(`Thank you email sent to patient ${patientId}`);
        } catch (emailError) {
          this.logger.warn(`Email failed for patient ${patientId}: ${emailError.message}`);
        }
      }

      if (!channelUsed) {
        return { success: false, error: 'No notification channel available or configured' };
      }

      // Log the reminder for history
      const reminder = this.reminderRepo.create({
        facilityId,
        patientId,
        type: ReminderType.THANK_YOU,
        channel: channelUsed === 'both' ? ReminderChannel.BOTH : (channelUsed === 'sms' ? ReminderChannel.SMS : ReminderChannel.EMAIL),
        subject: emailSubject,
        message: smsMessage,
        referenceType: 'payment',
        referenceId: receiptNumber,
        scheduledFor: new Date(),
        status: ReminderStatus.SENT,
        sentAt: new Date(),
      });
      await this.reminderRepo.save(reminder);

      return { success: true, channel: channelUsed };
    } catch (error) {
      this.logger.error(`Failed to send thank you message: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
