import { IsString, IsOptional, IsUUID, IsNumber, Min, Max } from 'class-validator';

/**
 * SubmitJournalEntryForApprovalDto
 * Used when a Finance Officer submits an entry for approval
 */
export class SubmitJournalEntryForApprovalDto {
  @IsUUID()
  journalEntryId: string;

  @IsOptional()
  @IsString()
  comments?: string;
}

/**
 * ApproveJournalEntryDto
 * Used when an approver at any level approves an entry
 */
export class ApproveJournalEntryDto {
  @IsUUID()
  journalEntryId: string;

  @IsOptional()
  @IsString()
  comments?: string;
}

/**
 * RejectJournalEntryDto
 * Used when an approver rejects an entry and returns it to DRAFT
 */
export class RejectJournalEntryDto {
  @IsUUID()
  journalEntryId: string;

  @IsString()
  rejectionReason: string;
}

/**
 * PostJournalEntryDto
 * Used when posting an APPROVED entry to the GL
 */
export class PostJournalEntryDto {
  @IsUUID()
  journalEntryId: string;
}

/**
 * GetApprovalHistoryDto
 * Query DTO for getting approval history
 */
export class GetApprovalHistoryQueryDto {
  @IsOptional()
  @IsUUID()
  journalEntryId?: string;
}

/**
 * GetEscalationCandidatesQueryDto
 * Query DTO for getting pending approvals
 */
export class GetEscalationCandidatesQueryDto {
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  daysPending?: number;
}
