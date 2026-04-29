import { IsString, IsNotEmpty, Matches, Length } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9+\-\s]{7,20}$/, { message: 'Invalid phone number' })
  phone: string;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  code: string;
}
