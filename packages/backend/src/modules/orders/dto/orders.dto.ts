import { IsString, IsOptional, IsEnum, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType, OrderPriority, OrderStatus } from '../../../database/entities/order.entity';

class TestCodeDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  sampleType?: string;
}

export class CreateOrderDto {
  @IsUUID()
  encounterId: string;

  @IsEnum(OrderType)
  orderType: OrderType;

  @IsOptional()
  @IsEnum(OrderPriority)
  priority?: OrderPriority;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCodeDto)
  testCodes?: TestCodeDto[];
}

export class UpdateOrderStatusDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}

export class CompleteOrderDto {
  @IsOptional()
  @IsString()
  resultSummary?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// Lab-specific DTOs
export class LabResultDto {
  @IsString()
  testCode: string;

  @IsString()
  testName: string;

  @IsString()
  resultValue: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  referenceRange?: string;

  @IsOptional()
  @IsString()
  abnormalFlag?: 'high' | 'low' | 'critical' | 'normal';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitLabResultsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabResultDto)
  results: LabResultDto[];

  @IsOptional()
  @IsString()
  interpretation?: string;
}

// Radiology-specific DTOs
export class SubmitRadiologyReportDto {
  @IsString()
  findings: string;

  @IsOptional()
  @IsString()
  impression?: string;

  @IsOptional()
  @IsString()
  recommendation?: string;
}
