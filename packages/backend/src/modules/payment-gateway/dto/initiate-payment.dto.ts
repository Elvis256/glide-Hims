import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * POST /payment-gateway/initiate was typed with the InitiatePaymentRequest
 * INTERFACE, which does not exist at runtime — so the ValidationPipe had no
 * metatype and the route that starts a payment validated nothing. The amount,
 * the currency and the mobile number a charge is raised against were all
 * unchecked.
 *
 * The interface stays as the internal type the providers are written against;
 * this class is the wire contract in front of it.
 */
export class PaymentCustomerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}

export class InitiatePaymentDto {
  @ApiProperty({ enum: ['card', 'mobile_money', 'bank_transfer'] })
  @IsIn(['card', 'mobile_money', 'bank_transfer'])
  channel: 'card' | 'mobile_money' | 'bank_transfer';

  /** A charge of zero or less is not a payment. */
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty()
  @IsString()
  @MaxLength(8)
  currency: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  invoiceId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  invoiceNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ type: PaymentCustomerDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PaymentCustomerDto)
  customer: PaymentCustomerDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  msisdn?: string;

  @ApiPropertyOptional({ enum: ['mtn', 'airtel', 'orange', 'mpesa'] })
  @IsOptional()
  @IsIn(['mtn', 'airtel', 'orange', 'mpesa'])
  mobileProvider?: 'mtn' | 'airtel' | 'orange' | 'mpesa';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  callbackUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  /** Read by the controller alongside the request itself. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  provider?: string;
}
