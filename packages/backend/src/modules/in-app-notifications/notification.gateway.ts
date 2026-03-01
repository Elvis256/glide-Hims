import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connection rejected: no token`);
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret }) as any;

      const userId = payload.sub;
      const facilityId = payload.facilityId;
      const tenantId = payload.tenantId;
      const roles = payload.roles || [];

      // Store user info on socket
      client.data.userId = userId;
      client.data.facilityId = facilityId;
      client.data.tenantId = tenantId;
      client.data.roles = roles;

      // Join rooms for targeted notifications
      if (facilityId) {
        client.join(`facility:${facilityId}`);
      }
      if (userId) {
        client.join(`user:${userId}`);
      }

      this.logger.log(
        `Client ${client.id} connected: user=${userId}, facility=${facilityId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Client ${client.id} connection rejected: invalid token`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  // Join a department room (called when frontend knows user's department)
  joinDepartmentRoom(client: Socket, departmentId: string) {
    if (departmentId) {
      client.join(`department:${departmentId}`);
    }
  }

  /**
   * Send notification to all users in a specific department of a facility
   */
  sendToDepartment(
    facilityId: string,
    departmentId: string,
    event: string,
    data: any,
  ) {
    this.server
      .to(`department:${departmentId}`)
      .to(`facility:${facilityId}`)
      .emit(event, data);
  }

  /**
   * Send notification to a specific user
   */
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Send notification to all users in a facility
   */
  sendToFacility(facilityId: string, event: string, data: any) {
    this.server.to(`facility:${facilityId}`).emit(event, data);
  }

  /**
   * Send notification to specific department room only
   */
  sendToDepartmentOnly(departmentId: string, event: string, data: any) {
    this.server.to(`department:${departmentId}`).emit(event, data);
  }
}
