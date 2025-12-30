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

      console.log(`Client connected: ${client.id} (User: ${client.user.username})`);
    } catch (error) {
      console.log('Invalid token, disconnecting client');
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const username = client.user?.username || 'Unknown';
    console.log(`Client disconnected: ${client.id} (User: ${username})`);
  }

  @SubscribeMessage('join_game')
  handleJoinGame(client: Socket, payload: { roomId: string; whiteId?: number; blackId?: number; whiteAiId?: number; blackAiId?: number }): string {
    const { roomId, ...players } = payload;
    client.join(roomId);
    
    if (!this.activeGames.has(roomId)) {
      this.activeGames.set(roomId, {
        ...players,
        pgn: '',
      });
      console.log(`Game started in room ${roomId}`, players);
    }
    
    // Optionally recover state if user reconnects (not fully diffed here, just basic join)
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
}
