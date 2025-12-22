import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
// import { Prisma } from '@prisma/client';
// import { Prisma } from '@prisma/client';

@Injectable()
export class RecordsService {
  constructor(private prisma: PrismaService) {}

  async createGameRecord(data: any) {
    return this.prisma.game.create({ data });
  }

  async getGameHistory(userId: number) {
    return this.prisma.game.findMany({
      where: {
        OR: [
          { whiteId: userId },
          { blackId: userId }
        ]
      }
    });
  }

  async getGameById(id: number) {
    return this.prisma.game.findUnique({ where: { id } });
  }
}
