import { IsIn } from 'class-validator';

export const OUTREACH_CHANNELS = [
  'EMAIL',
  'WHATSAPP',
  'FACEBOOK',
  'LINKEDIN',
  'SMS',
] as const;
export const OUTREACH_TONES = [
  'PROFESSIONAL',
  'FRIENDLY',
  'CONSULTATIVE',
  'SHORT',
] as const;
export const OUTREACH_LANGUAGES = ['ENGLISH', 'BANGLA', 'BANGLISH'] as const;

export class GenerateOutreachDto {
  @IsIn(OUTREACH_CHANNELS)
  channel!: (typeof OUTREACH_CHANNELS)[number];

  @IsIn(OUTREACH_TONES)
  tone!: (typeof OUTREACH_TONES)[number];

  @IsIn(OUTREACH_LANGUAGES)
  language!: (typeof OUTREACH_LANGUAGES)[number];
}
