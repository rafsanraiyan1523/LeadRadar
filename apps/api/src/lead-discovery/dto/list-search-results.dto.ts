import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListSearchResultsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsIn(['rating', 'reviewCount', 'businessName', 'createdAt'])
  sortBy?: 'rating' | 'reviewCount' | 'businessName' | 'createdAt' = 'rating';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsIn(['true', 'false'])
  hasWebsite?: 'true' | 'false';
}
