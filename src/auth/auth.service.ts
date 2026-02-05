import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SignupDto } from './dto/signup.dto';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService
  ) {}

  async validateUser(username: string, pass: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.usersService.findOne(username);
    if (user && await bcrypt.compare(pass, user.password)) {
      if (!user.isVerified) {
        throw new UnauthorizedException('Email not verified');
      }
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: Omit<User, 'password'>) {
    const payload = { username: user.username, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(userDto: SignupDto) {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const newUser = await this.usersService.create(userDto, verificationToken);
    
    await this.mailService.sendVerificationEmail(newUser, verificationToken);

    const { password, ...userWithoutPassword } = newUser;
    const payload = { username: newUser.username, sub: newUser.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: userWithoutPassword,
    };
  }

  async verifyEmail(token: string) {
    // We need to find the user by token
    // Since we don't have a direct method in usersService for this, we might need to add one
    // or use prisma directly if we inject it, OR (better) add findByVerificationToken to UsersService.
    const user = await this.usersService.findByVerificationToken(token);
    if (!user) {
      throw new NotFoundException('Invalid verification token');
    }
    
    return this.usersService.markEmailAsVerified(user.id);
  }

  async getUserProfile(userId: number) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, ...result } = user;
    return result;
  }
}
