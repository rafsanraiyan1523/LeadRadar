import { IsUUID } from 'class-validator';
import { GenerateOutreachDto } from './generate-outreach.dto';

export class GenerateFollowUpDto extends GenerateOutreachDto {
  /** The prior OutreachMessage this follow-up responds to — looked up server-side, never trusted from client-supplied text. */
  @IsUUID()
  previousMessageId!: string;
}
