import { Module } from '@nestjs/common';
import { CrmController } from './crm.controller';
import { LeadCrmController } from './lead-crm.controller';
import { CrmService } from './crm.service';

@Module({
  controllers: [CrmController, LeadCrmController],
  providers: [CrmService],
})
export class CrmModule {}
