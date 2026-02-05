import { IsOptional, IsString, IsInt, Min, Max, Validate } from 'class-validator';
import { IsGreaterThanOrEqualConstraint } from './validators';
import { Type } from 'class-transformer';

export class GetRoomsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ratingMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Validate(IsGreaterThanOrEqualConstraint, ['ratingMin'])
  ratingMax?: number;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  cursor?: string;
}
