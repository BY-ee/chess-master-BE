import { Controller, Post, Get, Body, UseGuards, Request, Param, UseFilters } from '@nestjs/common';
import { GameService } from './game.service';
import { SaveGameDto } from './dto/save-game.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { AuthGuard } from '@nestjs/passport';
import { GameExceptionFilter } from './filters/game-exception.filter';

interface GameResultData {
  whiteId?: number;
  blackId?: number;
  whiteAiId?: number;
  blackAiId?: number;
  pgn: string;
  result: string;
}

@Controller('games')
@UseFilters(GameExceptionFilter)
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async saveGame(@Request() req: any, @Body() saveGameDto: SaveGameDto) {
    // For AI games, we assume the logged-in user is 'White' or 'Black' based on some logic,
    // but typically user plays White vs AI, or custom.
    // For MVP, we'll store the logged-in user as White (or just ID) and AI as BlackAi if user is White.
    // Currently schema has whiteId, blackId, whiteAiId, blackAiId.
    
    // Simplification: If mode is AI, we can't easily determine who was white/black without more info in DTO.
    // But usually 'result' + 'winnerColor' helps.
    // Let's just save the user for now.
    
    const userId = req.user.id;
    
    // Determine player capability based on configured role or DTO
    const userColor = saveGameDto.userColor || 'w'; // Default to white if not specified
    
    // Convert to PGN standard result format
    let result: string;
    if (saveGameDto.winnerColor === 'w') {
      result = '1-0';  // White wins
    } else if (saveGameDto.winnerColor === 'b') {
      result = '0-1';  // Black wins
    } else {
      result = '1/2-1/2';  // Draw
    }

    // Construct game data
    const gameData: GameResultData = {
      pgn: saveGameDto.pgn,
      result,
    };

    // Assign user to their color
    if (userColor === 'b') {
      gameData.blackId = userId;
    } else {
      gameData.whiteId = userId;
    }

    // Assign AI opponent if in AI mode
    if (saveGameDto.mode === 'ai' && saveGameDto.aiModelId) {
      if (userColor === 'b') {
        gameData.whiteAiId = saveGameDto.aiModelId;
      } else {
        gameData.blackAiId = saveGameDto.aiModelId;
      }
    }

    return this.gameService.saveGameResult(gameData);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getMyGames(@Request() req: any) {
    return this.gameService.getGamesByUserId(req.user.id);
  }

  // Matchmaking endpoints
  @Post('rooms')
  @UseGuards(AuthGuard('jwt'))
  async createRoom(@Request() req: any, @Body() createRoomDto: CreateRoomDto) {
    return this.gameService.createRoom(
      req.user.id,
      req.user.username,
      createRoomDto.roomName,
    );
  }

  @Post('rooms/:roomId/join')
  @UseGuards(AuthGuard('jwt'))
  async joinRoom(@Request() req: any, @Param('roomId') roomId: string) {
    return this.gameService.joinRoom(
      roomId,
      req.user.id,
      req.user.username,
    );
  }

  @Get('rooms/active')
  @UseGuards(AuthGuard('jwt'))
  async getMyActiveRooms(@Request() req: any) {
    return this.gameService.getUserActiveRooms(req.user.id);
  }

  @Get('rooms')
  @UseGuards(AuthGuard('jwt'))
  async getAvailableRooms() {
    return this.gameService.getAvailableRooms();
  }
}
