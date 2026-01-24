import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { SyncService } from './sync.service';
import { PushChangesDto, PullChangesDto, ResolveConflictDto } from './dto/sync.dto';
import { SyncableEntity } from '../../database/entities/sync-queue.entity';

@ApiTags('Offline Sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  @Auth()
  @ApiOperation({ summary: 'Push offline changes to server' })
  pushChanges(@Body() dto: PushChangesDto, @Request() req: any) {
    return this.syncService.pushChanges(dto, req.user.id);
  }

  @Get('pull')
  @Auth()
  @ApiOperation({ summary: 'Pull changes from server since timestamp' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'clientId', required: true })
  @ApiQuery({ name: 'since', required: true, description: 'Unix timestamp (ms)' })
  @ApiQuery({ name: 'entityTypes', required: false, isArray: true, enum: SyncableEntity })
  @ApiQuery({ name: 'limit', required: false })
  pullChanges(
    @Query('facilityId') facilityId: string,
    @Query('clientId') clientId: string,
    @Query('since') since: number,
    @Query('entityTypes') entityTypes?: SyncableEntity[],
    @Query('limit') limit?: number,
  ) {
    return this.syncService.pullChanges(
      facilityId,
      clientId,
      Number(since),
      entityTypes,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('conflicts')
  @Auth()
  @ApiOperation({ summary: 'Get pending sync conflicts' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'clientId', required: false })
  getConflicts(
    @Query('facilityId') facilityId: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.syncService.getConflicts(facilityId, clientId);
  }

  @Put('conflicts/:id/resolve')
  @Auth()
  @ApiOperation({ summary: 'Resolve a sync conflict' })
  resolveConflict(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveConflictDto,
    @Request() req: any,
  ) {
    return this.syncService.resolveConflict(id, dto, req.user.id);
  }

  @Get('status')
  @Auth()
  @ApiOperation({ summary: 'Get sync status for a client' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'clientId', required: true })
  getSyncStatus(
    @Query('facilityId') facilityId: string,
    @Query('clientId') clientId: string,
  ) {
    return this.syncService.getSyncStatus(facilityId, clientId);
  }

  @Post('retry-failed')
  @Auth()
  @ApiOperation({ summary: 'Retry failed sync operations' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'clientId', required: true })
  retryFailed(
    @Query('facilityId') facilityId: string,
    @Query('clientId') clientId: string,
  ) {
    return this.syncService.retryFailed(facilityId, clientId);
  }
}
