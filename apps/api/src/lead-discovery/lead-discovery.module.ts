import { Module } from '@nestjs/common';
import { LeadDiscoveryController } from './lead-discovery.controller';
import { LeadDiscoveryService } from './lead-discovery.service';

@Module({
  controllers: [LeadDiscoveryController],
  providers: [LeadDiscoveryService],
})
export class LeadDiscoveryModule {}
