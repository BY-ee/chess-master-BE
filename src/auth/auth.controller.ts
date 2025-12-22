import { Controller, Request, Post, UseGuards, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() req: any) {
    // In a real app, use LocalAuthGuard
    // validUser = await this.authService.validateUser(req.username, req.password)
    // if(!validUser) throw Unauthorized
    
    // For skeleton, assuming validation passes or handled in service for simplicity
    const user = await this.authService.validateUser(req.username, req.password);
    if (!user) {
        return { message: 'Invalid credentials' };
    }
    return this.authService.login(user); // returns JWT
  }

  @Post('signup')
  async signup(@Body() req: any) {
    return this.authService.register(req);
  }
}
