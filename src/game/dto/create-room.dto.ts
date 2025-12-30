import { IsString, IsOptional } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsOptional()
  roomName?: string;
}
