import { IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ApplyCreditNoteDto {
  @IsUUID()
  paymentVoucherId: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;
}
