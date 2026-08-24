import { IsOptional, IsString, IsUUID, IsDateString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * Both of these handlers took `@Body() dto: any`, so the ValidationPipe had no
 * metadata to work from and validated nothing at all. An empty body reached
 * Postgres and came back as a 500 — "null value in column facility_id of
 * relation cycle_counts", "null value in column batch_number of relation
 * batch_recalls" — where the honest answer is a 400 naming the field.
 *
 * The service signatures already documented the shape as an inline type; these
 * classes are that shape, made enforceable.
 */
export class CreateCycleCountDto {
  @IsUUID()
  facilityId: string;

  @IsOptional()
  @IsDateString()
  countDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class InitiateRecallDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  batchNumber: string;

  @IsUUID()
  itemId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  itemName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  severity?: string;

  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
