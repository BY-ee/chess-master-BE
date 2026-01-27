import { SubscribeMessage, WebSocketGateway, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { GameService } from './game.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { GameException } from './game.exception';

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

      // Store user in data for fetchSockets() access
      client.data.user = client.user;

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

  async handleDisconnect(client: AuthenticatedSocket) {
    const username = client.user?.username || 'Unknown';
    const userId = client.user?.id;
    
    // Remove user from online set
    if (userId) {
      this.onlineUsers.delete(userId);
    }
    
    console.log(`Client disconnected: ${client.id} (User: ${username})`);
    
    // Broadcast updated online count to all clients
    this.broadcastOnlineCount();

    // Check if user was in a game room and notify others
    // Since Socket.IO automatically removes the socket from rooms on disconnect,
    // we can't iterate client.rooms here reliably.
    // However, for MVP, we might need a way to look up which room the user was in.
    // For now, let's skip complex reverse-lookup unless 'leave_game' is explicitly called,
    // OR we iterate active rooms in GameService to find the user (expensive).
    //
    // ALTERNATIVE: Rely on 'leave_game' for clean exits, but for disconnections:
    // We can try to find rooms where this user is White or Black.
    if (userId) {
      this.broadcastPlayerLeft(userId, username);
    }
  }

  // Helper to find and notify rooms where the disconnected user was a player
  private async broadcastPlayerLeft(userId: number, username: string) {
    // This is a bit inefficient (O(N) rooms), but fine for MVP scale.
    // Ideally GameService should map userId -> roomId.
    const availableRooms = this.gameService.getAvailableRooms(); // Only gets waiting rooms... we need ALL active rooms.
    // We can't easily access private 'rooms' map in GameService without a new method.
    // Let's add a method to GameService to find room by userId if needed, 
    // BUT for now, let's implement the logic in `handleLeaveGame` first, which is simpler.
    
    // Actually, let's just use the `leave_game` handler for explicit leaves.
    // For unexpected disconnects, we might need the GameService to expose a "findRoomByPlayerId" method.
    // Let's defer "automatic disconnect broadcast" for a moment and focus on `handleLeaveGame` per request.
    //
    // Wait, the request says "Trigger: When a socket disconnects OR leave_game is called".
    // So we DO need to handle disconnect.
    
    const room = this.gameService.findRoomByUserId(userId);
    if (room) {
        const roomId = room.roomId;
        // Calculate remaining players
        // Since this user just disconnected, they are technically "gone".
        // Use fetchSockets to count remaining.
        const { count: playerCount } = await this.calculateConnectedPlayers(roomId, room);

         this.server.to(roomId).emit('player_left', {
             userId,
             username,
             currentPlayers: playerCount
         });
    }
  }

  private broadcastOnlineCount() {
    const count = this.onlineUsers.size;
    this.server.emit('online_count', count);
    console.log(`Online users: ${count}`);
  }


  @SubscribeMessage('join_game')
  async handleJoinGame(client: AuthenticatedSocket, payload: { roomId: string }): Promise<string> {
    const { roomId } = payload;
    
    // 1. Validate Room Existence via GameService
    try {
      const room = this.gameService.getRoom(roomId);
      
      if (!room) {
        console.log(`Connection rejected: Room ${roomId} not found`);
        client.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room does not exist' });
        return 'Room not found';
      }

      client.join(roomId);
      console.log(`User ${client.user?.username} (ID: ${client.user?.id}) joined room ${roomId}`);

      // 2. Determine Player Color (Role Persistence)
      const userId = client.user?.id;
      let color: 'w' | 'b' | 'spectator' = 'spectator';

      if (userId) {
        if (room.whiteId === userId) color = 'w';
        else if (room.blackId === userId) color = 'b';
      }

      // 3. Send Game Start/Restore Event (Initial State)
      client.emit('game_start', { 
        color: color === 'spectator' ? 'w' : color, 
        role: color, 
        pgn: room.pgn || '', 
        fen: '' 
      });

      // 4. Calculate Connected Players & Emit 'player_joined'
      // 4. Calculate Connected Players & Emit 'player_joined'
      const { count: playerCount, connectedIds: connectedUserIds } = await this.calculateConnectedPlayers(roomId, room, userId);

      // Broadcast player_joined to everyone in the room
      this.server.to(roomId).emit('player_joined', {
        userId: userId,
        username: client.user?.username,
        role: color,
        currentPlayers: playerCount // Updated count
      });

      // 5. Check Game Ready Condition
      // If both White and Black slots are filled AND both are connected
      if (room.whiteId && room.blackId && 
          connectedUserIds.has(room.whiteId) && 
          connectedUserIds.has(room.blackId)) {
        
        console.log(`Game Room ${roomId} is READY (Both players connected)`);
        this.server.to(roomId).emit('game_ready', {
          roomId,
          whiteId: room.whiteId,
          blackId: room.blackId
        });
      }
      
      return 'Game joined!';
    } catch (error) {
       client.emit('error', { code: 'GENERIC_ERROR', message: error.message });
       return 'Error joining';
    }
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
      this.handleError(client, error);
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
      this.handleError(client, error);
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
      this.handleError(client, error);
      return 'Error declining rematch';
    }
  }

  private handleError(client: Socket, error: any) {
    if (error instanceof GameException) {
      client.emit('error', { code: error.code, message: error.message });
    } else {
      client.emit('error', { code: 'GENERIC_ERROR', message: error.message || 'Unknown error' });
    }
  }


  @SubscribeMessage('leave_game')
  async handleLeaveGame(client: AuthenticatedSocket, payload: { roomId: string }): Promise<string> {
    const { roomId } = payload;
    client.leave(roomId);
    console.log(`Client ${client.id} left room ${roomId}`);
    
    if (client.user) {
        const room = this.gameService.getRoom(roomId);
        if (room) {
            // Calculate remaining players
             // Calculate remaining players
             const { count: playerCount } = await this.calculateConnectedPlayers(roomId, room);

            this.server.to(roomId).emit('player_left', {
                userId: client.user.id,
                username: client.user.username,
                currentPlayers: playerCount
            });
        }
    }
    
    return 'Left room';
  }

  private async calculateConnectedPlayers(roomId: string, room: any, forceIncludeUserId?: number): Promise<{ count: number, connectedIds: Set<number> }> {
    const sockets = await this.server.in(roomId).fetchSockets();
    const connectedIds = new Set<number>();
    
    for (const socket of sockets) {
      const socketUserId = (socket.data as any).user?.id;
      if (socketUserId) connectedIds.add(socketUserId);
    }
    
    if (forceIncludeUserId) {
      connectedIds.add(forceIncludeUserId);
    }

    let count = 0;
    if (room.whiteId && connectedIds.has(room.whiteId)) count++;
    if (room.blackId && connectedIds.has(room.blackId)) count++;

    return { count, connectedIds };
  }
}
