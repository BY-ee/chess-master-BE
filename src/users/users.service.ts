import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { SignupDto } from '../auth/dto/signup.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: SignupDto, verificationToken: string): Promise<User> {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(data.password, salt);
    
    try {
      return await this.prisma.user.create({ 
        data: {
          ...data,
          password: hashedPassword,
          verificationToken,
          isVerified: false,
        } 
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('Username or Email already exists');
      }
      throw new InternalServerErrorException();
    }
  }

  async findOne(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { verificationToken: token } });
  }

  async markEmailAsVerified(userId: number): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: true, verificationToken: null },
    });
  }

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }
}
