import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { LeadsService } from './leads.service';
import { CreateLeadDto, UpdateLeadStatusDto } from './lead.dto';

@ApiTags('Leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Submit a public lead (contact form)' })
  async create(@Body() dto: CreateLeadDto, @Req() req: any) {
    const ip = (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || '')
      .toString()
      .split(',')[0]
      .trim() || null;
    const ua = req.headers['user-agent'] || null;
    const lead = await this.service.create(dto, ip, ua);
    return { message: 'Thanks — we will reach out shortly.', id: lead.id };
  }

  @Get()
  @ApiOperation({ summary: 'List leads (system admin)' })
  async list(@Req() req: any, @Query('status') status?: string) {
    if (!req.user?.isSystemAdmin) throw new ForbiddenException('System admin only');
    return this.service.findAll(status);
  }

  @Get('stats')
  async stats(@Req() req: any) {
    if (!req.user?.isSystemAdmin) throw new ForbiddenException('System admin only');
    return this.service.stats();
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    if (!req.user?.isSystemAdmin) throw new ForbiddenException('System admin only');
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    if (!req.user?.isSystemAdmin) throw new ForbiddenException('System admin only');
    return this.service.updateStatus(id, dto);
  }
}
