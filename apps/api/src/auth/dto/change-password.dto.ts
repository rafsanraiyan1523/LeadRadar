import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'newPassword must be at least 8 characters long' })
  @MaxLength(72)
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'newPassword must contain at least one letter and one number',
  })
  newPassword!: string;
}
