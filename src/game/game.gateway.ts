import { SubscribeMessage, WebSocketGateway, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { GameService } from './game.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

interface GameState {
  whiteId?: number;
  blackId?: number;
  whiteAiId?: number;
  blackAiId?: number;
  pgn: string;
}

interface AuthenticatedSocket extends Socket {
  user?: {
    id: number;
    username: string;
  };
}

@WebSocketGateway({ cors: true })
@WebSocketGateway({ cors: true })
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private onlineUsers = new Set<number>(); // Track unique user IDs

  constructor(
    private readonly gameService: GameService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    console.log('Game Gateway Initialized');
  }

  async handleConnection(client: AuthenticatedSocket, ...args: any[]) {
    try {
      // Extract token from handshake auth
      const token = client.handshake?.auth?.token;
      
      if (!token) {
        console.log('No token provided, disconnecting client');
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token);
      client.user = {
        id: payload.sub,
        username: payload.username,
      };

      // Add user to online set
      this.onlineUsers.add(client.user.id);
      
      console.log(`Client connected: ${client.id} (User: ${client.user.username})`);
      
      // Broadcast updated online count to all clients
      this.broadcastOnlineCount();
    } catch (error) {
      console.log('Invalid token, disconnecting client');
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const username = client.user?.username || 'Unknown';
    
    // Remove user from online set
    if (client.user?.id) {
      this.onlineUsers.delete(client.user.id);
    }
    
    console.log(`Client disconnected: ${client.id} (User: ${username})`);
    
    // Broadcast updated online count to all clients
    this.broadcastOnlineCount();
  }

  private broadcastOnlineCount() {
    const count = this.onlineUsers.size;
    this.server.emit('online_count', count);
    console.log(`Online users: ${count}`);
  }


  @SubscribeMessage('join_game')
  handleJoinGame(client: AuthenticatedSocket, payload: { roomId: string; whiteId?: number; blackId?: number; whiteAiId?: number; blackAiId?: number }): string {
    const { roomId } = payload;
    
    // 1. Validate Room Existence via GameService
    // Only allow joining rooms that were created via API (random matching or custom)
    const room = this.gameService.getRoom(roomId);
    
    if (!room) {
      console.log(`Connection rejected: Room ${roomId} not found`);
      client.emit('error', 'Room does not exist');
      return 'Room not found';
    }

    client.join(roomId);
    console.log(`User rejoined/joined room ${roomId}`);

    // 2. Determine Player Color (Role Persistence)
    // Uses the authoritative data from GameService, NOT the user payload (prevent spoofing)
    const userId = client.user?.id;
    let color: 'w' | 'b' | 'spectator' = 'spectator';

    if (userId) {
      if (room.whiteId === userId) color = 'w';
      else if (room.blackId === userId) color = 'b';
    }

    // 3. Send Game Start/Restore Event
    client.emit('game_start', { 
      color: color === 'spectator' ? 'w' : color, // Spectators view as White by default
      role: color, 
      pgn: room.pgn || '', 
      fen: '' 
    });
    
    return 'Game joined!';
  }

  @SubscribeMessage('make_move')
  handleMove(client: Socket, payload: { roomId: string; move: string }): string {
    const room = this.gameService.getRoom(payload.roomId);
    if (room) {
      // Append move to PGN in GameService state
      room.pgn = (room.pgn ? room.pgn + ' ' : '') + payload.move;
      
      // Broadcast move
      this.server.to(payload.roomId).emit('move_made', payload.move);
      return 'Move made!';
    }
    return 'Game not found';
  }

  @SubscribeMessage('game_end')
  async handleGameEnd(
    client: AuthenticatedSocket,
    payload: { roomId: string; winnerColor: 'w' | 'b' | null; pgn?: string },
  ): Promise<string> {
    const room = this.gameService.getRoom(payload.roomId);
    if (!room) {
      return 'Game not found';
    }

    try {
      // Convert winnerColor to PGN standard result
      let result: string;
      if (payload.winnerColor === 'w') {
        result = '1-0';
      } else if (payload.winnerColor === 'b') {
        result = '0-1';
      } else {
        result = '1/2-1/2';
      }

      // Use provided PGN or fall back to tracked moves
      const finalPgn = payload.pgn || room.pgn;

      // Save to database
      await this.gameService.saveGameResult({
        whiteId: room.whiteId,
        blackId: room.blackId,
        // AI IDs not currently tracked in room for Multiplayer, assuming user vs user for now
        pgn: finalPgn,
        result,
      });

      // Notify all clients in the room
      this.server.to(payload.roomId).emit('game_ended', {
        result,
        saved: true,
      });

      // Update room status to finished instead of deleting
      room.status = 'finished';
      room.finishedAt = new Date();
      
      // Schedule auto-deletion after 3 minutes (180s)
      this.gameService.scheduleRoomCleanup(payload.roomId, 180);

      return 'Game saved and ended';
    } catch (error) {
      console.error('Error saving game:', error);
      return 'Error saving game';
    }
  }

  @SubscribeMessage('request_rematch')
  handleRematchRequest(client: AuthenticatedSocket, payload: { roomId: string }): string {
    if (!client.user) return 'Unauthorized';
    
    try {
      const result = this.gameService.requestRematch(payload.roomId, client.user.id);
      
      // Notify other players in the room
      this.server.to(payload.roomId).emit('rematch_requested', {
        requestedBy: client.user.id,
        expiresAt: result.rematchExpiresAt
      });
      
      return 'Rematch requested';
    } catch (error) {
      client.emit('error', error.message);
      return 'Error requesting rematch';
    }
  }

  @SubscribeMessage('accept_rematch')
  handleRematchAccept(client: AuthenticatedSocket, payload: { roomId: string }): string {
    if (!client.user) return 'Unauthorized';

    try {
      const room = this.gameService.acceptRematch(payload.roomId, client.user.id);
      
      // Notify all players that game restarted
      // Since colors are swapped in service, we need to broadcast new state
      this.server.to(payload.roomId).emit('game_restarted', {
        whiteId: room.whiteId,
        blackId: room.blackId
      });
      
      // Re-emit game_start to update clients individually with their new colors
      // We need to iterate over sockets in the room to send personalized 'game_start'
      // Ideally, FE handles 'game_restarted' and refreshes/resets, but sending 'game_start' is safer
      
      return 'Rematch accepted';
    } catch (error) {
      client.emit('error', error.message);
      return 'Error accepting rematch';
    }
  }

  @SubscribeMessage('decline_rematch')
  handleRematchDecline(client: AuthenticatedSocket, payload: { roomId: string }): string {
    if (!client.user) return 'Unauthorized';

    try {
      this.gameService.declineRematch(payload.roomId, client.user.id);
      
      this.server.to(payload.roomId).emit('rematch_declined', {
        declinedBy: client.user.id
      });
      
      return 'Rematch declined';
    } catch (error) {
      // client.emit('error', error.message); // Optional
      return 'Error declining rematch';
    }
  }

  @SubscribeMessage('leave_game')
  handleLeaveGame(client: Socket, payload: { roomId: string }): string {
    const { roomId } = payload;
    client.leave(roomId);
    console.log(`Client ${client.id} left room ${roomId}`);
    return 'Left room';
  }
}
