import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFollowUpDto {
  @IsISO8601()
  dueAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
