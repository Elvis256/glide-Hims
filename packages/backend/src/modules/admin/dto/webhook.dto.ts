import { IsString, IsUrl, IsArray, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateWebhookDto {
  @IsUrl({}, { message: 'A valid webhook URL is required' })
  @IsNotEmpty()
  url: string;

  @IsArray()
  @IsOptional()
  events?: string[];

  @IsString()
  @IsOptional()
  secret?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class UpdateWebhookDto {
  @IsUrl({}, { message: 'A valid webhook URL is required' })
  @IsOptional()
  url?: string;

  @IsArray()
  @IsOptional()
  events?: string[];

  @IsString()
  @IsOptional()
  secret?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
