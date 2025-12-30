import { IsString, IsIn, IsOptional } from 'class-validator';

export class SaveGameDto {
  @IsString()
  @IsIn(['ai', 'user']) // basic check, though user mode handles pgn differently
  mode: string;

  @IsString()
  @IsIn(['win', 'loss', 'draw'])
  result: string;

  @IsString()
  @IsOptional()
  @IsIn(['w', 'b'])
  winnerColor?: string;

  @IsString()
  pgn: string;
}
