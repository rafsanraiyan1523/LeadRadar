import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { GoogleBusinessAuditResult } from './types';

/**
 * GoogleBusinessAuditService: the read side of the Google Business audit.
 * The live lookup (Places-permitted fields only — rating, review count,
 * hours, phone, website, address, photo availability) runs in the worker
 * (see auditGoogleBusiness in lead-enrichment.processor.ts) and is
 * persisted to GoogleBusinessProfile. This service never claims a profile
 * is absent unless that row's own status says so — see GoogleProfileStatus.
 */
@Injectable()
export class GoogleBusinessAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getForLead(leadId: string): Promise<GoogleBusinessAuditResult> {
    const profile = await this.prisma.googleBusinessProfile.findUnique({
      where: { leadId },
    });

    if (!profile) {
      return {
        status: 'UNVERIFIED',
        score: null,
        signals: null,
        reason: 'Not yet audited — run Enrich to check.',
      };
    }

    if (profile.status !== 'FOUND') {
      return {
        status: profile.status,
        score: null,
        signals: null,
        reason: profile.reason,
      };
    }

    return {
      status: 'FOUND',
      score: profile.score,
      reason: null,
      signals: {
        displayName: profile.displayName,
        primaryCategory: profile.primaryCategory,
        categories: profile.categories,
        rating: profile.rating,
        userRatingCount: profile.userRatingCount,
        businessStatus: profile.businessStatus,
        phone: profile.phone,
        websiteUrl: profile.websiteUrl,
        address: profile.address,
        openingHours: Array.isArray(profile.openingHours)
          ? (profile.openingHours as string[])
          : null,
        mapsUri: profile.mapsUri,
        photosAvailable: profile.photosAvailable,
      },
    };
  }
}
