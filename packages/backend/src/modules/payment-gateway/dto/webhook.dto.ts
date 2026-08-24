import { IsObject } from 'class-validator';

/**
 * Public, unauthenticated, called server-to-server by a payment processor —
 * and it took `@Body() body: any`. Provider payload shapes differ, so this
 * cannot pin fields, but it can insist the body is an object: a string or an
 * array reaching an adapter that indexes into it is a crash, not a payment.
 *
 * Per-provider signature verification is still the control that matters here
 * and is still marked TODO on the handler.
 */
export class PaymentWebhookDto {
  @IsObject()
  payload: Record<string, unknown>;
}
