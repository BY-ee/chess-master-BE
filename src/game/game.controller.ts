import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { GameService } from './game.service';
import { SaveGameDto } from './dto/save-game.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('games')
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
    
    // Default assumption for AI mode: User is White, AI is Black(?).
    // Better would be if DTO said "userColor".
    // Since DTO doesn't specify, we'll just link the user as 'whiteId' for now (or improve DTO later).
    
    const gameData: any = {
      pgn: saveGameDto.pgn,
      result: `${saveGameDto.result} (${saveGameDto.winnerColor || '-'})`,
    };

    if (saveGameDto.mode === 'ai') {
        gameData.whiteId = userId; 
        // We could also link a default AI model if we have one.
    } else {
        // User vs User via API? Usually specific match ID is needed. 
        // This endpoint seems primarily for "Client completed an offline/AI game and wants to save it".
        gameData.whiteId = userId;
    }

    return this.gameService.saveGameResult(gameData);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getMyGames(@Request() req: any) {
    return this.gameService.getGamesByUserId(req.user.id);
  }
}
