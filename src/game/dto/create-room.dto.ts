import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(30)
  roomName?: string;
}
