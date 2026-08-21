import { IsIn, IsOptional } from 'class-validator';
import { OutreachLanguage } from '@lead-radar/db';

export class GenerateCampaignMessagesDto {
  @IsOptional()
  @IsIn(Object.values(OutreachLanguage))
  language?: OutreachLanguage;
}
