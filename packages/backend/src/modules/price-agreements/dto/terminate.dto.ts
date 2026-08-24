import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Terminating a price agreement without a reason leaves no record of why. */
export class TerminateAgreementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}
