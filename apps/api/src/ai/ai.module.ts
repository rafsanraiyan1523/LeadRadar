import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { WebsiteAuditService } from '../digital-intelligence/website-audit.service';
import { ConversionAuditService } from '../digital-intelligence/conversion-audit.service';
import { GoogleBusinessAuditService } from '../digital-intelligence/google-business-audit.service';
import { OpportunityScoringService } from '../digital-intelligence/opportunity-scoring.service';
import { GrowthOpportunityService } from '../digital-intelligence/growth-opportunity.service';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    WebsiteAuditService,
    ConversionAuditService,
    GoogleBusinessAuditService,
    OpportunityScoringService,
    GrowthOpportunityService,
  ],
  exports: [AiService],
})
export class AiModule {}
