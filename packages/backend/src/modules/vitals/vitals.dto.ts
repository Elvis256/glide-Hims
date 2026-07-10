import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsDateString,
  MaxLength,
  Min,
  Max,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';

@ValidatorConstraint({ name: 'NotInFuture', async: false })
class NotInFutureConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    if (value == null) return true;
    const t = new Date(value).getTime();
    if (!Number.isFinite(t)) return false;
    // Allow up to 5 minutes clock skew
    return t <= Date.now() + 5 * 60 * 1000;
  }
  defaultMessage() {
    return 'recordedAt must not be in the future';
  }
}

export class CreateVitalDto {
  @IsUUID()
  encounterId: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(32)
  @Max(45)
  temperature?: number; // Celsius

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(20)
  @Max(250)
  pulse?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(50)
  @Max(300)
  bpSystolic?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(30)
  @Max(200)
  bpDiastolic?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(5)
  @Max(60)
  respiratoryRate?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(50)
  @Max(100)
  oxygenSaturation?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(0.5)
  @Max(500)
  weight?: number; // kg

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(30)
  @Max(275)
  height?: number; // cm

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(5)
  @Max(150)
  bmi?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(10)
  @Max(1500)
  bloodGlucose?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(0)
  @Max(10)
  painScale?: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsDateString()
  @IsOptional()
  @Validate(NotInFutureConstraint)
  recordedAt?: string;
}

export class UpdateVitalDto {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(32)
  @Max(45)
  temperature?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(20)
  @Max(250)
  pulse?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(50)
  @Max(300)
  bpSystolic?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(30)
  @Max(200)
  bpDiastolic?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(5)
  @Max(60)
  respiratoryRate?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(50)
  @Max(100)
  oxygenSaturation?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(0.5)
  @Max(500)
  weight?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(30)
  @Max(275)
  height?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(5)
  @Max(150)
  bmi?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(10)
  @Max(1500)
  bloodGlucose?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  @Min(0)
  @Max(10)
  painScale?: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
