import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InAppNotificationService } from './in-app-notification.service';

@ApiTags('In-App Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('in-app-notifications')
export class InAppNotificationController {
  constructor(
    private readonly inAppNotificationService: InAppNotificationService,
  ) {}

  @Get()
  async getNotifications(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = req.user.id;
    const facilityId = req.user.facilityId;
    const departmentId = req.user.departmentId;

    return this.inAppNotificationService.getUserNotifications(
      userId,
      facilityId,
      departmentId,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const userId = req.user.id;
    const facilityId = req.user.facilityId;
    const departmentId = req.user.departmentId;

    const count = await this.inAppNotificationService.getUnreadCount(
      userId,
      facilityId,
      departmentId,
    );
    return { count };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    await this.inAppNotificationService.markAsRead(id, req.user.id);
    return { message: 'Notification marked as read' };
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: any) {
    await this.inAppNotificationService.markAllAsRead(
      req.user.id,
      req.user.facilityId,
      req.user.departmentId,
    );
    return { message: 'All notifications marked as read' };
  }
}
