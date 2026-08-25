import { IsObject, IsOptional } from 'class-validator';

/**
 * `@Body() resultData: any` — an order's clinical result payload, entirely
 * unchecked. The shape is genuinely open (it varies by order type and is
 * stored as jsonb), so this validates what can be validated: that a body was
 * sent and that it is an object rather than a string, a number or an array.
 */
export class CompleteOrderDto {
  @IsOptional()
  @IsObject()
  resultData?: Record<string, unknown>;
}
