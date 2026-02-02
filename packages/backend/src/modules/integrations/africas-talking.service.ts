import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Africa's Talking SMS Service
 * 
 * Provides SMS capabilities for patient communication in Uganda/Africa:
 * - Send appointment reminders
 * - Lab results notifications
 * - Medication reminders
 * - Bulk SMS campaigns
 * 
 * Setup: Register at https://africastalking.com/
 * Environment: Set AFRICASTALKING_API_KEY and AFRICASTALKING_USERNAME
 * 
 * Pricing: ~0.02 USD per SMS in Uganda
 */

export interface SMSResult {
  success: boolean;
  messageId?: string;
  cost?: string;
  status: string;
  recipient: string;
}

export interface BulkSMSResult {
  sent: number;
  failed: number;
  results: SMSResult[];
}

@Injectable()
export class AfricasTalkingService {
  private readonly logger = new Logger(AfricasTalkingService.name);
  private readonly API_URL = 'https://api.africastalking.com/version1/messaging';
  private readonly SANDBOX_URL = 'https://api.sandbox.africastalking.com/version1/messaging';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Check if Africa's Talking is configured
   */
  isConfigured(): boolean {
    const apiKey = this.configService.get<string>('AFRICASTALKING_API_KEY');
    const username = this.configService.get<string>('AFRICASTALKING_USERNAME');
    return !!(apiKey && username);
  }

  /**
   * Send single SMS
   */
  async sendSMS(to: string, message: string, from?: string): Promise<SMSResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        status: 'Not configured',
        recipient: to,
      };
    }

    try {
      const apiKey = this.configService.get<string>('AFRICASTALKING_API_KEY')!;
      const username = this.configService.get<string>('AFRICASTALKING_USERNAME')!;
      const useSandbox = this.configService.get<string>('AFRICASTALKING_SANDBOX') === 'true';

      const url = useSandbox ? this.SANDBOX_URL : this.API_URL;
      const formattedPhone = this.formatPhoneNumber(to);

      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('to', formattedPhone);
      formData.append('message', message);
      if (from) {
        formData.append('from', from);
      }

      const response = await firstValueFrom(
        this.httpService.post(url, formData.toString(), {
          headers: {
            'apiKey': apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
        }),
      );

      const recipient = response.data.SMSMessageData?.Recipients?.[0];
      
      if (recipient) {
        return {
          success: recipient.status === 'Success',
          messageId: recipient.messageId,
          cost: recipient.cost,
          status: recipient.status,
          recipient: recipient.number,
        };
      }

      return {
        success: false,
        status: response.data.SMSMessageData?.Message || 'Unknown error',
        recipient: formattedPhone,
      };
    } catch (error: any) {
      this.logger.error('SMS send failed', error.message);
      return {
        success: false,
        status: error.message,
        recipient: to,
      };
    }
  }

  /**
   * Send bulk SMS to multiple recipients
   */
  async sendBulkSMS(recipients: string[], message: string, from?: string): Promise<BulkSMSResult> {
    if (!this.isConfigured()) {
      return {
        sent: 0,
        failed: recipients.length,
        results: recipients.map(r => ({
          success: false,
          status: 'Not configured',
          recipient: r,
        })),
      };
    }

    try {
      const apiKey = this.configService.get<string>('AFRICASTALKING_API_KEY')!;
      const username = this.configService.get<string>('AFRICASTALKING_USERNAME')!;
      const useSandbox = this.configService.get<string>('AFRICASTALKING_SANDBOX') === 'true';

      const url = useSandbox ? this.SANDBOX_URL : this.API_URL;
      const formattedPhones = recipients.map(p => this.formatPhoneNumber(p)).join(',');

      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('to', formattedPhones);
      formData.append('message', message);
      if (from) {
        formData.append('from', from);
      }

      const response = await firstValueFrom(
        this.httpService.post(url, formData.toString(), {
          headers: {
            'apiKey': apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
        }),
      );

      const recipientResults = response.data.SMSMessageData?.Recipients || [];
      const results: SMSResult[] = recipientResults.map((r: any) => ({
        success: r.status === 'Success',
        messageId: r.messageId,
        cost: r.cost,
        status: r.status,
        recipient: r.number,
      }));

      return {
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      };
    } catch (error: any) {
      this.logger.error('Bulk SMS failed', error.message);
      return {
        sent: 0,
        failed: recipients.length,
        results: recipients.map(r => ({
          success: false,
          status: error.message,
          recipient: r,
        })),
      };
    }
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(
    phone: string,
    patientName: string,
    appointmentDate: string,
    appointmentTime: string,
    doctorName?: string,
    hospitalName = 'the hospital',
  ): Promise<SMSResult> {
    const message = doctorName
      ? `Dear ${patientName}, this is a reminder for your appointment with Dr. ${doctorName} on ${appointmentDate} at ${appointmentTime}. Please arrive 15 mins early. - ${hospitalName}`
      : `Dear ${patientName}, this is a reminder for your appointment on ${appointmentDate} at ${appointmentTime}. Please arrive 15 mins early. - ${hospitalName}`;
    
    return this.sendSMS(phone, message);
  }

  /**
   * Send lab results notification
   */
  async sendLabResultsNotification(
    phone: string,
    patientName: string,
    hospitalName = 'the hospital',
  ): Promise<SMSResult> {
    const message = `Dear ${patientName}, your lab results are ready. Please visit ${hospitalName} to collect them or contact us for more information.`;
    return this.sendSMS(phone, message);
  }

  /**
   * Send medication reminder
   */
  async sendMedicationReminder(
    phone: string,
    patientName: string,
    medicationName: string,
    dosage: string,
    time: string,
  ): Promise<SMSResult> {
    const message = `Dear ${patientName}, it's time to take your medication: ${medicationName} (${dosage}). Take it now at ${time}.`;
    return this.sendSMS(phone, message);
  }

  /**
   * Send prescription ready notification
   */
  async sendPrescriptionReady(
    phone: string,
    patientName: string,
    pharmacyLocation = 'the pharmacy',
  ): Promise<SMSResult> {
    const message = `Dear ${patientName}, your prescription is ready for pickup at ${pharmacyLocation}. Please bring your ID.`;
    return this.sendSMS(phone, message);
  }

  /**
   * Send bill notification
   */
  async sendBillNotification(
    phone: string,
    patientName: string,
    amount: number,
    currency = 'UGX',
    dueDate?: string,
  ): Promise<SMSResult> {
    const dueText = dueDate ? ` due by ${dueDate}` : '';
    const message = `Dear ${patientName}, you have an outstanding bill of ${currency} ${amount.toLocaleString()}${dueText}. Please visit the billing desk to make payment.`;
    return this.sendSMS(phone, message);
  }

  /**
   * Get account balance (for monitoring)
   */
  async getBalance(): Promise<{ balance: string; currency: string } | null> {
    if (!this.isConfigured()) return null;

    try {
      const apiKey = this.configService.get<string>('AFRICASTALKING_API_KEY')!;
      const username = this.configService.get<string>('AFRICASTALKING_USERNAME')!;
      const useSandbox = this.configService.get<string>('AFRICASTALKING_SANDBOX') === 'true';

      const baseUrl = useSandbox 
        ? 'https://api.sandbox.africastalking.com' 
        : 'https://api.africastalking.com';

      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/version1/user?username=${username}`, {
          headers: {
            'apiKey': apiKey,
            'Accept': 'application/json',
          },
        }),
      );

      const balanceStr = response.data.UserData?.balance;
      if (balanceStr) {
        const match = balanceStr.match(/([A-Z]+)\s+([\d.]+)/);
        if (match) {
          return { currency: match[1], balance: match[2] };
        }
      }
      return null;
    } catch (error: any) {
      this.logger.error('Get balance failed', error.message);
      return null;
    }
  }

  /**
   * Format phone number to international format (Uganda)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle Uganda numbers
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      // Local Uganda format: 0751234567 -> +256751234567
      cleaned = '256' + cleaned.substring(1);
    } else if (cleaned.startsWith('256') && cleaned.length === 12) {
      // Already has country code
    } else if (cleaned.length === 9 && (cleaned.startsWith('7') || cleaned.startsWith('3'))) {
      // Missing leading 0: 751234567 -> +256751234567
      cleaned = '256' + cleaned;
    }
    
    return '+' + cleaned;
  }
}
