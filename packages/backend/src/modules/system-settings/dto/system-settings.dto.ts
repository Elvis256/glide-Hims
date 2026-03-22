import { IsDefined, IsOptional, IsString } from 'class-validator';

export class UpsertSystemSettingDto {
  @IsDefined()
  value: any;

  @IsOptional()
  @IsString()
  description?: string;
}
