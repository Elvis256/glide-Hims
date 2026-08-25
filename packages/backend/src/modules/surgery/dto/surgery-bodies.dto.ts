import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/** Inline @Body() type on the surgery checklist/items route. */
export class SurgeryItemsDto {
  @ApiProperty({ type: Object })
  @IsObject()
  items: Record<string, unknown>;
}
