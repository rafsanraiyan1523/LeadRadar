/**
 * Demo dataset for the zero-cost demo mode (MOCK_GOOGLE=true, MOCK_AI=true,
 * MOCK_DATA=true). Populates one organization with a realistic spread of
 * businesses/leads across every stage of the product — pipeline, audits,
 * AI insight, outreach, campaigns, analytics — so the app has something to
 * show immediately after `pnpm db:seed`, without needing to manually search
 * and save dozens of leads first.
 *
 * Idempotent-ish: re-running against a database that already has this
 * demo org's data will fail on unique constraints (email, org slug) rather
 * than silently duplicating — see README's "Demo mode" section for the
 * reset-then-seed workflow (`prisma migrate reset` runs this automatically).
 *
 * Skips entirely if MOCK_DATA=false — the seed script is itself gated by
 * the same flag that governs whether the rest of the demo-mode stack
 * pretends to be a real deployment, so a "real" environment can opt out of
 * synthetic data with one env var.
 */
import { hash } from '@node-rs/argon2';
import {
  PrismaClient,
  type LeadStatus,
  type OutreachChannel,
  type OutreachTone,
  type OutreachLanguage,
  type CampaignService,
  type GoogleProfileStatus,
} from '@lead-radar/db';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — same seed every run, so the demo dataset
// is reproducible (useful for screenshots/docs that reference specific
// leads) without needing to commit 200 hand-written fixture objects.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260821);
const rand = () => rng();
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[randInt(0, arr.length - 1)]!;
const chance = (p: number) => rand() < p;
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// ---------------------------------------------------------------------------
// Business name generation — 30 adjectives x 10 categories = 300 possible
// combinations, shuffled and sliced to 200 guaranteed-unique names.
// ---------------------------------------------------------------------------
const ADJECTIVES = [
  'Golden', 'Royal', 'Metro', 'Prime', 'Elite', 'Sunrise', 'Green', 'City', 'Star', 'Modern',
  'Classic', 'Urban', 'Bright', 'Grand', 'Silver', 'Pearl', 'Crystal', 'Riverside', 'Skyline',
  'Heritage', 'Harmony', 'Radiant', 'Vibrant', 'Trusted', 'Premier', 'Central', 'Cozy', 'Elegant',
  'Swift', 'Comfort',
] as const;

const CATEGORIES = [
  'Dental Clinic', 'Hair Salon', 'Restaurant', 'Auto Repair Shop', 'Law Firm',
  'Real Estate Agency', 'Fitness Studio', 'Coffee Shop', 'Photography Studio',
  'Boutique Clothing Store',
] as const;

const LOCATIONS = [
  'Banani', 'Gulshan', 'Dhanmondi', 'Uttara', 'Mirpur', 'Bashundhara', 'Mohammadpur', 'Baridhara',
] as const;

const TAGS: { name: string; color: string }[] = [
  { name: 'Hot Lead', color: '#e5484d' },
  { name: 'Follow Up', color: '#f76b15' },
  { name: 'No Website', color: '#8e4ec6' },
  { name: 'High Opportunity', color: '#30a46c' },
  { name: 'Referral', color: '#0090ff' },
  { name: 'Cold', color: '#6b7280' },
  { name: 'VIP', color: '#ffb224' },
  { name: 'Needs SEO', color: '#e93d82' },
];

const OUTREACH_CHANNELS: OutreachChannel[] = ['EMAIL', 'WHATSAPP', 'FACEBOOK', 'LINKEDIN', 'SMS'];
const OUTREACH_TONES: OutreachTone[] = ['PROFESSIONAL', 'FRIENDLY', 'CONSULTATIVE', 'SHORT'];
const OUTREACH_LANGUAGES: OutreachLanguage[] = ['ENGLISH', 'BANGLA', 'BANGLISH'];

// Weighted so the pipeline looks like a real, mid-flight CRM: lots of NEW/
// SAVED leads at the top of the funnel, tapering off toward WON/LOST.
const LEAD_STATUS_WEIGHTS: [LeadStatus, number][] = [
  ['NEW', 60], ['SAVED', 40], ['CONTACTED', 35], ['REPLIED', 20], ['INTERESTED', 15],
  ['MEETING', 10], ['PROPOSAL', 8], ['WON', 7], ['LOST', 5],
];
function weightedLeadStatuses(count: number): LeadStatus[] {
  const pool: LeadStatus[] = [];
  for (const [status, weight] of LEAD_STATUS_WEIGHTS) for (let i = 0; i < weight; i++) pool.push(status);
  return shuffle(pool).slice(0, count);
}

// Turns a 0-100 score into a plausible boolean breakdown for the given
// checklist keys — higher score means more (in score order) true flags, so
// the checklist the UI renders actually agrees with the ring/number next to
// it, matching what a real audit run would produce.
function breakdownFromScore<K extends string>(score: number, keys: K[]): Record<K, boolean> {
  const trueCount = Math.round((score / 100) * keys.length);
  const result = {} as Record<K, boolean>;
  keys.forEach((key, i) => {
    result[key] = i < trueCount;
  });
  return result;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// Dhaka is roughly 23.7-23.9 N, 90.35-90.45 E — enough spread across
// locations to look real on the map view without being precise geocoding.
function dhakaCoords(): { latitude: number; longitude: number } {
  return { latitude: 23.7 + rand() * 0.2, longitude: 90.35 + rand() * 0.1 };
}

interface BusinessSeed {
  businessName: string;
  category: string;
  location: string;
  hasWebsite: boolean;
  hasGoogleProfile: boolean;
  rating: number | null;
  reviewCount: number | null;
  googlePlaceId: string | null;
}

function generateBusinesses(count: number): BusinessSeed[] {
  const combos: { adjective: string; category: string }[] = [];
  for (const category of CATEGORIES) for (const adjective of ADJECTIVES) combos.push({ adjective, category });
  const picked = shuffle(combos).slice(0, count);

  return picked.map((c, i) => {
    const hasGoogleProfile = chance(0.75);
    const hasWebsite = chance(0.6);
    return {
      businessName: `${c.adjective} ${c.category}`,
      category: c.category,
      location: pick(LOCATIONS),
      hasWebsite,
      hasGoogleProfile,
      rating: hasGoogleProfile ? Math.round((2.8 + rand() * 2.2) * 10) / 10 : null,
      reviewCount: hasGoogleProfile ? randInt(3, 480) : null,
      googlePlaceId: hasGoogleProfile ? `ChIJdemo${i.toString(36)}${randInt(1000, 9999)}` : null,
    };
  });
}

async function main() {
  if (process.env.MOCK_DATA === 'false') {
    console.log('MOCK_DATA=false — skipping demo dataset seed.');
    return;
  }

  console.log('Seeding LeadRadar demo dataset...');

  // ---- Organization + demo user -------------------------------------------
  const passwordHash = await hash('demo12345');
  const user = await prisma.user.create({
    data: {
      email: 'demo@leadradar.app',
      passwordHash,
      name: 'Demo User',
      emailVerifiedAt: new Date(),
    },
  });
  const org = await prisma.organization.create({
    data: { name: 'Demo Agency', slug: 'demo-agency' },
  });
  await prisma.organizationMember.create({
    data: { organizationId: org.id, userId: user.id, role: 'OWNER' },
  });
  console.log(`  created org "${org.name}" and user ${user.email}`);

  // ---- Tags -----------------------------------------------------------------
  const tags = await Promise.all(
    TAGS.map((t) => prisma.tag.create({ data: { organizationId: org.id, name: t.name, color: t.color } })),
  );

  // ---- Leads ------------------------------------------------------------
  const businesses = generateBusinesses(200);
  const statuses = weightedLeadStatuses(businesses.length);
  const leadIds: string[] = [];

  for (let i = 0; i < businesses.length; i++) {
    const b = businesses[i]!;
    const status = statuses[i]!;
    const enrich = chance(0.75); // 150-ish of 200 get a full audit pass
    const { latitude, longitude } = dhakaCoords();
    const websiteUrl = b.hasWebsite
      ? `https://www.${b.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example.com`
      : null;
    const phone = `+8801${randInt(3, 9)}${String(randInt(0, 99999999)).padStart(8, '0')}`;
    const email = chance(0.7)
      ? `contact@${b.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example.com`
      : null;

    // Opportunity is highest for legit-but-digitally-weak businesses: has a
    // Google profile (real, findable) but no website / a weak one. Never
    // fabricated for un-enriched leads — matches the app's own rule that a
    // score only exists once a real audit has run.
    const digitalWeakness = b.hasWebsite ? randInt(20, 70) : randInt(70, 95);
    const opportunityScore = enrich
      ? Math.max(0, Math.min(100, Math.round(digitalWeakness * 0.7 + (b.hasGoogleProfile ? 15 : 0) + randInt(-10, 10))))
      : null;

    const lead = await prisma.lead.create({
      data: {
        organizationId: org.id,
        createdByUserId: user.id,
        businessName: b.businessName,
        category: b.category,
        address: `${randInt(1, 200)} Road ${randInt(1, 27)}, ${b.location}`,
        city: 'Dhaka',
        country: 'Bangladesh',
        latitude,
        longitude,
        googlePlaceId: b.googlePlaceId,
        googleMapsUri: b.googlePlaceId
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.businessName + ' ' + b.location + ' Dhaka')}`
          : null,
        rating: b.rating,
        reviewCount: b.reviewCount,
        businessStatus: chance(0.95) ? 'OPERATIONAL' : 'CLOSED_TEMPORARILY',
        websiteUrl,
        phone,
        email,
        opportunityScore,
        leadStatus: status,
        enrichmentStatus: enrich ? 'COMPLETED' : 'NOT_STARTED',
        enrichmentProgress: enrich ? 100 : 0,
        lastEnrichedAt: enrich ? daysAgo(randInt(0, 30)) : null,
        createdAt: daysAgo(randInt(1, 90)),
      },
    });
    leadIds.push(lead.id);

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        organizationId: org.id,
        userId: user.id,
        type: 'lead.saved_from_search',
        metadata: { query: b.category, location: `${b.location}, Dhaka` },
        createdAt: lead.createdAt,
      },
    });

    if (status !== 'NEW') {
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          organizationId: org.id,
          userId: user.id,
          type: 'lead.status_changed',
          metadata: { from: 'NEW', to: status },
          createdAt: daysAgo(randInt(0, 60)),
        },
      });
    }

    if (enrich) {
      const seoScore = randInt(20, 95);
      const mobileScore = randInt(30, 95);
      const conversionScore = randInt(20, 90);
      const technicalScore = randInt(30, 95);
      const accessibilityScore = randInt(30, 90);
      const websiteScore = b.hasWebsite
        ? Math.round((seoScore + mobileScore + conversionScore + technicalScore + accessibilityScore) / 5)
        : null;
      const contactabilityScore = randInt(20, 100);
      const hasSsl = b.hasWebsite ? chance(0.8) : null;

      await prisma.websiteAudit.create({
        data: {
          leadId: lead.id,
          websiteScore,
          performanceScore: b.hasWebsite ? randInt(30, 95) : null,
          seoScore: b.hasWebsite ? seoScore : null,
          mobileScore: b.hasWebsite ? mobileScore : null,
          conversionScore: b.hasWebsite ? conversionScore : null,
          technicalScore: b.hasWebsite ? technicalScore : null,
          accessibilityScore: b.hasWebsite ? accessibilityScore : null,
          contactabilityScore,
          hasSsl,
          isMobileFriendly: b.hasWebsite ? mobileScore > 60 : null,
          techStack: b.hasWebsite ? shuffle(['WordPress', 'Shopify', 'React', 'Wix', 'Squarespace']).slice(0, randInt(0, 2)) : [],
          issues: b.hasWebsite
            ? shuffle([
                'Missing meta description',
                'No structured data found',
                'Slow homepage load time',
                'No sitemap.xml detected',
                'Missing alt text on images',
              ]).slice(0, randInt(1, 4))
            : ['No website found for this business'],
          signals: b.hasWebsite
            ? {
                seo: {
                  score: seoScore,
                  breakdown: breakdownFromScore(seoScore, [
                    'hasTitle', 'hasMetaDescription', 'hasH1', 'hasCanonical', 'hasViewport',
                    'hasSitemap', 'hasStructuredData', 'hasOpenGraph', 'notBlockedByRobots',
                  ]),
                },
                mobile: {
                  score: mobileScore,
                  breakdown: breakdownFromScore(mobileScore, ['hasViewportMeta', 'viewportConfiguredForDevice']),
                },
                conversion: {
                  score: conversionScore,
                  breakdown: breakdownFromScore(conversionScore, [
                    'hasContactCta', 'phoneVisible', 'emailVisible', 'hasBookingCta', 'hasContactPage', 'hasServicePages',
                  ]),
                },
                technical: {
                  score: technicalScore,
                  breakdown: breakdownFromScore(technicalScore, [
                    'https', 'hasCanonical', 'hasSitemap', 'hasStructuredData', 'noBrokenLinksDetected', 'techStackDetected',
                  ]),
                },
                performance: { homepageResponseTimeMs: randInt(200, 4000), homepageSizeBytes: randInt(50_000, 2_000_000) },
                brokenLinksChecked: randInt(0, 4),
                brokenLinksFound: randInt(0, 1),
              }
            : { seo: null, mobile: null, conversion: null, technical: null, performance: { homepageResponseTimeMs: null, homepageSizeBytes: null }, brokenLinksChecked: 0, brokenLinksFound: 0 },
          auditedAt: lead.lastEnrichedAt!,
        },
      });

      await prisma.opportunityScore.create({
        data: {
          leadId: lead.id,
          score: opportunityScore!,
          breakdown: {
            legitimacy: {
              ratingPoints: b.rating ? Math.round(b.rating * 4) : 0,
              reviewVolumePoints: b.reviewCount ? Math.min(20, Math.round(b.reviewCount / 20)) : 0,
              operationalPoints: 10,
              total: b.rating ? Math.round(b.rating * 4) + Math.min(20, Math.round((b.reviewCount ?? 0) / 20)) + 10 : 10,
            },
            digitalWeakness: { averageDigitalScore: digitalWeakness, points: Math.round((100 - digitalWeakness) * 0.4) },
            pillars: {
              websiteScore, seoScore: b.hasWebsite ? seoScore : null, mobileScore: b.hasWebsite ? mobileScore : null,
              conversionScore: b.hasWebsite ? conversionScore : null, technicalScore: b.hasWebsite ? technicalScore : null,
              contactabilityScore, googleProfileScore: b.hasGoogleProfile ? randInt(40, 95) : null,
            },
          },
          calculatedAt: lead.lastEnrichedAt!,
        },
      });

      const findingPool: { type: string; title: string; evidence: string; recommendation: string; impact: 'LOW' | 'MEDIUM' | 'HIGH' }[] = [
        { type: 'website', title: b.hasWebsite ? 'Website loads slowly on mobile' : 'No website found', evidence: b.hasWebsite ? `Homepage took ${randInt(4, 12)}s to load in testing.` : 'No website URL is listed on Google Business or discoverable via search.', recommendation: b.hasWebsite ? 'Optimize images and enable caching to cut load time.' : 'Build a simple, fast website with contact info and services.', impact: b.hasWebsite ? 'MEDIUM' : 'HIGH' },
        { type: 'seo', title: 'Missing meta description', evidence: 'The homepage has no meta description tag.', recommendation: 'Add a concise meta description summarizing services and location.', impact: 'MEDIUM' },
        { type: 'conversion', title: 'No clear call-to-action', evidence: 'No visible "Contact us" or "Book now" button on the homepage.', recommendation: 'Add a prominent contact/booking CTA above the fold.', impact: 'HIGH' },
        { type: 'google-business', title: b.hasGoogleProfile ? 'Google Business profile has few recent reviews' : 'No Google Business profile found', evidence: b.hasGoogleProfile ? `Only ${b.reviewCount} reviews, last review over 60 days old.` : 'This business could not be found on Google Business.', recommendation: b.hasGoogleProfile ? 'Ask recent customers for reviews to build trust and ranking.' : 'Create and verify a Google Business Profile.', impact: 'HIGH' },
        { type: 'mobile', title: 'Site is not mobile-friendly', evidence: 'Viewport meta tag missing; text is not readable on small screens.', recommendation: 'Add responsive design so the site works well on phones.', impact: 'MEDIUM' },
        { type: 'social', title: 'No active social media presence', evidence: 'No linked Facebook or Instagram profile found.', recommendation: 'Set up a Facebook/Instagram page to reach local customers.', impact: 'LOW' },
      ];
      for (const f of shuffle(findingPool).slice(0, randInt(2, 4))) {
        await prisma.growthOpportunity.create({
          data: { leadId: lead.id, type: f.type, title: f.title, evidence: f.evidence, recommendation: f.recommendation, impact: f.impact },
        });
      }

      const googleStatus: GoogleProfileStatus = b.hasGoogleProfile ? 'FOUND' : chance(0.5) ? 'NOT_FOUND_IN_CURRENT_SEARCH' : 'UNVERIFIED';
      await prisma.googleBusinessProfile.create({
        data: {
          leadId: lead.id,
          status: googleStatus,
          score: googleStatus === 'FOUND' ? randInt(30, 95) : null,
          reason: googleStatus === 'FOUND' ? null : 'No verified Google Business listing could be matched for this business.',
          placeId: b.googlePlaceId,
          displayName: googleStatus === 'FOUND' ? b.businessName : null,
          primaryCategory: googleStatus === 'FOUND' ? b.category : null,
          categories: googleStatus === 'FOUND' ? [b.category] : [],
          rating: googleStatus === 'FOUND' ? b.rating : null,
          userRatingCount: googleStatus === 'FOUND' ? b.reviewCount : null,
          businessStatus: googleStatus === 'FOUND' ? 'OPERATIONAL' : null,
          phone: googleStatus === 'FOUND' ? phone : null,
          websiteUrl: googleStatus === 'FOUND' ? websiteUrl : null,
          address: googleStatus === 'FOUND' ? `${b.location}, Dhaka, Bangladesh` : null,
          mapsUri: googleStatus === 'FOUND' ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.businessName)}` : null,
          photosAvailable: googleStatus === 'FOUND' ? chance(0.6) : null,
          fetchedAt: lead.lastEnrichedAt!,
        },
      });

      await prisma.leadContact.createMany({
        data: [
          { leadId: lead.id, type: 'PHONE', value: phone, source: b.hasGoogleProfile ? 'GOOGLE_PLACES' : 'MANUAL', verified: true },
          ...(email ? [{ leadId: lead.id, type: 'EMAIL' as const, value: email, source: 'WEBSITE' as const, verified: chance(0.7) }] : []),
          ...(websiteUrl ? [{ leadId: lead.id, type: 'WEBSITE' as const, value: websiteUrl, source: 'GOOGLE_PLACES' as const, verified: true }] : []),
        ],
      });

      if (chance(0.4)) {
        await prisma.leadSocialProfile.create({
          data: { leadId: lead.id, platform: 'FACEBOOK', url: `https://facebook.com/${b.businessName.toLowerCase().replace(/\s+/g, '')}` },
        });
      }

      if (b.hasWebsite && websiteUrl) {
        await prisma.leadWebsite.create({
          data: {
            leadId: lead.id,
            url: websiteUrl,
            isReachable: true,
            hasSsl,
            technologies: shuffle(['WordPress', 'React', 'Shopify']).slice(0, randInt(0, 2)),
            metadata: { title: b.businessName, pagesCrawled: randInt(1, 5) },
            pagesCrawled: randInt(1, 5),
            lastCheckedAt: lead.lastEnrichedAt,
          },
        });
      }

      await prisma.leadActivity.create({
        data: {
          leadId: lead.id, organizationId: org.id, userId: user.id,
          type: 'lead.audit_completed',
          metadata: { opportunityScore, websiteScore },
          createdAt: lead.lastEnrichedAt!,
        },
      });
    }

    // AI insight + outreach for a subset of engaged leads.
    if (enrich && ['CONTACTED', 'REPLIED', 'INTERESTED', 'MEETING', 'PROPOSAL', 'WON'].includes(status) && chance(0.8)) {
      await prisma.aIInsight.create({
        data: {
          leadId: lead.id,
          summary: `${b.businessName} is a ${b.category.toLowerCase()} in ${b.location}, Dhaka${b.rating ? ` with a ${b.rating}-star Google rating across ${b.reviewCount} reviews` : ''}. ${b.hasWebsite ? 'They have a website but it shows clear room for improvement.' : 'They have no website, which is limiting how customers can find and book with them.'}`,
          growthAnalysis: `The biggest opportunity here is ${b.hasWebsite ? 'improving SEO and mobile experience' : 'building a first website with clear contact and booking options'}. Given the business is already active and has real customer traffic, digital improvements should convert quickly.`,
          recommendedServices: b.hasWebsite ? ['SEO', 'ONLINE_BOOKING'] : ['WEBSITE_DEVELOPMENT', 'GOOGLE_BUSINESS_OPTIMIZATION'],
          providerMode: 'MOCK',
          model: 'mock-v1',
          inputsHash: `seed-${lead.id.slice(0, 8)}`,
          generatedAt: daysAgo(randInt(0, 20)),
        },
      });

      const messageCount = randInt(1, 2);
      for (let m = 0; m < messageCount; m++) {
        const channel = pick(OUTREACH_CHANNELS);
        const tone = pick(OUTREACH_TONES);
        const language = pick(OUTREACH_LANGUAGES);
        const sent = m === 0 && ['REPLIED', 'INTERESTED', 'MEETING', 'PROPOSAL', 'WON'].includes(status);
        await prisma.outreachMessage.create({
          data: {
            leadId: lead.id,
            generatedByUserId: user.id,
            kind: 'OUTREACH',
            channel,
            tone,
            language,
            subject: channel === 'EMAIL' ? `Quick idea for ${b.businessName}` : null,
            body: `Hi ${b.businessName} team, I came across your business while researching ${b.category.toLowerCase()}s in ${b.location}. ${b.hasWebsite ? 'I noticed a few quick wins that could help more customers find you online.' : "I noticed you don't have a website yet, which could be costing you customers who search online first."} Would you be open to a quick chat this week?`,
            status: sent ? 'SENT' : 'DRAFT',
            providerMode: 'MOCK',
            model: 'mock-v1',
            sentAt: sent ? daysAgo(randInt(0, 15)) : null,
            createdAt: daysAgo(randInt(0, 25)),
          },
        });
      }

      await prisma.leadActivity.create({
        data: {
          leadId: lead.id, organizationId: org.id, userId: user.id,
          type: 'lead.message_generated',
          metadata: { channel: pick(OUTREACH_CHANNELS) },
          createdAt: daysAgo(randInt(0, 20)),
        },
      });
    }

    // Tags for roughly half the leads.
    if (chance(0.5)) {
      const leadTags = shuffle(tags).slice(0, randInt(1, 3));
      await prisma.leadTag.createMany({ data: leadTags.map((t) => ({ leadId: lead.id, tagId: t.id })) });
    }

    // Notes for engaged leads.
    if (['CONTACTED', 'REPLIED', 'INTERESTED', 'MEETING', 'PROPOSAL', 'WON', 'LOST'].includes(status) && chance(0.5)) {
      const notePool = [
        'Spoke on the phone — interested but wants a proposal in writing.',
        'Left a voicemail, will follow up next week.',
        'Owner mentioned budget is tight right now, revisit next quarter.',
        'Very responsive over WhatsApp, seems like a strong fit.',
        'Referred by an existing client — warm lead.',
      ];
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id, organizationId: org.id, userId: user.id,
          type: 'lead.note_added',
          metadata: { text: pick(notePool) },
          createdAt: daysAgo(randInt(0, 30)),
        },
      });
    }

    // Follow-ups for a subset — mix of upcoming, done, and cancelled.
    if (chance(0.15)) {
      const roll = rand();
      const followUpStatus = roll < 0.5 ? 'PENDING' : roll < 0.8 ? 'DONE' : 'CANCELLED';
      await prisma.followUp.create({
        data: {
          leadId: lead.id, organizationId: org.id, userId: user.id,
          dueAt: followUpStatus === 'PENDING' ? daysFromNow(randInt(1, 14)) : daysAgo(randInt(1, 20)),
          note: 'Check in about the proposal.',
          status: followUpStatus,
          completedAt: followUpStatus === 'DONE' ? daysAgo(randInt(0, 5)) : null,
        },
      });
    }

    // Saved by the demo user for a subset.
    if (status !== 'NEW' || chance(0.3)) {
      await prisma.savedLead.create({
        data: { leadId: lead.id, userId: user.id, organizationId: org.id },
      });
    }
  }
  console.log(`  created ${businesses.length} leads with realistic audit/CRM history`);

  // ---- Search history -----------------------------------------------------
  const searchQueries: { query: string; location: string }[] = [
    { query: 'Dental Clinic', location: 'Banani, Dhaka' },
    { query: 'Hair Salon', location: 'Gulshan, Dhaka' },
    { query: 'Restaurant', location: 'Dhanmondi, Dhaka' },
    { query: 'Auto Repair Shop', location: 'Uttara, Dhaka' },
    { query: 'Law Firm', location: 'Mirpur, Dhaka' },
    { query: 'Fitness Studio', location: 'Bashundhara, Dhaka' },
  ];
  for (const sq of searchQueries) {
    const resultCount = randInt(8, 20);
    const search = await prisma.search.create({
      data: {
        organizationId: org.id, userId: user.id, query: sq.query, location: sq.location,
        status: 'COMPLETED', progress: 100, resultCount, providerMode: 'MOCK',
        completedAt: daysAgo(randInt(1, 60)), createdAt: daysAgo(randInt(1, 60)),
      },
    });
    const sample = shuffle(businesses.filter((b) => b.category === sq.query)).slice(0, Math.min(resultCount, 6));
    await prisma.searchResult.createMany({
      data: Array.from({ length: resultCount }, (_, idx) => {
        const b = sample[idx % Math.max(sample.length, 1)] ?? businesses[randInt(0, businesses.length - 1)]!;
        return {
          searchId: search.id,
          businessName: idx < sample.length ? b.businessName : `${pick(ADJECTIVES)} ${sq.query}`,
          category: sq.query,
          address: `${sq.location}`,
          city: 'Dhaka',
          country: 'Bangladesh',
          rating: chance(0.8) ? Math.round((3 + rand() * 2) * 10) / 10 : null,
          reviewCount: chance(0.8) ? randInt(3, 300) : null,
          hasWebsite: chance(0.5),
          hasGoogleProfile: chance(0.8),
          rawData: { source: 'mock', query: sq.query, location: sq.location },
        };
      }),
    });
  }
  console.log(`  created ${searchQueries.length} search history entries`);

  // ---- Campaigns ------------------------------------------------------------
  const campaignDefs: { name: string; status: 'DRAFT' | 'ACTIVE' | 'COMPLETED'; service: CampaignService }[] = [
    { name: 'Dhaka Dental Clinics — Website Outreach', status: 'ACTIVE', service: 'WEBSITE_DEVELOPMENT' },
    { name: 'Gulshan Salons — Google Business Boost', status: 'COMPLETED', service: 'GOOGLE_BUSINESS_OPTIMIZATION' },
    { name: 'Restaurant SEO Push', status: 'DRAFT', service: 'SEO' },
  ];
  const enrichedLeadIds = leadIds.slice(0, Math.floor(leadIds.length * 0.75));
  for (const c of campaignDefs) {
    const campaign = await prisma.campaign.create({
      data: {
        organizationId: org.id, createdByUserId: user.id, name: c.name,
        description: `Outreach campaign targeting ${c.service.toLowerCase().replace(/_/g, ' ')} opportunities.`,
        service: c.service, tone: pick(OUTREACH_TONES), channel: pick(OUTREACH_CHANNELS),
        status: c.status, createdAt: daysAgo(randInt(5, 45)),
      },
    });
    const campaignLeads = shuffle(enrichedLeadIds).slice(0, randInt(8, 15));
    await prisma.campaignLead.createMany({
      data: campaignLeads.map((leadId) => ({
        campaignId: campaign.id, leadId,
        status: c.status === 'DRAFT' ? 'PENDING' : chance(0.4) ? 'RESPONDED' : 'SENT',
      })),
    });
    if (c.status !== 'DRAFT') {
      for (const leadId of campaignLeads.slice(0, randInt(3, 6))) {
        await prisma.outreachMessage.create({
          data: {
            leadId, campaignId: campaign.id, generatedByUserId: user.id, kind: 'OUTREACH',
            channel: campaign.channel, tone: campaign.tone, language: 'ENGLISH',
            subject: campaign.channel === 'EMAIL' ? `Regarding ${c.service.toLowerCase().replace(/_/g, ' ')}` : null,
            body: `Hi there, reaching out as part of our ${c.name} outreach — would love to help improve your online presence.`,
            status: chance(0.6) ? 'SENT' : 'DRAFT',
            providerMode: 'MOCK', model: 'mock-v1',
            sentAt: chance(0.6) ? daysAgo(randInt(0, 20)) : null,
          },
        });
      }
    }
  }
  console.log(`  created ${campaignDefs.length} campaigns`);

  // ---- Notifications ----------------------------------------------------
  const notificationDefs = [
    { type: 'lead.audit_completed', title: 'Digital audit completed', body: 'A new opportunity score is ready to review.' },
    { type: 'follow_up.due', title: 'Follow-up due today', body: "Don't forget to check in with this lead." },
    { type: 'campaign.messages_generated', title: 'Campaign messages generated', body: 'Outreach messages are ready to review and send.' },
  ];
  await prisma.notification.createMany({
    data: Array.from({ length: 10 }, (_, i) => {
      const n = notificationDefs[i % notificationDefs.length]!;
      return {
        organizationId: org.id, userId: user.id, type: n.type, title: n.title, body: n.body,
        readAt: chance(0.5) ? daysAgo(randInt(0, 10)) : null,
        createdAt: daysAgo(randInt(0, 20)),
      };
    }),
  });
  console.log('  created 10 notifications');

  console.log('\nDemo dataset seeded successfully.');
  console.log('  Login:    demo@leadradar.app');
  console.log('  Password: demo12345');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
