import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SearchFiltersDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minReviews?: number;

  @IsOptional()
  @IsIn(['ANY', 'HAS_WEBSITE', 'NO_WEBSITE'])
  website?: 'ANY' | 'HAS_WEBSITE' | 'NO_WEBSITE';

  @IsOptional()
  @IsIn(['ANY', 'FOUND', 'NOT_VERIFIED'])
  googlePresence?: 'ANY' | 'FOUND' | 'NOT_VERIFIED';

  @IsOptional()
  @IsIn(['ANY', 'HIGH', 'MEDIUM', 'LOW'])
  opportunity?: 'ANY' | 'HIGH' | 'MEDIUM' | 'LOW';

  @IsOptional()
  @IsArray()
  @IsIn(
    [
      'NO_BOOKING',
      'POOR_WEBSITE',
      'WEAK_SEO',
      'LOW_REVIEWS',
      'WEAK_DIGITAL_PRESENCE',
    ],
    {
      each: true,
    },
  )
  additional?: (
    | 'NO_BOOKING'
    | 'POOR_WEBSITE'
    | 'WEAK_SEO'
    | 'LOW_REVIEWS'
    | 'WEAK_DIGITAL_PRESENCE'
  )[];
}

export class CreateSearchDto {
  @IsString()
  @MinLength(1, { message: 'Business type is required' })
  @MaxLength(120)
  query!: string;

  @IsString()
  @MinLength(1, { message: 'Location is required' })
  @MaxLength(120)
  location!: string;

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(50_000)
  radiusMeters?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  maxResults?: number;

  @IsOptional()
  @IsBoolean()
  useLiveProvider?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SearchFiltersDto)
  filters?: SearchFiltersDto;
}
