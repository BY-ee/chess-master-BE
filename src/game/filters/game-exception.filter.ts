import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { GameException, GameErrorCode } from '../game.exception';

@Catch(GameException)
export class GameExceptionFilter implements ExceptionFilter {
  catch(exception: GameException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.BAD_REQUEST;

    switch (exception.code) {
      case GameErrorCode.ROOM_NOT_FOUND:
        status = HttpStatus.NOT_FOUND;
        break;
      case GameErrorCode.UNAUTHORIZED:
        status = HttpStatus.UNAUTHORIZED;
        break;
      // You can add more mappings here
      case GameErrorCode.ROOM_FULL:
      case GameErrorCode.ROOM_NOT_AVAILABLE:
        status = HttpStatus.BAD_REQUEST;
        break;
      case GameErrorCode.ROOM_NAME_CONFLICT:
        status = HttpStatus.CONFLICT;
        break;
      default:
        status = HttpStatus.BAD_REQUEST;
        break;
    }

    response
      .status(status)
      .json({
        statusCode: status,
        error: exception.code,
        message: exception.message,
      });
  }
}
