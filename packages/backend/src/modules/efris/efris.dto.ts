import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EfrisEnvironment } from '../../database/entities/pos-compliance.entity';

export class UpsertEfrisConfigDto {
  @ApiProperty() @IsString() taxpayerTin: string;
  @ApiProperty() @IsString() taxpayerName: string;
  @ApiProperty() @IsString() deviceSerial: string;
  @ApiProperty({ enum: EfrisEnvironment, default: EfrisEnvironment.SANDBOX })
  @IsOptional()
  @IsEnum(EfrisEnvironment)
  environment?: EfrisEnvironment;
  @ApiProperty({ required: false }) @IsOptional() @IsString() sandboxUrl?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() productionUrl?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() apiKeyEncrypted?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isEnabled?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() submitOnCompletion?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) maxRetries?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) retryBackoffSeconds?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() allowOfflineReceipts?: boolean;
}
