import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, IsUrl } from 'class-validator';

export class CreateVersionDto {
  @IsString() @MaxLength(40) version: string;
  @IsString() @MaxLength(40) versionCode: string;

  @IsOptional() @IsString() @MaxLength(20000) releaseNotes?: string;
  @IsOptional() @IsString() @MaxLength(40) minUpgradeFrom?: string;
  @IsOptional() @IsBoolean() isMandatory?: boolean;
  @IsOptional() @IsBoolean() isLatest?: boolean;
  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) downloadUrl?: string;
  @IsOptional() @IsString() @MaxLength(200) checksum?: string;
  @IsOptional() @IsInt() @Min(0) fileSize?: number;
}
