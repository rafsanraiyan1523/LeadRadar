import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CampaignService,
  CampaignStatus,
  OutreachChannel,
  OutreachTone,
} from '@lead-radar/db';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

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

  @IsOptional()
  @IsIn(Object.values(CampaignService))
  service?: CampaignService;

  @IsOptional()
  @IsIn(Object.values(OutreachTone))
  tone?: OutreachTone;

  @IsOptional()
  @IsIn(Object.values(OutreachChannel))
  channel?: OutreachChannel;

  @IsOptional()
  @IsIn(Object.values(CampaignStatus))
  status?: CampaignStatus;
}
