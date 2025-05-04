import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class SearchRequest {
  @IsString()
  @IsOptional()
  query?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;
}