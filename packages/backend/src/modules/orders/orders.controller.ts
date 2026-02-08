import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto, SubmitLabResultsDto, SubmitRadiologyReportDto } from './dto/orders.dto';
import { OrderType, OrderStatus, OrderPriority } from '../../database/entities/order.entity';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @AuthWithPermissions('orders.create')
  async createOrder(@Body() dto: CreateOrderDto, @Request() req: any) {
    return this.ordersService.createOrder(dto, req.user.id);
  }

  @Get()
  @AuthWithPermissions('orders.read')
  async findAll(
    @Query('orderType') orderType?: OrderType,
    @Query('status') status?: OrderStatus,
    @Query('encounterId') encounterId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('patientId') patientId?: string,
    @Query('priority') priority?: OrderPriority,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.findAll({
      orderType,
      status,
      encounterId,
      facilityId,
      patientId,
      priority,
      startDate,
      endDate,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('queue/lab/:facilityId')
  @AuthWithPermissions('orders.read')
  async getLabQueue(@Param('facilityId') facilityId: string) {
    return this.ordersService.getLabQueue(facilityId);
  }

  @Get('queue/radiology/:facilityId')
  @AuthWithPermissions('orders.read')
  async getRadiologyQueue(@Param('facilityId') facilityId: string) {
    return this.ordersService.getRadiologyQueue(facilityId);
  }

  @Get('stats/:facilityId')
  @AuthWithPermissions('orders.read')
  async getOrderStats(
    @Param('facilityId') facilityId: string,
    @Query('orderType') orderType?: OrderType,
  ) {
    return this.ordersService.getOrderStats(facilityId, orderType);
  }

  @Get('encounter/:encounterId')
  @AuthWithPermissions('orders.read')
  async findByEncounter(@Param('encounterId') encounterId: string) {
    return this.ordersService.findByEncounter(encounterId);
  }

  @Get(':id')
  @AuthWithPermissions('orders.read')
  async findById(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Put(':id/status')
  @AuthWithPermissions('orders.update')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Request() req: any,
  ) {
    return this.ordersService.updateStatus(id, dto, req.user.id);
  }

  @Post(':id/start')
  @AuthWithPermissions('orders.update')
  async startProcessing(@Param('id') id: string, @Request() req: any) {
    return this.ordersService.startProcessing(id, req.user.id);
  }

  @Post(':id/complete')
  @AuthWithPermissions('orders.update')
  async completeOrder(
    @Param('id') id: string,
    @Body() resultData: any,
    @Request() req: any,
  ) {
    return this.ordersService.completeOrder(id, resultData, req.user.id);
  }

  @Post(':id/cancel')
  @AuthWithPermissions('orders.update')
  async cancelOrder(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.ordersService.cancelOrder(id, reason, req.user.id);
  }

  // Lab-specific endpoints
  @Post(':id/lab-results')
  @AuthWithPermissions('orders.update')
  async submitLabResults(
    @Param('id') id: string,
    @Body() dto: SubmitLabResultsDto,
    @Request() req: any,
  ) {
    return this.ordersService.completeOrder(id, dto, req.user.id);
  }

  // Radiology-specific endpoints
  @Post(':id/radiology-report')
  @AuthWithPermissions('orders.update')
  async submitRadiologyReport(
    @Param('id') id: string,
    @Body() dto: SubmitRadiologyReportDto,
    @Request() req: any,
  ) {
    return this.ordersService.completeOrder(id, dto, req.user.id);
  }
}
