import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

/** Bodies that were inline types, so nothing validated them. */
export class AddLeadActivityDto {
  @IsString()
  @MaxLength(60)
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;
}

export class AssignLeadDto {
  // Explicitly nullable: unassigning is a real operation, so null must pass
  // validation rather than be rejected as a missing field.
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  assignedTo: string | null;
}

export class SetLeadFollowUpDto {
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  nextFollowUpAt: string | null;
}
