import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Res,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { createReadStream, existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { PatientsService, UploadDocumentDto, CreateNoteDto } from './patients.service';
import {
  CreatePatientDto,
  UpdatePatientDto,
  PatientSearchDto,
  MergePatientDto,
  LinkUserDto,
} from './dto/patient.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { DocumentCategory } from '../../database/entities/patient-document.entity';
import { validateFileContent } from '../../common/file-validation';

@ApiTags('patients')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @AuthWithPermissions('patients.create')
  @ApiOperation({ summary: 'Register new patient' })
  async create(@Body() dto: CreatePatientDto, @Req() req: Request) {
    const userId = (req as any).user?.id;
    const tenantId = (req as any).user?.tenantId;
    const patient = await this.patientsService.create(dto, userId, tenantId);
    return { message: 'Patient registered', data: patient };
  }

  @Post('check-duplicates')
  @AuthWithPermissions('patients.create')
  @ApiOperation({ summary: 'Check for duplicate patients before registration' })
  async checkDuplicates(@Body() dto: CreatePatientDto, @Req() req: Request) {
    return this.patientsService.checkDuplicates(dto, (req as any).user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Search patients' })
  @ApiQuery({ name: 'facilityId', required: false, description: 'Filter by facility' })
  async findAll(@Query() query: PatientSearchDto, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    const facilityId = (req as any).query?.facilityId || (req as any).user?.facilityId;
    return this.patientsService.findAll(query, tenantId, facilityId);
  }

  // Static routes MUST come before parameterized routes
  @Get('document-categories')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get available document categories for current user' })
  async getDocumentCategories(@Req() req: Request) {
    const userRoles = (req as any).user?.roles || [];
    const categories = this.patientsService.getAccessibleCategories(userRoles);
    return {
      data: categories.map((cat) => ({
        value: cat,
        label: cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      })),
    };
  }

  @Get('mrn/:mrn')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get patient by MRN' })
  async findByMRN(@Param('mrn') mrn: string, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.patientsService.findByMRN(mrn, tenantId);
  }

  @Get('documents/:documentId')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get document metadata' })
  async getDocument(@Param('documentId', ParseUUIDPipe) documentId: string, @Req() req: Request) {
    const userRoles = (req as any).user?.roles || [];
    const document = await this.patientsService.getDocument(
      documentId,
      userRoles,
      (req as any).user?.tenantId,
    );
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
    const document = await this.patientsService.getDocument(
      documentId,
      userRoles,
      (req as any).user?.tenantId,
    );

    if (!existsSync(document.filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    // Path traversal protection: ensure file is within the uploads directory
    const uploadsDir = resolve(join(__dirname, '..', '..', '..', 'uploads'));
    const resolvedPath = resolve(document.filePath);
    if (!resolvedPath.startsWith(uploadsDir)) {
      return res.status(403).json({ message: 'Access denied: invalid file path' });
    }

    // Sanitize filename to prevent path traversal / header injection
    const rawName = document.originalFilename || document.documentName || 'download';
    const safeName = rawName
      .replace(/[/\\]/g, '_') // strip path separators
      .replace(/[^\w\s.\-()]/g, '_') // keep only safe characters
      .replace(/\.{2,}/g, '.') // collapse consecutive dots
      .slice(0, 200); // cap length

    res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);

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
    await this.patientsService.deleteDocument(
      documentId,
      userId,
      userRoles,
      (req as any).user?.tenantId,
    );
    return { message: 'Document deleted' };
  }

  // ==================== NOTE STATIC ROUTES ====================

  @Get('notes/:noteId')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get note by ID' })
  async getNote(@Param('noteId', ParseUUIDPipe) noteId: string, @Req() req: Request) {
    const note = await this.patientsService.getNote(noteId, (req as any).user?.tenantId);
    return { data: note };
  }

  @Delete('notes/:noteId')
  @AuthWithPermissions('patients.update')
  @ApiOperation({ summary: 'Delete patient note' })
  async deleteNote(@Param('noteId', ParseUUIDPipe) noteId: string, @Req() req: Request) {
    const userId = (req as any).user?.id;
    const userRoles = (req as any).user?.roles || [];
    await this.patientsService.deleteNote(noteId, userId, userRoles, (req as any).user?.tenantId);
    return { message: 'Note deleted' };
  }

  // Parameterized routes below
  @Get(':id')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get patient by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.patientsService.findOne(id, tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('patients.update')
  @ApiOperation({ summary: 'Update patient' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
    @Req() req: Request,
  ) {
    const patient = await this.patientsService.update(id, dto, (req as any).user?.tenantId);
    return { message: 'Patient updated', data: patient };
  }

  @Delete(':id')
  @AuthWithPermissions('patients.delete')
  @ApiOperation({ summary: 'Delete patient (soft delete)' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    await this.patientsService.remove(id, (req as any).user?.tenantId);
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
    // Validate file content matches declared MIME type (prevent disguised executables)
    if (file?.path) {
      const header = readFileSync(file.path, { flag: 'r' }).subarray(0, 16);
      if (!validateFileContent(header, file.mimetype)) {
        throw new BadRequestException('File content does not match declared type');
      }
    }
    const userId = (req as any).user?.id;
    const document = await this.patientsService.uploadDocument(
      patientId,
      file,
      dto,
      userId,
      (req as any).user?.tenantId,
    );
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
    const documents = await this.patientsService.getDocuments(
      patientId,
      userRoles,
      category,
      (req as any).user?.tenantId,
    );
    return { data: documents };
  }

  @Get(':id/documents/stats')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get document statistics for patient' })
  async getDocumentStats(@Param('id', ParseUUIDPipe) patientId: string, @Req() req: Request) {
    const userRoles = (req as any).user?.roles || [];
    const stats = await this.patientsService.getDocumentStats(
      patientId,
      userRoles,
      (req as any).user?.tenantId,
    );
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
    const note = await this.patientsService.createNote(
      patientId,
      dto,
      userId,
      (req as any).user?.tenantId,
    );
    return { message: 'Note created', data: note };
  }

  @Get(':id/notes')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get patient notes' })
  async getNotes(@Param('id', ParseUUIDPipe) patientId: string, @Req() req: Request) {
    const notes = await this.patientsService.getNotes(patientId, (req as any).user?.tenantId);
    return { data: notes };
  }

  // ==================== PATIENT MERGE ENDPOINT ====================

  @Post(':primaryId/merge/:secondaryId')
  @AuthWithPermissions('patients.delete') // Merge requires high privilege
  @ApiOperation({ summary: 'Merge two patient records (secondary into primary)' })
  async mergePatients(
    @Param('primaryId', ParseUUIDPipe) primaryId: string,
    @Param('secondaryId', ParseUUIDPipe) secondaryId: string,
    @Body() body: MergePatientDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID is required');
    const result = await this.patientsService.mergePatients(
      primaryId,
      secondaryId,
      userId,
      tenantId,
      body.reason,
    );
    return { message: 'Patients merged successfully', data: result };
  }

  @Get('merges/history')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get merge history' })
  async getMergeHistory(@Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID is required');
    return this.patientsService.getMergeHistory(tenantId);
  }

  // ==================== USER LINKING ENDPOINTS ====================

  @Post(':id/link-user')
  @AuthWithPermissions('patients.update')
  @ApiOperation({ summary: 'Link a user account to patient' })
  async linkUser(
    @Param('id', ParseUUIDPipe) patientId: string,
    @Body() body: LinkUserDto,
    @Req() req: Request,
  ) {
    const patient = await this.patientsService.linkUser(
      patientId,
      body.userId,
      (req as any).user?.tenantId,
    );
    return { message: 'User linked to patient successfully', data: patient };
  }

  @Delete(':id/unlink-user')
  @AuthWithPermissions('patients.update')
  @ApiOperation({ summary: 'Unlink user account from patient' })
  async unlinkUser(@Param('id', ParseUUIDPipe) patientId: string, @Req() req: Request) {
    const patient = await this.patientsService.unlinkUser(patientId, (req as any).user?.tenantId);
    return { message: 'User unlinked from patient', data: patient };
  }

  @Get(':id/linked-user')
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'Get linked user information for patient' })
  async getLinkedUser(@Param('id', ParseUUIDPipe) patientId: string, @Req() req: Request) {
    const result = await this.patientsService.getLinkedUser(patientId, (req as any).user?.tenantId);
    return { data: result };
  }
}
