import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { RecordsService } from './records.service';

@Controller('records')
export class RecordsController {
  constructor(private recordsService: RecordsService) {}

  @Post()
  async saveGame(@Body() gameData: any) {
    return this.recordsService.createGameRecord(gameData);
  }

  @Get('user/:id')
  async getUserHistory(@Param('id') id: string) {
    return this.recordsService.getGameHistory(Number(id));
  }
  
  @Get(':id')
  async getGame(@Param('id') id: string) {
    return this.recordsService.getGameById(Number(id));
  }
}
