import { SubscribeMessage, WebSocketGateway, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { GameService } from './game.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { GameException } from './game.exception';

interface GameState {
  whiteId?: number;
  blackId?: number;
  whiteAiId?: number;
  blackAiId?: number;
  pgn: string;
}

interface GameSocketData {
  user?: {
    id: number;
    username: string;
  };
  matchmakingUpdateInterval?: NodeJS.Timeout;
}

interface AuthenticatedSocket extends Socket {
  user?: GameSocketData['user'];
  data: GameSocketData;
}

@WebSocketGateway({ cors: true })
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private onlineUsers = new Set<number>(); // Track unique user IDs

  constructor(
    @Inject(forwardRef(() => GameService)) private readonly gameService: GameService,
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

      // Remove from matchmaking queue if present
      this.gameService.leaveMatchmaking(userId);

      // Clear matchmaking update interval if exists
      const updateInterval = client.data.matchmakingUpdateInterval;
      if (updateInterval) {
        clearInterval(updateInterval);
      }
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

      // 3. Build player info using service helper
      const players = this.gameService.getPlayersInfo(room);

      // Determine opponent info for the joining player
      let opponent: { username: string; rating?: number } | undefined;
      if (color === 'w' && players.black) {
        opponent = players.black;
      } else if (color === 'b' && players.white) {
        opponent = players.white;
      }

      // Send Game Start/Restore Event (Initial State) with opponent info
      client.emit('game_start', { 
        color: color === 'spectator' ? 'w' : color, 
        role: color, 
        pgn: room.pgn || '', 
        fen: '',
        opponent,
        players,
      });

      // 4. Calculate Connected Players & Emit 'player_joined'
      const { count: playerCount, connectedIds: connectedUserIds } = await this.calculateConnectedPlayers(roomId, room, userId);

      // Determine rating for the joining player
      let rating: number | undefined;
      if (color === 'w') rating = players.white?.rating;
      else if (color === 'b') rating = players.black?.rating;

      // Broadcast player_joined to everyone in the room
      this.server.to(roomId).emit('player_joined', {
        userId: userId,
        username: client.user?.username,
        role: color,
        rating,
        currentPlayers: playerCount,
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
          blackId: room.blackId,
          players,
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

    // Idempotency check: Is game already finishing?
    if (room.status !== 'playing' || room.isEnding) {
        return 'Game already finished or processing';
    }

    // Lock the room
    room.isEnding = true;

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
      const { ratingChanges } = await this.gameService.saveGameResult({
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
        ratingChanges,
      });

      // Update room status to finished instead of deleting
      room.status = 'finished';
      room.finishedAt = new Date();
      
      // Schedule auto-deletion after 3 minutes (180s)
      this.gameService.scheduleRoomCleanup(payload.roomId);

      return 'Game saved and ended';
    } catch (error) {
      console.error('Error saving game:', error);
      // Release lock on error so it can be retried (or handled manually)
      room.isEnding = false;
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
      const players = this.gameService.getPlayersInfo(room);

      this.server.to(payload.roomId).emit('game_restarted', {
        whiteId: room.whiteId,
        blackId: room.blackId,
        players,
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

  @SubscribeMessage('resign_game')
  async handleResign(client: AuthenticatedSocket, payload: { roomId: string }): Promise<string> {
    if (!client.user) return 'Unauthorized';
    const { roomId } = payload;
    const room = this.gameService.getRoom(roomId);
    if (!room) return 'Room not found';

    // Idempotency check
    if (room.status !== 'playing' || room.isEnding) {
        return 'Game already finished or processing';
    }

    // Lock the room
    room.isEnding = true;

    // Determine opponent as winner
    let result: string;
    if (room.whiteId === client.user.id) {
      result = '0-1'; // White resigned -> Black wins
    } else if (room.blackId === client.user.id) {
      result = '1-0'; // Black resigned -> White wins
    } else {
      return 'Not a player';
    }

    try {
      const { ratingChanges } = await this.gameService.saveGameResult({
        whiteId: room.whiteId,
        blackId: room.blackId,
        pgn: room.pgn,
        result,
      });

      this.server.to(roomId).emit('game_ended', {
        result,
        saved: true,
        reason: 'resignation',
        ratingChanges,
      });

      room.status = 'finished';
      room.finishedAt = new Date();
      this.gameService.scheduleRoomCleanup(roomId);

      return 'Resigned';
    } catch (error) {
       console.error(error);
       room.isEnding = false; // Release lock
       return 'Error resigning';
    }
  }

  @SubscribeMessage('offer_draw')
  handleOfferDraw(client: AuthenticatedSocket, payload: { roomId: string }): string {
    if (!client.user) return 'Unauthorized';
    // Forward to opponent
    client.to(payload.roomId).emit('draw_offered', { offeredBy: client.user.id });
    return 'Draw offered';
  }

  @SubscribeMessage('accept_draw')
  async handleAcceptDraw(client: AuthenticatedSocket, payload: { roomId: string }): Promise<string> {
    if (!client.user) return 'Unauthorized';
    const { roomId } = payload;
    const room = this.gameService.getRoom(roomId);
    if (!room) return 'Room not found';

    // Idempotency check
    if (room.status !== 'playing' || room.isEnding) {
        return 'Game already finished or processing';
    }

    // Lock the room
    room.isEnding = true;

    try {
      const result = '1/2-1/2';
      const { ratingChanges } = await this.gameService.saveGameResult({
        whiteId: room.whiteId,
        blackId: room.blackId,
        pgn: room.pgn,
        result,
      });

      this.server.to(roomId).emit('game_ended', {
        result,
        saved: true,
        reason: 'draw_agreement',
        ratingChanges,
      });

      room.status = 'finished';
      room.finishedAt = new Date();
      this.gameService.scheduleRoomCleanup(roomId);
      
      return 'Draw accepted';
    } catch (e) {
      room.isEnding = false; // Release lock
      return 'Error processing draw';
    }
  }

  @SubscribeMessage('decline_draw')
  handleDeclineDraw(client: AuthenticatedSocket, payload: { roomId: string }): string {
    if (!client.user) return 'Unauthorized';
    client.to(payload.roomId).emit('draw_declined', { declinedBy: client.user.id });
    return 'Draw declined';
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

  notifyRoomCreated(room: any) {
    const publicRoom = {
      roomId: room.roomId,
      roomName: room.roomName,
      hostUsername: room.hostUsername,
      hostRating: room.hostRating,
      hostCountry: room.hostCountry,
      createdAt: room.createdAt,
    };
    this.server.emit('room_created', publicRoom);
  }

  notifyRoomDeleted(roomId: string) {
    this.server.emit('room_deleted', { roomId });
  }

  notifyRoomExpired(roomId: string) {
    this.server.to(roomId).emit('error', {
      code: 'ROOM_EXPIRED',
      message: 'The room has expired due to inactivity.',
    });
  }

  private async calculateConnectedPlayers(roomId: string, room: any, forceIncludeUserId?: number): Promise<{ count: number, connectedIds: Set<number> }> {
    const sockets = await this.server.in(roomId).fetchSockets();
    const connectedIds = new Set<number>();
    
    for (const socket of sockets) {
      const socketUserId = (socket.data as GameSocketData).user?.id;
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

  // ==================== Matchmaking System ====================

  @SubscribeMessage('matchmaking_join')
  async handleMatchmakingJoin(client: AuthenticatedSocket): Promise<string> {
    if (!client.user) {
      client.emit('error', { code: 'UNAUTHORIZED', message: 'Not authenticated' });
      return 'Unauthorized';
    }

    const userId = client.user.id;
    const username = client.user.username;

    try {
      // Join matchmaking queue
      const result = await this.gameService.joinMatchmaking(userId, username);

      console.log(`Matchmaking join result for ${username}:`, result);

      // If immediately matched
      if (result.matched && result.matchData) {
        const { roomId, opponentId } = result.matchData;

        // Emit match found to BOTH players
        // Find opponent's socket
        const allSockets = await this.server.fetchSockets();
        const opponentSocket = allSockets.find(s => (s.data as GameSocketData).user?.id === opponentId);

        // Emit to current user
        client.emit('matchmaking_found', { roomId });
        
        // Emit to opponent
        if (opponentSocket) {
          opponentSocket.emit('matchmaking_found', { roomId });
        }

        console.log(`Match created: Room ${roomId} (${username} vs Opponent ${opponentId})`);
      } else {
        // Still searching - emit searching status
        client.emit('matchmaking_searching', {
          queuePosition: result.queuePosition,
          estimatedWait: result.estimatedWait,
        });

        // Set interval to periodically update queue status (optional enhancement)
        const updateInterval = setInterval(async () => {
          // Check if user is still in queue
          const stillInQueue = this.gameService.isInMatchmakingQueue(userId);
          
          if (!stillInQueue) {
            clearInterval(updateInterval);
            return;
          }

          // Try to match again
          const queueInfo = this.gameService.getMatchmakingQueueInfo();
          const playerInQueue = queueInfo.players.find(p => p.userId === userId);

          if (playerInQueue) {
            client.emit('matchmaking_searching', {
              queuePosition: queueInfo.players.findIndex(p => p.userId === userId) + 1,
              estimatedWait: Math.max(0, 60 - playerInQueue.waitTime),
            });
          }
        }, 5000); // Update every 5 seconds

        // Store interval ID to clean up later
        client.data.matchmakingUpdateInterval = updateInterval;
      }

      return 'Joined matchmaking';
    } catch (error) {
      this.handleError(client, error);
      return 'Error joining matchmaking';
    }
  }

  @SubscribeMessage('matchmaking_leave')
  handleMatchmakingLeave(client: AuthenticatedSocket): string {
    if (!client.user) {
      client.emit('error', { code: 'UNAUTHORIZED', message: 'Not authenticated' });
      return 'Unauthorized';
    }

    const userId = client.user.id;

    try {
      // Clear update interval if exists
      const updateInterval = client.data.matchmakingUpdateInterval;
      if (updateInterval) {
        clearInterval(updateInterval);
        delete client.data.matchmakingUpdateInterval;
      }

      // Leave matchmaking queue
      const result = this.gameService.leaveMatchmaking(userId);

      console.log(`User ${client.user.username} left matchmaking:`, result);

      return result.message;
    } catch (error) {
      this.handleError(client, error);
      return 'Error leaving matchmaking';
    }
  }

  /**
   * Notify users that a match has been found
   * Called by GameService when a background match occurs
   */
  async notifyMatchFound(userId1: number, userId2: number, roomId: string) {
    const sockets = await this.server.fetchSockets();
    
    const notify = (userId: number) => {
      const socket = sockets.find(s => (s.data as GameSocketData).user?.id === userId);
      if (socket) {
        socket.emit('matchmaking_found', { roomId });
      }
    };

    notify(userId1);
    notify(userId2);
  }
}
