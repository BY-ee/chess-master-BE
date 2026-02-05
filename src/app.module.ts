import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GameModule } from './game/game.module';
import { RecordsModule } from './records/records.module';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule, 
    UsersModule, 
    GameModule, 
    RecordsModule, 
    PrismaModule,
    AiModule,
    MailModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
