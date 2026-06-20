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
    origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
  serveClient: false,
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e6,
  allowUpgrades: true,
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
        (client.handshake.auth?.token as string) || (client.handshake.query?.token as string);
      
      // Allow connection without token (will be limited functionality)
      // but prioritize authenticated connections
      if (token) {
        try {
          const payload = this.jwtService.verify(token, {
            secret: this.configService.get<string>('JWT_SECRET'),
          });
          const userId = payload.sub || payload.userId;
          if (userId) {
            client.join(`user:${userId}`);
            client.data.userId = userId;
            this.logger.log(`Client authenticated and connected: ${userId}`);
            return;
          }
        } catch (error) {
          this.logger.warn(`JWT verification failed: ${error.message}`);
        }
      }
      
      // Allow unauthenticated connections but mark them
      client.data.userId = `anonymous:${client.id}`;
      this.logger.log(`Client connected (unauthenticated): ${client.id}`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
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
