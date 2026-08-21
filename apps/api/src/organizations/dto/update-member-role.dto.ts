import { IsEnum } from 'class-validator';
import { OrgRole } from '@lead-radar/db';

export class UpdateMemberRoleDto {
  @IsEnum(OrgRole)
  role!: OrgRole;
}
