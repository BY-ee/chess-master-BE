import { Controller, Request, Post, UseGuards, Body, UnauthorizedException, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    // In a real app, use LocalAuthGuard
    // validUser = await this.authService.validateUser(req.username, req.password)
    // if(!validUser) throw Unauthorized
    
    // For skeleton, assuming validation passes or handled in service for simplicity
    const user = await this.authService.validateUser(loginDto.username, loginDto.password);
    if (!user) {
        throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user); // returns JWT
  }

  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.register(signupDto);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Request() req: { user: { id: number; username: string } }) {
    return this.authService.getUserProfile(req.user.id);
  }
}
