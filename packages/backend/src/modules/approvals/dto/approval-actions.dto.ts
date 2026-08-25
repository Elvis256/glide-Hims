import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Approve, reject and the chain lookup. Rejection's comment is required — a
 * rejection with no stated reason is the one an approver cannot defend later —
 * and it was an inline type that enforced nothing.
 */
export class ApproveDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;
}

export class RejectDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  comment: string;
}

export class ApprovalChainLookupDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  module: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  documentType: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  documentId: string;
}
