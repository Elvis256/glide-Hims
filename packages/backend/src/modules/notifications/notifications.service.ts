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
    if (!config.smsApiKey) {
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

  // WhatsApp Sending
  async sendWhatsApp(config: NotificationConfig, phone: string, message: string, templateName?: string): Promise<void> {
    if (!config.smsApiKey) {
      throw new Error('WhatsApp configuration incomplete');
    }

    switch (config.provider) {
      case NotificationProvider.WHATSAPP_CLOUD:
        await this.sendWhatsAppCloud(config, phone, message, templateName);
        break;
      case NotificationProvider.WHATSAPP_BUSINESS:
        await this.sendWhatsAppBusiness(config, phone, message);
        break;
      case NotificationProvider.TWILIO:
        await this.sendTwilioWhatsApp(config, phone, message);
        break;
      default:
        throw new Error('WhatsApp provider not configured');
    }
  }

  private async sendWhatsAppCloud(config: NotificationConfig, phone: string, message: string, templateName?: string): Promise<void> {
    // Meta WhatsApp Cloud API
    const phoneNumberId = config.extraConfig?.phoneNumberId;
    const accessToken = config.smsApiKey;

    if (!phoneNumberId) {
      throw new Error('WhatsApp Phone Number ID not configured');
    }

    // Format phone number (remove + and spaces)
    const formattedPhone = phone.replace(/[\s+\-]/g, '');

    const payload: any = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: templateName ? 'template' : 'text',
    };

    if (templateName) {
      payload.template = {
        name: templateName,
        language: { code: 'en' },
      };
    } else {
      payload.text = { body: message };
    }

    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`WhatsApp Cloud API failed: ${error.error?.message || response.statusText}`);
    }

    this.logger.log(`WhatsApp sent to ${phone} via Meta Cloud API`);
  }

  private async sendWhatsAppBusiness(config: NotificationConfig, phone: string, message: string): Promise<void> {
    // WhatsApp Business API (on-premise or third-party)
    const apiUrl = config.smsApiUrl || 'https://api.whatsapp.com/v1/messages';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.smsApiKey}`,
      },
      body: JSON.stringify({
        to: phone,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp Business API failed: ${response.statusText}`);
    }

    this.logger.log(`WhatsApp sent to ${phone} via Business API`);
  }

  private async sendTwilioWhatsApp(config: NotificationConfig, phone: string, message: string): Promise<void> {
    const auth = Buffer.from(`${config.smsApiKey}:${config.smsApiSecret}`).toString('base64');
    const accountSid = config.extraConfig?.accountSid || config.smsUsername;
    const fromNumber = config.smsSenderId || '';

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
      body: new URLSearchParams({
        To: `whatsapp:${phone}`,
        From: `whatsapp:${fromNumber}`,
        Body: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Twilio WhatsApp failed: ${response.statusText}`);
    }

    this.logger.log(`WhatsApp sent to ${phone} via Twilio`);
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
      const whatsappConfig = configs.find(c => c.type === NotificationType.WHATSAPP);

      const shouldSendEmail = (reminder.channel === ReminderChannel.EMAIL || reminder.channel === ReminderChannel.BOTH || reminder.channel === ReminderChannel.ALL);
      const shouldSendSms = (reminder.channel === ReminderChannel.SMS || reminder.channel === ReminderChannel.BOTH || reminder.channel === ReminderChannel.ALL);
      const shouldSendWhatsApp = (reminder.channel === ReminderChannel.WHATSAPP || reminder.channel === ReminderChannel.ALL);

      // Send Email
      if (shouldSendEmail && emailConfig?.isEnabled && patient.email) {
        await this.sendEmail(emailConfig, patient.email, reminder.subject, reminder.message);
      }

      // Send SMS
      if (shouldSendSms && smsConfig?.isEnabled && patient.phone) {
        await this.sendSms(smsConfig, patient.phone, reminder.message);
      }

      // Send WhatsApp
      if (shouldSendWhatsApp && whatsappConfig?.isEnabled && patient.phone) {
        await this.sendWhatsApp(whatsappConfig, patient.phone, reminder.message);
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

  // Template Management
  async getTemplates(facilityId: string): Promise<any[]> {
    // Return default templates for now (templates would be stored in DB)
    return [
      {
        id: 'default-appointment',
        facilityId,
        type: 'appointment',
        name: 'Appointment Reminder',
        smsTemplate: 'Dear {patientName}, this is a reminder for your appointment on {appointmentDate} at {appointmentTime}. - {hospitalName}',
        isActive: true,
      },
      {
        id: 'default-lab_result',
        facilityId,
        type: 'lab_result',
        name: 'Lab Results Ready',
        smsTemplate: 'Dear {patientName}, your lab results are ready at {hospitalName}. Please visit to collect them.',
        isActive: true,
      },
      {
        id: 'default-prescription',
        facilityId,
        type: 'prescription_ready',
        name: 'Prescription Ready',
        smsTemplate: 'Dear {patientName}, your prescription is ready for pickup at {hospitalName} pharmacy.',
        isActive: true,
      },
      {
        id: 'default-thank_you',
        facilityId,
        type: 'thank_you',
        name: 'Thank You',
        smsTemplate: 'Thank you for visiting {hospitalName}, {patientName}. We wish you good health!',
        isActive: true,
      },
    ];
  }

  async createTemplate(dto: any): Promise<any> {
    // For now, return the template with a generated ID
    return { ...dto, id: `template-${Date.now()}` };
  }

  async updateTemplate(id: string, dto: any): Promise<any> {
    return { ...dto, id };
  }

  async deleteTemplate(id: string): Promise<{ success: boolean }> {
    return { success: true };
  }

  // Bulk Messaging
  async sendBulkMessages(
    dto: { facilityId: string; patientIds: string[]; channel: string; subject?: string; message: string; type: string },
    userId?: string,
  ): Promise<{ sent: number; failed: number; errors: string[] }> {
    const { facilityId, patientIds, channel, subject, message, type } = dto;
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    const configs = await this.getConfig(facilityId);
    const smsConfig = configs.find(c => c.type === NotificationType.SMS && c.isEnabled);
    const emailConfig = configs.find(c => c.type === NotificationType.EMAIL && c.isEnabled);
    const whatsappConfig = configs.find(c => c.type === NotificationType.WHATSAPP && c.isEnabled);

    for (const patientId of patientIds) {
      try {
        const patient = await this.patientRepo.findOne({ where: { id: patientId } });
        if (!patient) {
          errors.push(`Patient ${patientId} not found`);
          failed++;
          continue;
        }

        let messageSent = false;

        // Send SMS
        if ((channel === 'sms' || channel === 'all') && smsConfig && patient.phone) {
          try {
            await this.sendSms(smsConfig, patient.phone, message);
            messageSent = true;
          } catch (e) {
            this.logger.warn(`SMS failed for ${patient.phone}: ${e.message}`);
          }
        }

        // Send WhatsApp
        if ((channel === 'whatsapp' || channel === 'all') && whatsappConfig && patient.phone) {
          try {
            await this.sendWhatsApp(whatsappConfig, patient.phone, message);
            messageSent = true;
          } catch (e) {
            this.logger.warn(`WhatsApp failed for ${patient.phone}: ${e.message}`);
          }
        }

        // Send Email
        if ((channel === 'email' || channel === 'all') && emailConfig && patient.email) {
          try {
            await this.sendEmail(emailConfig, patient.email, subject || 'Message from Hospital', message);
            messageSent = true;
          } catch (e) {
            this.logger.warn(`Email failed for ${patient.email}: ${e.message}`);
          }
        }

        if (messageSent) {
          // Log the reminder
          const reminder = this.reminderRepo.create({
            facilityId,
            patientId,
            type: ReminderType.CUSTOM,
            channel: channel === 'all' ? ReminderChannel.ALL : (channel as ReminderChannel),
            subject: subject || 'Bulk Message',
            message,
            scheduledFor: new Date(),
            status: ReminderStatus.SENT,
            sentAt: new Date(),
            createdById: userId,
          });
          await this.reminderRepo.save(reminder);
          sent++;
        } else {
          errors.push(`No valid contact for patient ${patient.fullName}`);
          failed++;
        }
      } catch (error) {
        errors.push(`Error for patient ${patientId}: ${error.message}`);
        failed++;
      }
    }

    this.logger.log(`Bulk message completed: ${sent} sent, ${failed} failed`);
    return { sent, failed, errors: errors.slice(0, 10) }; // Limit errors to 10
  }
}
