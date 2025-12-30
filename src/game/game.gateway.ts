import { SubscribeMessage, WebSocketGateway, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { GameService } from './game.service';

interface GameState {
  whiteId?: number;
  blackId?: number;
  whiteAiId?: number;
  blackAiId?: number;
  pgn: string;
}

@WebSocketGateway({ cors: true })
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private activeGames = new Map<string, GameState>();

  constructor(private readonly gameService: GameService) {}

  afterInit(server: Server) {
    console.log('Game Gateway Initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
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
  async handleGameEnd(client: Socket, payload: { roomId: string; result: string }): Promise<string> {
    const game = this.activeGames.get(payload.roomId);
    if (game) {
      try {
        await this.gameService.saveGameResult({
          whiteId: game.whiteId,
          blackId: game.blackId,
          whiteAiId: game.whiteAiId,
          blackAiId: game.blackAiId,
          pgn: game.pgn,
          result: payload.result,
        });
        this.server.to(payload.roomId).emit('game_ended', {
          winner: payload.result.includes('White') ? 'w' : payload.result.includes('Black') ? 'b' : 'draw', 
          pgn: game.pgn 
        });
        this.activeGames.delete(payload.roomId);
        return 'Game saved and ended';
      } catch (error) {
        console.error('Error saving game:', error);
        return 'Error saving game';
      }
    }
    return 'Game not found';
  }
}
