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
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private activeGames = new Map<string, GameState>();
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
  @SubscribeMessage('join_game')
  handleJoinGame(client: AuthenticatedSocket, payload: { roomId: string; whiteId?: number; blackId?: number; whiteAiId?: number; blackAiId?: number }): string {
    const { roomId, ...players } = payload;
    client.join(roomId);
    
    // 1. Existing Game Check & Update
    let game = this.activeGames.get(roomId);
    
    if (!game) {
      // New Game Initialization
      game = {
        ...players,
        pgn: '',
      };
      this.activeGames.set(roomId, game);
      console.log(`Game started in room ${roomId}`, players);
    } else {
      // Update missing player info (e.g. Guest joining after Host)
      if (players.whiteId && !game.whiteId) game.whiteId = players.whiteId;
      if (players.blackId && !game.blackId) game.blackId = players.blackId;
      console.log(`User rejoined room ${roomId}`);
    }

    // 2. Determine Player Color (Role Persistence)
    const userId = client.user?.id;
    let color: 'w' | 'b' | 'spectator' = 'spectator';

    if (userId) {
      if (game.whiteId === userId) color = 'w';
      else if (game.blackId === userId) color = 'b';
    }

    // 3. Send Game Start/Restore Event
    // Send state to everyone, including spectators
    client.emit('game_start', { 
      color: color === 'spectator' ? 'w' : color, // Spectators view as White by default
      role: color, // Explicit role for UI adjustments
      pgn: game.pgn, 
      fen: '' 
    });
    
    return 'Game joined!';
  }

  @SubscribeMessage('make_move')
  handleMove(client: Socket, payload: { roomId: string; move: string }): string {
    const game = this.activeGames.get(payload.roomId);
    if (game) {
      game.pgn += (game.pgn ? ' ' : '') + payload.move;
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
    const game = this.activeGames.get(payload.roomId);
    if (!game) {
      return 'Game not found';
    }

    try {
      // Convert winnerColor to PGN standard result
      let result: string;
      if (payload.winnerColor === 'w') {
        result = '1-0';  // White wins
      } else if (payload.winnerColor === 'b') {
        result = '0-1';  // Black wins
      } else {
        result = '1/2-1/2';  // Draw
      }

      // Use provided PGN or fall back to tracked moves
      const finalPgn = payload.pgn || game.pgn;

      // Save to database
      await this.gameService.saveGameResult({
        whiteId: game.whiteId,
        blackId: game.blackId,
        whiteAiId: game.whiteAiId,
        blackAiId: game.blackAiId,
        pgn: finalPgn,
        result,
      });

      // Notify all clients in the room
      this.server.to(payload.roomId).emit('game_ended', {
        result,  // PGN format: "1-0", "0-1", "1/2-1/2"
        saved: true,
      });

      // Clean up
      this.activeGames.delete(payload.roomId);
      const room = this.gameService.getRoom(payload.roomId);
      if (room) {
        this.gameService.deleteRoom(payload.roomId);
      }

      return 'Game saved and ended';
    } catch (error) {
      console.error('Error saving game:', error);
      return 'Error saving game';
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
