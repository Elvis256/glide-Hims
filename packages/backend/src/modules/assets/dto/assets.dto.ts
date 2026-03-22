import { IsString, IsNotEmpty, IsNumber, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class RunDepreciationDto {
  @IsUUID()
  facilityId: string;

  @IsNumber()
  @Type(() => Number)
  year: number;

  @IsNumber()
  @Type(() => Number)
  month: number;
}

export class CompleteTransferDto {
  @IsString()
  @IsNotEmpty()
  receivedBy: string;
}
