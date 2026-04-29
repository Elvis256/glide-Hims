import { Body, Controller, Get, Headers, Param, Post, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { PaymentGatewayService } from './payment-gateway.service';
import { InitiatePaymentRequest } from './payment-gateway.types';

@ApiTags('payment-gateway')
@Controller('payment-gateway')
export class PaymentGatewayController {
  constructor(private readonly service: PaymentGatewayService) {}

  @Get('providers')
  @AuthWithPermissions('billing.read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List configured payment gateway providers' })
  listProviders() {
    return this.service.listProviders();
  }

  @Post('initiate')
  @AuthWithPermissions('billing.create')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate a card or mobile-money payment via the gateway' })
  async initiate(
    @Body() body: InitiatePaymentRequest & { provider?: string },
    @Request() req: any,
  ) {
    return this.service.initiate(body.provider, { ...body, tenantId: req.user?.tenantId });
  }

  @Get('status/:provider/:txnId')
  @AuthWithPermissions('billing.read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check the live status of a previously-initiated gateway transaction' })
  async getStatus(
    @Param('provider') provider: string,
    @Param('txnId') txnId: string,
  ) {
    return this.service.getStatus(provider, txnId);
  }

  /**
   * Webhook endpoint. PUBLIC (no JWT) because payment processors call us
   * server-to-server. Adapter-level signature verification SHOULD be added
   * for each real provider before going live.
   */
  @Post('webhook/:provider')
  @Public()
  @ApiOperation({ summary: 'Provider-side webhook callback' })
  async webhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string>,
    @Body() body: any,
  ) {
    const event = await this.service.handleWebhook(provider, headers, body);
    return { received: true, status: event.status };
  }
}
