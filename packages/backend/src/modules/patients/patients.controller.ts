import { 
  Controller, Get, Post, Body, Patch, Param, Delete, Query, 
  ParseUUIDPipe, UseInterceptors, UploadedFile, Res, Req 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { createReadStream, existsSync } from 'fs';
import { PatientsService, UploadDocumentDto, CreateNoteDto } from './patients.service';
import { CreatePatientDto, UpdatePatientDto, PatientSearchDto } from './dto/patient.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { DocumentCategory } from '../../database/entities/patient-document.entity';

@ApiTags('patients')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @AuthWithPermissions('patients.create')
  @ApiOperation({ summary: 'Register new patient' })
  async create(@Body() dto: CreatePatientDto) {
    const patient = await this.patientsService.create(dto);
    return { message: 'Patient registered', data: patient };
  }

  @Post('check-duplicates')
  @AuthWithPermissions('patients.create')
  @ApiOperation({ summary: 'Check for duplicate patients before registration' })
  async checkDuplicates(@Body() dto: CreatePatientDto) {
    const duplicates = await this.patientsService.checkDuplicates(dto);
    return {
      hasDuplicates: duplicates.length > 0,
      duplicates: duplicates.map((p) => ({
        id: p.id,
        mrn: p.mrn,
        fullName: p.fullName,
        dateOfBirth: p.dateOfBirth,
        phone: p.phone,
        nationalId: p.nationalId,
      })),
    };
  }

  @Get()
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Search patients' })
  async findAll(@Query() query: PatientSearchDto) {
    return this.patientsService.findAll(query);
  }

  // Static routes MUST come before parameterized routes
  @Get('document-categories')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get available document categories for current user' })
  async getDocumentCategories(@Req() req: Request) {
    const userRoles = (req as any).user?.roles || [];
    const categories = this.patientsService.getAccessibleCategories(userRoles);
    return { 
      data: categories.map(cat => ({
        value: cat,
        label: cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      }))
    };
  }

  @Get('mrn/:mrn')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get patient by MRN' })
  async findByMRN(@Param('mrn') mrn: string) {
    return this.patientsService.findByMRN(mrn);
  }

  @Get('documents/:documentId')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get document metadata' })
  async getDocument(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: Request,
  ) {
    const userRoles = (req as any).user?.roles || [];
    const document = await this.patientsService.getDocument(documentId, userRoles);
    return { data: document };
  }

  @Get('documents/:documentId/download')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Download document file' })
  async downloadDocument(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userRoles = (req as any).user?.roles || [];
    const document = await this.patientsService.getDocument(documentId, userRoles);
    
    if (!existsSync(document.filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename || document.documentName}"`);
    
    const fileStream = createReadStream(document.filePath);
    fileStream.pipe(res);
  }

  @Delete('documents/:documentId')
  @AuthWithPermissions('patients.update')
  @ApiOperation({ summary: 'Delete patient document' })
  async deleteDocument(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    const userRoles = (req as any).user?.roles || [];
    await this.patientsService.deleteDocument(documentId, userId, userRoles);
    return { message: 'Document deleted' };
  }

  // ==================== NOTE STATIC ROUTES ====================

  @Get('notes/:noteId')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get note by ID' })
  async getNote(@Param('noteId', ParseUUIDPipe) noteId: string) {
    const note = await this.patientsService.getNote(noteId);
    return { data: note };
  }

  @Delete('notes/:noteId')
  @AuthWithPermissions('patients.update')
  @ApiOperation({ summary: 'Delete patient note' })
  async deleteNote(
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    const userRoles = (req as any).user?.roles || [];
    await this.patientsService.deleteNote(noteId, userId, userRoles);
    return { message: 'Note deleted' };
  }

  // Parameterized routes below
  @Get(':id')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get patient by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.patientsService.findOne(id);
  }

  @Patch(':id')
  @AuthWithPermissions('patients.update')
  @ApiOperation({ summary: 'Update patient' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePatientDto) {
    const patient = await this.patientsService.update(id, dto);
    return { message: 'Patient updated', data: patient };
  }

  @Delete(':id')
  @AuthWithPermissions('patients.delete')
  @ApiOperation({ summary: 'Delete patient (soft delete)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.patientsService.remove(id);
    return { message: 'Patient deleted' };
  }

  // ==================== DOCUMENT ENDPOINTS ====================

  @Post(':id/documents')
  @AuthWithPermissions('patients.update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload patient document' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        category: { type: 'string', enum: Object.values(DocumentCategory) },
        description: { type: 'string' },
        documentDate: { type: 'string', format: 'date' },
        notes: { type: 'string' },
      },
    },
  })
  async uploadDocument(
    @Param('id', ParseUUIDPipe) patientId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    const document = await this.patientsService.uploadDocument(patientId, file, dto, userId);
    return { message: 'Document uploaded', data: document };
  }

  @Get(':id/documents')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get patient documents (filtered by user role)' })
  @ApiQuery({ name: 'category', required: false, enum: DocumentCategory })
  async getDocuments(
    @Param('id', ParseUUIDPipe) patientId: string,
    @Query('category') category: DocumentCategory,
    @Req() req: Request,
  ) {
    const userRoles = (req as any).user?.roles || [];
    const documents = await this.patientsService.getDocuments(patientId, userRoles, category);
    return { data: documents };
  }

  @Get(':id/documents/stats')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get document statistics for patient' })
  async getDocumentStats(
    @Param('id', ParseUUIDPipe) patientId: string,
    @Req() req: Request,
  ) {
    const userRoles = (req as any).user?.roles || [];
    const stats = await this.patientsService.getDocumentStats(patientId, userRoles);
    return { data: stats };
  }

  // ==================== NOTE ENDPOINTS ====================

  @Post(':id/notes')
  @AuthWithPermissions('patients.update')
  @ApiOperation({ summary: 'Create patient note' })
  async createNote(
    @Param('id', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateNoteDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    const note = await this.patientsService.createNote(patientId, dto, userId);
    return { message: 'Note created', data: note };
  }

  @Get(':id/notes')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get patient notes' })
  async getNotes(@Param('id', ParseUUIDPipe) patientId: string) {
    const notes = await this.patientsService.getNotes(patientId);
    return { data: notes };
  }
}
