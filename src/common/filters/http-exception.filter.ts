import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error', error: 'Internal Server Error' };

    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as any;
      
      // message 처리
      if (resp.message) {
          if (Array.isArray(resp.message)) {
              message = resp.message.join(', ');
          } else {
              message = resp.message as string;
          }
      }
      
      // error 처리 (HTTP Exception인 경우 보통 error 필드가 있음)
      if (resp.error) {
          error = resp.error;
      }
    } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
    }
    
    // 500 에러이면서 명시적인 error 필드가 없는 경우 처리
    if(status === HttpStatus.INTERNAL_SERVER_ERROR && !error) {
        error = 'Internal Server Error';
    }

    const responseBody = {
      statusCode: status,
      error: error,
      message: message, 
    };

    response.status(status).json(responseBody);
  }
}
