import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { HrService } from './hr.service';
import { CreateJobApplicationDto } from './dto/hr.dto';

@ApiTags('Careers (Public)')
@Controller('careers')
export class CareersPublicController {
  constructor(private readonly hrService: HrService) {}

  @Public()
  @Get('jobs')
  @ApiOperation({ summary: 'List published job postings (public)' })
  async listJobs(@Query('facilityId') facilityId?: string) {
    return this.hrService.getPublishedJobs(facilityId);
  }

  @Public()
  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get job posting details (public)' })
  async getJob(@Param('id') id: string) {
    return this.hrService.getPublishedJobById(id);
  }

  @Public()
  @Post('jobs/:id/apply')
  @ApiOperation({ summary: 'Submit a job application (public)' })
  async apply(@Param('id') id: string, @Body() dto: CreateJobApplicationDto) {
    return this.hrService.createJobApplication({ ...dto, jobPostingId: id }, undefined);
  }
}
