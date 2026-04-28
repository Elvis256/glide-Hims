import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AuthWithPermissions } from '../../auth/decorators/auth.decorator';

@ApiTags('Admin - Job Monitor')
@ApiBearerAuth()
@Controller('admin/jobs')
export class JobMonitorController {
  constructor(private readonly scheduler: SchedulerRegistry) {}

  @Get()
  @AuthWithPermissions('settings.read')
  @ApiOperation({ summary: 'List registered cron / interval / timeout jobs' })
  list() {
    const cronJobs: Array<any> = [];
    try {
      this.scheduler.getCronJobs().forEach((job: any, name: string) => {
        let nextRun: string | null = null;
        let lastRun: string | null = null;
        try {
          nextRun = job.nextDate ? new Date(job.nextDate().toString()).toISOString() : null;
        } catch {}
        try {
          lastRun = job.lastDate ? job.lastDate()?.toISOString() : null;
        } catch {}
        cronJobs.push({
          name,
          type: 'cron',
          running: typeof job.running === 'boolean' ? job.running : true,
          cronTime: job.cronTime?.source?.toString?.() || String(job.cronTime || ''),
          nextRun,
          lastRun,
        });
      });
    } catch {}

    const intervals: string[] = [];
    try {
      this.scheduler.getIntervals().forEach((n) => intervals.push(n));
    } catch {}

    const timeouts: string[] = [];
    try {
      this.scheduler.getTimeouts().forEach((n) => timeouts.push(n));
    } catch {}

    return {
      cronJobs,
      intervals: intervals.map((name) => ({ name, type: 'interval' })),
      timeouts: timeouts.map((name) => ({ name, type: 'timeout' })),
      total: cronJobs.length + intervals.length + timeouts.length,
    };
  }
}
