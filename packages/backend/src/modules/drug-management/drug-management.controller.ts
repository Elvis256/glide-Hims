import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DrugManagementService } from './drug-management.service';
import { DrugSchedule, TherapeuticClass } from '../../database/entities/drug-classification.entity';

@ApiTags('Drug Management')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('drug-management')
export class DrugManagementController {
  constructor(private readonly drugService: DrugManagementService) {}

  // ==================== DRUG CLASSIFICATION ====================

  @Post('classifications')
  @ApiOperation({ summary: 'Create drug classification' })
  async createClassification(@Body() data: any) {
    return this.drugService.createClassification(data);
  }

  @Get('classifications')
  @ApiOperation({ summary: 'List drug classifications' })
  async listClassifications(
    @Query('schedule') schedule?: DrugSchedule,
    @Query('therapeuticClass') therapeuticClass?: TherapeuticClass,
    @Query('isControlled') isControlled?: boolean,
    @Query('isNarcotic') isNarcotic?: boolean,
    @Query('highAlert') highAlert?: boolean,
    @Query('isOnFormulary') isOnFormulary?: boolean,
  ) {
    return this.drugService.listClassifications({
      schedule,
      therapeuticClass,
      isControlled,
      isNarcotic,
      highAlert,
      isOnFormulary,
    });
  }

  @Get('classifications/controlled')
  @ApiOperation({ summary: 'Get controlled substances' })
  async getControlledSubstances() {
    return this.drugService.getControlledSubstances();
  }

  @Get('classifications/narcotics')
  @ApiOperation({ summary: 'Get narcotics' })
  async getNarcotics() {
    return this.drugService.getNarcotics();
  }

  @Get('classifications/high-alert')
  @ApiOperation({ summary: 'Get high-alert medications' })
  async getHighAlertMedications() {
    return this.drugService.getHighAlertMedications();
  }

  @Get('classifications/formulary')
  @ApiOperation({ summary: 'Get formulary drugs' })
  async getFormularyDrugs() {
    return this.drugService.getFormularyDrugs();
  }

  @Get('classifications/search')
  @ApiOperation({ summary: 'Search drugs' })
  async searchDrugs(@Query('q') query: string) {
    return this.drugService.searchDrugs(query);
  }

  @Get('classifications/by-therapeutic-class/:class')
  @ApiOperation({ summary: 'Get drugs by therapeutic class' })
  async getDrugsByTherapeuticClass(@Param('class') therapeuticClass: TherapeuticClass) {
    return this.drugService.getDrugsByTherapeuticClass(therapeuticClass);
  }

  @Get('classifications/item/:itemId')
  @ApiOperation({ summary: 'Get classification by item ID' })
  async getClassificationByItem(@Param('itemId') itemId: string) {
    return this.drugService.getClassification(itemId);
  }

  @Get('classifications/:id')
  @ApiOperation({ summary: 'Get classification by ID' })
  async getClassification(@Param('id') id: string) {
    return this.drugService.getClassificationById(id);
  }

  @Put('classifications/:id')
  @ApiOperation({ summary: 'Update drug classification' })
  async updateClassification(@Param('id') id: string, @Body() data: any) {
    return this.drugService.updateClassification(id, data);
  }

  // ==================== DRUG INTERACTIONS ====================

  @Post('interactions')
  @ApiOperation({ summary: 'Create drug interaction' })
  async createInteraction(@Body() data: any) {
    return this.drugService.createInteraction(data);
  }

  @Get('interactions/drug/:drugId')
  @ApiOperation({ summary: 'Get interactions for a drug' })
  async getInteractionsForDrug(@Param('drugId') drugId: string) {
    return this.drugService.getInteractionsForDrug(drugId);
  }

  @Post('interactions/check')
  @ApiOperation({ summary: 'Check for drug interactions' })
  async checkInteractions(@Body() data: { drugIds: string[] }) {
    return this.drugService.checkInteractions(data.drugIds);
  }

  @Get('interactions/major')
  @ApiOperation({ summary: 'Get major interactions' })
  async getMajorInteractions() {
    return this.drugService.getMajorInteractions();
  }

  @Put('interactions/:id')
  @ApiOperation({ summary: 'Update drug interaction' })
  async updateInteraction(@Param('id') id: string, @Body() data: any) {
    return this.drugService.updateInteraction(id, data);
  }

  // ==================== ALLERGY CLASSES ====================

  @Post('allergy-classes')
  @ApiOperation({ summary: 'Create allergy class' })
  async createAllergyClass(@Body() data: any) {
    return this.drugService.createAllergyClass(data);
  }

  @Get('allergy-classes')
  @ApiOperation({ summary: 'List allergy classes' })
  async listAllergyClasses() {
    return this.drugService.listAllergyClasses();
  }

  @Post('allergy-check')
  @ApiOperation({ summary: 'Check allergy risk for a drug' })
  async checkAllergyRisk(@Body() data: { drugId: string; patientAllergies: string[] }) {
    return this.drugService.checkAllergyRisk(data.drugId, data.patientAllergies);
  }

  // ==================== REPORTS ====================

  @Get('reports/controlled-substances')
  @ApiOperation({ summary: 'Get controlled substance report' })
  async getControlledSubstanceReport() {
    return this.drugService.getControlledSubstanceReport();
  }

  @Get('reports/formulary')
  @ApiOperation({ summary: 'Get formulary report' })
  async getFormularyReport() {
    return this.drugService.getFormularyReport();
  }
}
