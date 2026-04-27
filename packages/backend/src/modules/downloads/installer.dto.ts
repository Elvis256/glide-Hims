import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateInstallerDto {
  @IsString() @MinLength(2) @MaxLength(200)
  name: string;

  @IsString() @MaxLength(50)
  version: string;

  @IsOptional() @IsIn(['stable', 'beta', 'lts'])
  channel?: 'stable' | 'beta' | 'lts';

  @IsOptional() @IsIn(['docker-image', 'tarball', 'iso', 'usb-bundle', 'updater'])
  kind?: 'docker-image' | 'tarball' | 'iso' | 'usb-bundle' | 'updater';

  @IsOptional() @IsString() @MaxLength(20)
  platform?: string;

  @IsString() @MaxLength(300)
  filename: string;

  @IsString()
  sizeBytes: string;

  @IsString() @MaxLength(64)
  sha256: string;

  @IsOptional() @IsString() @MaxLength(5000)
  releaseNotes?: string;

  @IsOptional() @IsBoolean()
  isPublished?: boolean;

  @IsOptional() @IsString() @MaxLength(50)
  minLicenseTier?: string;
}

export class UpdateInstallerDto {
  @IsOptional() @IsBoolean()
  isPublished?: boolean;

  @IsOptional() @IsString() @MaxLength(5000)
  releaseNotes?: string;

  @IsOptional() @IsIn(['stable', 'beta', 'lts'])
  channel?: 'stable' | 'beta' | 'lts';
}
