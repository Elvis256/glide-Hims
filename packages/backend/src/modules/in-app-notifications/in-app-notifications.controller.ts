import { Controller, Get, Patch, Param, Query, ParseUUIDPipe, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InAppNotificationsService } from './in-app-notifications.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('in-app-notifications')
@Controller('in-app-notifications')
export class InAppNotificationsController {
  constructor(private readonly service: InAppNotificationsService) {}

  @Get()
  @AuthWithPermissions()
  @ApiOperation({ summary: 'Get notifications for current user' })
  async getNotifications(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.service.getForUser(userId, Number(page) || 1, Number(limit) || 30, req.user?.tenantId);
  }

  @Get('unread-count')
  @AuthWithPermissions()
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const count = await this.service.getUnreadCount(userId, req.user?.tenantId);
    return { count };
  }

  @Patch(':id/read')
  @AuthWithPermissions()
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    await this.service.markRead(id, userId);
    return { message: 'Notification marked as read' };
  }

  @Patch('read-all')
  @AuthWithPermissions()
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    await this.service.markAllRead(userId);
    return { message: 'All notifications marked as read' };
  }
}
