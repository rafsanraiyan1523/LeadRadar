import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @MaxLength(72)
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'password must contain at least one letter and one number',
  })
  newPassword!: string;
}
