import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CampaignService, OutreachChannel, OutreachTone } from '@lead-radar/db';

export class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetCategory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetLocation?: string;

  @IsIn(Object.values(CampaignService))
  service!: CampaignService;

  @IsIn(Object.values(OutreachTone))
  tone!: OutreachTone;

  @IsIn(Object.values(OutreachChannel))
  channel!: OutreachChannel;

  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('4', { each: true })
  leadIds!: string[];
}
