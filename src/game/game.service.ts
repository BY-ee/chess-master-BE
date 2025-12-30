import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  async createGame(data: Prisma.GameCreateInput) {
    return this.prisma.game.create({
      data,
    });
  }

  async saveGameResult(data: {
    whiteId?: number;
    blackId?: number;
    whiteAiId?: number;
    blackAiId?: number;
    pgn: string;
    result: string;
  }) {
    return this.prisma.game.create({
      data: {
        white: data.whiteId ? { connect: { id: data.whiteId } } : undefined,
        black: data.blackId ? { connect: { id: data.blackId } } : undefined,
        whiteAi: data.whiteAiId ? { connect: { id: data.whiteAiId } } : undefined,
        blackAi: data.blackAiId ? { connect: { id: data.blackAiId } } : undefined,
        pgn: data.pgn,
        result: data.result,
      },
    });
  }
}
