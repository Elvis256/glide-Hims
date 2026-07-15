import { IsUUID, IsString, IsNumber, IsOptional, IsIn, IsDateString, IsObject } from 'class-validator';

export class CreateIntakeOutputDto {
  @IsUUID()
  admissionId: string;

  @IsDateString()
  timestamp: string;

  @IsIn(['intake', 'output'])
  type: 'intake' | 'output';

  @IsString()
  category: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsObject()
  characteristics?: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryIntakeOutputDto {
  @IsOptional()
  @IsUUID()
  admissionId?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}
