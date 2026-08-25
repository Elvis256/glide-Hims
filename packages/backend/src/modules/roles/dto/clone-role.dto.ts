import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** A role name is a security identifier; it was accepted unvalidated. */
export class CloneRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
