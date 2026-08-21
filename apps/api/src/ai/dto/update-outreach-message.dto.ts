import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOutreachMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  /** The user stays in control — marking SENT only ever happens when they explicitly say so (e.g. after opening the channel themselves), never automatically. */
  @IsOptional()
  @IsIn(['DRAFT', 'SENT'])
  status?: 'DRAFT' | 'SENT';
}
