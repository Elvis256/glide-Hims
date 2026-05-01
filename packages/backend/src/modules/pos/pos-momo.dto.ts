import { IsString, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiateMomoPaymentDto {
  @ApiProperty({ description: 'UG MSISDN e.g. 0771234567 or 256771234567' })
  @IsString()
  phone: string;

  @ApiProperty({ enum: ['mtn', 'airtel'] })
  @IsEnum(['mtn', 'airtel'])
  provider: 'mtn' | 'airtel';

  @ApiProperty()
  @IsNumber()
  @Min(1)
  amount: number;
}
