import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('models')
  async getModels() {
    return this.aiService.getAllModels();
  }

  @Get('models/:id')
  async getModel(@Param('id', ParseIntPipe) id: number) {
    return this.aiService.getModelById(id);
  }
}
