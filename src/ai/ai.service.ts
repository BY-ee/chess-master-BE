import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  constructor(private prisma: PrismaService) {}

  async getAllModels() {
    return this.prisma.aiModel.findMany({
      orderBy: {
        rating: 'asc',
      },
    });
  }

  async getModelById(id: number) {
    return this.prisma.aiModel.findUnique({
      where: { id },
    });
  }
}
