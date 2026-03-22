import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class SaveDhis2ConfigDto {
  @IsOptional() @IsString() baseUrl?: string;
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsString() orgUnitId?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class PushHmis105Dto {
  @IsNumber() month: number;
  @IsNumber() year: number;
  @IsOptional() @IsString() facilityId?: string;
}
