import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(o => o.trim()),
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string);
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      const userId = payload.sub || payload.userId;
      if (!userId) {
        client.disconnect();
        return;
      }
      // Join a room named after the user's ID
      client.join(`user:${userId}`);
      client.data.userId = userId;
      this.logger.log(`Client connected: ${userId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data?.userId) {
      this.logger.log(`Client disconnected: ${client.data.userId}`);
    }
  }

  /** Send a notification to a specific user */
  sendToUser(userId: string, notification: Record<string, any>) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  /** Send a notification to multiple users */
  sendToUsers(userIds: string[], notification: Record<string, any>) {
    for (const uid of userIds) {
      this.server.to(`user:${uid}`).emit('notification', notification);
    }
  }
}
