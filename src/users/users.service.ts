import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
// import { Prisma } from '@prisma/client';
// import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: any): Promise<any> {
    return this.prisma.user.create({ data });
  }

  async findOne(username: string): Promise<any> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findAll(): Promise<any> {
    return this.prisma.user.findMany();
  }
}
