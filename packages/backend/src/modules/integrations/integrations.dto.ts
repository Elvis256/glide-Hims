import { IsString, IsOptional, IsArray, IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckDrugInteractionsDto {
  @IsArray()
  @IsString({ each: true })
  drugs: string[];
}

export class SendSmsDto {
  @IsString() @IsNotEmpty() to: string;
  @IsString() @IsNotEmpty() message: string;
  @IsOptional() @IsString() from?: string;
}

export class SendBulkSmsDto {
  @IsArray()
  @IsString({ each: true })
  recipients: string[];

  @IsString() @IsNotEmpty() message: string;
  @IsOptional() @IsString() from?: string;
}

export class SendAppointmentReminderDto {
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsNotEmpty() patientName: string;
  @IsString() @IsNotEmpty() appointmentDate: string;
  @IsString() @IsNotEmpty() appointmentTime: string;
  @IsOptional() @IsString() doctorName?: string;
  @IsOptional() @IsString() hospitalName?: string;
}

export class SendLabResultsNotificationDto {
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsNotEmpty() patientName: string;
  @IsOptional() @IsString() hospitalName?: string;
}

export class SendPrescriptionReadyDto {
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsNotEmpty() patientName: string;
  @IsOptional() @IsString() pharmacyLocation?: string;
}

export class CheckLabValueDto {
  @IsString() @IsNotEmpty() loincCode: string;
  @IsNumber() @Type(() => Number) value: number;
}
