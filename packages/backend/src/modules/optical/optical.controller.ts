import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OpticalService } from './optical.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CreateEyeExamDto,
  CreateOpticalPrescriptionDto,
  CreateContactLensPrescriptionDto,
  CreateFrameDto,
  UpdateFrameDto,
  CreateLensProductDto,
  UpdateLensProductDto,
  CreateSpectacleOrderDto,
  UpdateOrderStatusDto,
  CreateVisualFieldTestDto,
} from './optical.dto';

@ApiTags('Optical')
@ApiBearerAuth()
@Controller('optical')
export class OpticalController {
  constructor(private readonly opticalService: OpticalService) {}

  // ============ EYE EXAMS ============

  @Post('exams')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Create eye exam' })
  async createExam(
    @Body() dto: CreateEyeExamDto,
    @CurrentUser() user: any,
  ) {
    const exam = await this.opticalService.createExam(dto, user.id, user.tenantId);
    return { message: 'Eye exam created', data: exam };
  }

  @Get('exams/patient/:patientId')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Get patient eye exams' })
  async getPatientExams(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: any,
  ) {
    const exams = await this.opticalService.findPatientExams(patientId, user.tenantId);
    return { data: exams };
  }

  @Get('exams/:id')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Get eye exam by ID' })
  async getExam(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const exam = await this.opticalService.getExam(id, user.tenantId);
    return { data: exam };
  }

  // ============ PRESCRIPTIONS ============

  @Post('prescriptions')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Create optical prescription' })
  async createPrescription(
    @Body() dto: CreateOpticalPrescriptionDto,
    @CurrentUser() user: any,
  ) {
    const rx = await this.opticalService.createPrescription(dto, user.id, user.tenantId);
    return { message: 'Prescription created', data: rx };
  }

  @Get('prescriptions/patient/:patientId')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Get patient prescriptions' })
  async getPatientPrescriptions(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: any,
  ) {
    const prescriptions = await this.opticalService.findPatientPrescriptions(patientId, user.tenantId);
    return { data: prescriptions };
  }

  @Get('prescriptions/patient/:patientId/active')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Get active prescription for patient' })
  async getActivePrescription(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: any,
  ) {
    const rx = await this.opticalService.getActivePrescription(patientId, user.tenantId);
    return { data: rx };
  }

  @Post('prescriptions/contact-lens')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Create contact lens prescription details' })
  async createContactLensPrescription(
    @Body() dto: CreateContactLensPrescriptionDto,
    @CurrentUser() user: any,
  ) {
    const cl = await this.opticalService.createContactLensPrescription(dto, user.tenantId);
    return { message: 'Contact lens prescription created', data: cl };
  }

  // ============ FRAMES ============

  @Post('frames')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Create frame' })
  async createFrame(
    @Body() dto: CreateFrameDto,
    @CurrentUser() user: any,
  ) {
    const frame = await this.opticalService.createFrame(dto, user.tenantId);
    return { message: 'Frame created', data: frame };
  }

  @Get('frames')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'List frames' })
  @ApiQuery({ name: 'brand', required: false })
  @ApiQuery({ name: 'material', required: false })
  @ApiQuery({ name: 'gender', required: false })
  @ApiQuery({ name: 'type', required: false, description: 'Frame type' })
  async listFrames(
    @CurrentUser() user: any,
    @Query('brand') brand?: string,
    @Query('material') material?: string,
    @Query('gender') gender?: string,
    @Query('type') frameType?: string,
  ) {
    const frames = await this.opticalService.findAllFrames(user.tenantId, {
      brand,
      material,
      gender,
      frameType,
    });
    return { data: frames };
  }

  @Patch('frames/:id')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Update frame' })
  async updateFrame(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFrameDto,
    @CurrentUser() user: any,
  ) {
    const frame = await this.opticalService.updateFrame(id, dto, user.tenantId);
    return { message: 'Frame updated', data: frame };
  }

  // ============ LENSES ============

  @Post('lenses')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Create lens product' })
  async createLensProduct(
    @Body() dto: CreateLensProductDto,
    @CurrentUser() user: any,
  ) {
    const lens = await this.opticalService.createLensProduct(dto, user.tenantId);
    return { message: 'Lens product created', data: lens };
  }

  @Get('lenses')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'List lens products' })
  @ApiQuery({ name: 'lensType', required: false })
  @ApiQuery({ name: 'material', required: false })
  async listLenses(
    @CurrentUser() user: any,
    @Query('lensType') lensType?: string,
    @Query('material') material?: string,
  ) {
    const lenses = await this.opticalService.findAllLenses(user.tenantId, { lensType, material });
    return { data: lenses };
  }

  @Patch('lenses/:id')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Update lens product' })
  async updateLens(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLensProductDto,
    @CurrentUser() user: any,
  ) {
    const lens = await this.opticalService.updateLensProduct(id, dto, user.tenantId);
    return { message: 'Lens product updated', data: lens };
  }

  // ============ ORDERS ============

  @Post('orders')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Create spectacle order' })
  async createOrder(
    @Body() dto: CreateSpectacleOrderDto,
    @CurrentUser() user: any,
  ) {
    const order = await this.opticalService.createOrder(dto, user.tenantId);
    return { message: 'Order created', data: order };
  }

  @Get('orders')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'List spectacle orders' })
  @ApiQuery({ name: 'status', required: false })
  async listOrders(
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    const orders = await this.opticalService.findAllOrders(user.tenantId, status);
    return { data: orders };
  }

  @Get('orders/stats')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Get order statistics' })
  async getOrderStats(@CurrentUser() user: any) {
    const stats = await this.opticalService.getOrderStats(user.tenantId);
    return { data: stats };
  }

  @Get('orders/patient/:patientId')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Get patient spectacle orders' })
  async getPatientOrders(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: any,
  ) {
    const orders = await this.opticalService.findPatientOrders(patientId, user.tenantId);
    return { data: orders };
  }

  @Patch('orders/:id/status')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Update order status' })
  async updateOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: any,
  ) {
    const order = await this.opticalService.updateOrderStatus(id, dto, user.tenantId);
    return { message: 'Order status updated', data: order };
  }

  // ============ VISUAL FIELD TESTS ============

  @Post('visual-field')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Create visual field test' })
  async createVisualFieldTest(
    @Body() dto: CreateVisualFieldTestDto,
    @CurrentUser() user: any,
  ) {
    const test = await this.opticalService.createTest(dto, user.id, user.tenantId);
    return { message: 'Visual field test created', data: test };
  }

  @Get('visual-field/patient/:patientId')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Get patient visual field tests' })
  @ApiQuery({ name: 'eye', required: false, enum: ['od', 'os'] })
  async getPatientVisualFieldTests(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: any,
    @Query('eye') eye?: string,
  ) {
    const tests = await this.opticalService.findPatientTests(patientId, user.tenantId, eye);
    return { data: tests };
  }

  @Get('visual-field/patient/:patientId/compare')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Compare last 2 visual field tests for eye' })
  @ApiQuery({ name: 'eye', required: true, enum: ['od', 'os'] })
  async compareVisualFieldTests(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('eye') eye: string,
    @CurrentUser() user: any,
  ) {
    const tests = await this.opticalService.compareTests(patientId, eye, user.tenantId);
    return { data: tests };
  }

  @Get('visual-field/:id')
  @AuthWithPermissions('optical.manage')
  @ApiOperation({ summary: 'Get visual field test by ID' })
  async getVisualFieldTest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const test = await this.opticalService.getTest(id, user.tenantId);
    return { data: test };
  }
}
