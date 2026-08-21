import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @MaxLength(72)
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'password must contain at least one letter and one number',
  })
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  organizationName!: string;
}
