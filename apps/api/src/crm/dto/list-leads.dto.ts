import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { LeadStatus } from '@lead-radar/db';

const LEAD_STATUSES = Object.values(LeadStatus);
const WEBSITE_FILTERS = ['ANY', 'HAS_WEBSITE', 'NO_WEBSITE'] as const;
const GOOGLE_PROFILE_FILTERS = [
  'ANY',
  'FOUND',
  'NOT_FOUND_IN_CURRENT_SEARCH',
  'UNVERIFIED',
] as const;

export class ListLeadsDto {
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
  @IsIn(LEAD_STATUSES)
  status?: LeadStatus;

  @IsOptional()
  @IsString()
  category?: string;

  /** Matches against the lead's city or address (case-insensitive contains). */
  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxScore?: number;

  @IsOptional()
  @IsIn(WEBSITE_FILTERS)
  website?: (typeof WEBSITE_FILTERS)[number] = 'ANY';

  @IsOptional()
  @IsIn(GOOGLE_PROFILE_FILTERS)
  googleProfile?: (typeof GOOGLE_PROFILE_FILTERS)[number] = 'ANY';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minContactability?: number;

  /** Free-text business-name search (case-insensitive contains) — powers the command palette's live lead search. */
  @IsOptional()
  @IsString()
  search?: string;
}
