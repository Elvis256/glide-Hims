import { Controller, Get, Post, Put, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DrugManagementService } from './drug-management.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { DrugSchedule, TherapeuticClass } from '../../database/entities/drug-classification.entity';
import {
  CreateDrugClassificationDto,
  UpdateDrugClassificationDto,
  CreateDrugInteractionDto,
  UpdateDrugInteractionDto,
  CheckInteractionsDto,
  CreateAllergyClassDto,
  CheckAllergyRiskDto,
} from './drug-management.dto';

@ApiTags('Drug Management')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('drug-management')
export class DrugManagementController {
  constructor(private readonly drugService: DrugManagementService) {}

  // ==================== DRUG CLASSIFICATION ====================

  @Post('classifications')
  @AuthWithPermissions('pharmacy.create')
  @ApiOperation({ summary: 'Create drug classification' })
  async createClassification(@Body() dto: CreateDrugClassificationDto, @Request() req: any) {
    return this.drugService.createClassification(dto, req.user?.tenantId);
  }

  @Get('classifications')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'List drug classifications' })
  async listClassifications(
    @Query('schedule') schedule?: DrugSchedule,
    @Query('therapeuticClass') therapeuticClass?: TherapeuticClass,
    @Query('isControlled') isControlled?: boolean,
    @Query('isNarcotic') isNarcotic?: boolean,
    @Query('highAlert') highAlert?: boolean,
    @Query('isOnFormulary') isOnFormulary?: boolean,
    @Request() req?: any,
  ) {
    return this.drugService.listClassifications({
      schedule,
      therapeuticClass,
      isControlled,
      isNarcotic,
      highAlert,
      isOnFormulary,
    }, req?.user?.tenantId);
  }

  @Get('classifications/controlled')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get controlled substances' })
  async getControlledSubstances(@Request() req: any) {
    return this.drugService.getControlledSubstances(req.user?.tenantId);
  }

  @Get('classifications/narcotics')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get narcotics' })
  async getNarcotics(@Request() req: any) {
    return this.drugService.getNarcotics(req.user?.tenantId);
  }

  @Get('classifications/high-alert')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get high-alert medications' })
  async getHighAlertMedications(@Request() req: any) {
    return this.drugService.getHighAlertMedications(req.user?.tenantId);
  }

  @Get('classifications/formulary')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get formulary drugs' })
  async getFormularyDrugs(@Request() req: any) {
    return this.drugService.getFormularyDrugs(req.user?.tenantId);
  }

  @Get('classifications/search')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Search drugs' })
  async searchDrugs(@Query('q') query: string, @Request() req: any) {
    return this.drugService.searchDrugs(query, req.user?.tenantId);
  }

  @Get('classifications/by-therapeutic-class/:class')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get drugs by therapeutic class' })
  async getDrugsByTherapeuticClass(@Param('class') therapeuticClass: TherapeuticClass, @Request() req: any) {
    return this.drugService.getDrugsByTherapeuticClass(therapeuticClass, req.user?.tenantId);
  }

  @Get('classifications/item/:itemId')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get classification by item ID' })
  async getClassificationByItem(@Param('itemId') itemId: string, @Request() req: any) {
    return this.drugService.getClassification(itemId, req.user?.tenantId);
  }

  @Get('classifications/:id')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get classification by ID' })
  async getClassification(@Param('id') id: string, @Request() req: any) {
    return this.drugService.getClassificationById(id, req.user?.tenantId);
  }

  @Put('classifications/:id')
  @AuthWithPermissions('pharmacy.update')
  @ApiOperation({ summary: 'Update drug classification' })
  async updateClassification(@Param('id') id: string, @Body() dto: UpdateDrugClassificationDto, @Request() req: any) {
    return this.drugService.updateClassification(id, dto, req.user?.tenantId);
  }

  // ==================== DRUG INTERACTIONS ====================

  @Post('interactions')
  @AuthWithPermissions('pharmacy.create')
  @ApiOperation({ summary: 'Create drug interaction' })
  async createInteraction(@Body() dto: CreateDrugInteractionDto, @Request() req: any) {
    return this.drugService.createInteraction(dto, req.user?.tenantId);
  }

  @Get('interactions/drug/:drugId')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get interactions for a drug' })
  async getInteractionsForDrug(@Param('drugId') drugId: string, @Request() req: any) {
    return this.drugService.getInteractionsForDrug(drugId, req.user?.tenantId);
  }

  @Post('interactions/check')
  @AuthWithPermissions('pharmacy.create')
  @ApiOperation({ summary: 'Check for drug interactions' })
  async checkInteractions(@Body() dto: CheckInteractionsDto, @Request() req: any) {
    return this.drugService.checkInteractions(dto.drugIds, req.user?.tenantId);
  }

  @Get('interactions/major')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get major interactions' })
  async getMajorInteractions(@Request() req: any) {
    return this.drugService.getMajorInteractions(req.user?.tenantId);
  }

  @Put('interactions/:id')
  @AuthWithPermissions('pharmacy.update')
  @ApiOperation({ summary: 'Update drug interaction' })
  async updateInteraction(@Param('id') id: string, @Body() dto: UpdateDrugInteractionDto, @Request() req: any) {
    return this.drugService.updateInteraction(id, dto, req.user?.tenantId);
  }

  // ==================== ALLERGY CLASSES ====================

  @Post('allergy-classes')
  @AuthWithPermissions('pharmacy.create')
  @ApiOperation({ summary: 'Create allergy class' })
  async createAllergyClass(@Body() dto: CreateAllergyClassDto, @Request() req: any) {
    return this.drugService.createAllergyClass(dto, req.user?.tenantId);
  }

  @Get('allergy-classes')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'List allergy classes' })
  async listAllergyClasses(@Request() req: any) {
    return this.drugService.listAllergyClasses(req.user?.tenantId);
  }

  @Post('allergy-check')
  @AuthWithPermissions('pharmacy.create')
  @ApiOperation({ summary: 'Check allergy risk for a drug' })
  async checkAllergyRisk(@Body() dto: CheckAllergyRiskDto, @Request() req: any) {
    return this.drugService.checkAllergyRisk(dto.drugId, dto.patientAllergies, req.user?.tenantId);
  }

  // ==================== REPORTS ====================

  @Get('reports/controlled-substances')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get controlled substance report' })
  async getControlledSubstanceReport(@Request() req: any) {
    return this.drugService.getControlledSubstanceReport(req.user?.tenantId);
  }

  @Get('reports/formulary')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get formulary report' })
  async getFormularyReport(@Request() req: any) {
    return this.drugService.getFormularyReport(req.user?.tenantId);
  }
}
