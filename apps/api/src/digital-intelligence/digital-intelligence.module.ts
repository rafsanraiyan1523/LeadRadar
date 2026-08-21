import { Module } from '@nestjs/common';
import { DigitalIntelligenceController } from './digital-intelligence.controller';
import { WebsiteAuditService } from './website-audit.service';
import { SeoAuditService } from './seo-audit.service';
import { ConversionAuditService } from './conversion-audit.service';
import { GoogleBusinessAuditService } from './google-business-audit.service';
import { OpportunityScoringService } from './opportunity-scoring.service';
import { GrowthOpportunityService } from './growth-opportunity.service';

@Module({
  controllers: [DigitalIntelligenceController],
  providers: [
    WebsiteAuditService,
    SeoAuditService,
    ConversionAuditService,
    GoogleBusinessAuditService,
    OpportunityScoringService,
    GrowthOpportunityService,
  ],
})
export class DigitalIntelligenceModule {}
