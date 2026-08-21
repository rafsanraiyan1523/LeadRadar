import { IsIn } from 'class-validator';
import { LeadStatus } from '@lead-radar/db';

export class UpdateLeadStatusDto {
  @IsIn(Object.values(LeadStatus))
  status!: LeadStatus;
}
