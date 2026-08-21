import type { OutreachLanguage, OutreachTone } from "@lead-radar/types";

/**
 * Hand-written, reviewed phrase banks for the deterministic MockAIProvider —
 * not AI-generated at runtime, so correctness is fully within LeadRadar's
 * control. Kept intentionally short and simple (especially the Bangla/
 * Banglish phrasing) to minimize the chance of an awkward or incorrect
 * construction. Every phrase here is generic connective tissue — the actual
 * business-specific content always comes from GAP_PHRASES / STRENGTH
 * phrases below, which are keyed to real, detected findings.
 */
export interface LanguagePhrases {
  opening: Record<OutreachTone, string>;
  closing: Record<OutreachTone, string>;
  followUpOpening: string;
  serviceIntro: string;
  subjectLine: string;
  connectorBut: string;
}

export const PHRASES: Record<OutreachLanguage, LanguagePhrases> = {
  ENGLISH: {
    opening: {
      PROFESSIONAL: "I came across {business} while researching local businesses{locationClause}.",
      FRIENDLY: "I stumbled upon {business} and wanted to reach out!",
      CONSULTATIVE: "I took a quick look at {business}'s online presence and had an observation.",
      SHORT: "Quick note about {business}:",
    },
    closing: {
      PROFESSIONAL: "Would you be open to a short conversation about this?",
      FRIENDLY: "Would love to chat if you're interested!",
      CONSULTATIVE: "Happy to share more detail if it would be useful.",
      SHORT: "Interested in a quick chat?",
    },
    followUpOpening: "Just following up on my earlier note to {business} —",
    serviceIntro: "We help businesses like yours with {service}.",
    subjectLine: "Quick thought about {business}",
    connectorBut: "but",
  },
  BANGLA: {
    opening: {
      PROFESSIONAL: "ব্যবসা নিয়ে খোঁজ করার সময় {business}-এর কথা জানতে পারলাম{locationClause}।",
      FRIENDLY: "{business}-এর কথা জানতে পেরে যোগাযোগ করতে চাইলাম!",
      CONSULTATIVE: "{business}-এর অনলাইন উপস্থিতি একটু দেখলাম, একটা বিষয় লক্ষ্য করলাম।",
      SHORT: "{business} নিয়ে একটা ছোট কথা:",
    },
    closing: {
      PROFESSIONAL: "এই বিষয়ে একটু কথা বলতে চান?",
      FRIENDLY: "আগ্রহী হলে কথা বলতে পারি!",
      CONSULTATIVE: "দরকার হলে আরও বিস্তারিত জানাতে পারি।",
      SHORT: "একটু কথা বলবেন?",
    },
    followUpOpening: "{business}-কে আগে যে বার্তা পাঠিয়েছিলাম, তার পরিপ্রেক্ষিতে —",
    serviceIntro: "আমরা আপনার মতো ব্যবসাকে {service} নিয়ে সাহায্য করি।",
    subjectLine: "{business} নিয়ে একটা ছোট চিন্তা",
    connectorBut: "তবে",
  },
  BANGLISH: {
    opening: {
      PROFESSIONAL: "Business niye khujte giye {business}-er kotha jante parlam{locationClause}.",
      FRIENDLY: "{business}-er kotha jene jogajog korte chailam!",
      CONSULTATIVE: "{business}-er online presence ektu dekhlam, ekta bishoy lokkho korlam.",
      SHORT: "{business} niye ekta choto kotha:",
    },
    closing: {
      PROFESSIONAL: "Ei bishoye ektu kotha bolte chan?",
      FRIENDLY: "Agrohi hole kotha bolte pari!",
      CONSULTATIVE: "Dorkar hole aro details janate pari.",
      SHORT: "Ektu kotha bolben?",
    },
    followUpOpening: "{business}-ke age ekta message diyechilam, shei niye —",
    serviceIntro: "Amra apnar moto business-ke {service} niye shahajjo kori.",
    subjectLine: "{business} niye ekta choto vabna",
    connectorBut: "kintu",
  },
};

/** Natural-language phrasing of each detected finding — keyed to the exact, fixed finding titles growth-opportunities.ts produces. */
export const GAP_PHRASES: Record<string, Record<OutreachLanguage, string>> = {
  "No website detected": {
    ENGLISH: "I couldn't find a website for your business",
    BANGLA: "আপনার ব্যবসার কোনো ওয়েবসাইট খুঁজে পাইনি",
    BANGLISH: "apnar business-er kono website khuje pai nai",
  },
  "No online booking detected": {
    ENGLISH: "I couldn't find an online booking option",
    BANGLA: "অনলাইন বুকিং-এর কোনো ব্যবস্থা খুঁজে পাইনি",
    BANGLISH: "online booking-er kono babostha khuje pai nai",
  },
  "Weak calls-to-action": {
    ENGLISH: "your site doesn't make it easy to get in touch",
    BANGLA: "আপনার সাইটে যোগাযোগ করা সহজ নয়",
    BANGLISH: "apnar site-e jogajog kora shohoj na",
  },
  "Missing SEO metadata": {
    ENGLISH: "your site is missing some basic search-visibility details",
    BANGLA: "আপনার সাইটে কিছু গুরুত্বপূর্ণ সার্চ তথ্য নেই",
    BANGLISH: "apnar site-e kichu jaruri search info nai",
  },
  "Weak mobile configuration": {
    ENGLISH: "your site doesn't seem optimized for mobile visitors",
    BANGLA: "আপনার সাইট মোবাইলের জন্য প্রস্তুত মনে হচ্ছে না",
    BANGLISH: "apnar site mobile-er jonno thik moto na",
  },
  "Site is not served over HTTPS": {
    ENGLISH: "your site isn't running on a secure (HTTPS) connection",
    BANGLA: "আপনার সাইটে নিরাপদ (HTTPS) সংযোগ নেই",
    BANGLISH: "apnar site-e secure (HTTPS) connection nai",
  },
  "No social links found on website": {
    ENGLISH: "I couldn't find your social media links on your site",
    BANGLA: "আপনার সাইটে সোশ্যাল মিডিয়ার লিংক খুঁজে পাইনি",
    BANGLISH: "apnar site-e social media link khuje pai nai",
  },
  "No clear service pages": {
    ENGLISH: "your site doesn't clearly list your services",
    BANGLA: "আপনার সাইটে সেবাগুলোর তালিকা স্পষ্ট নয়",
    BANGLISH: "apnar site-e service gulor list clear na",
  },
  "No Google Business Profile found": {
    ENGLISH: "I couldn't find a Google Business profile for you",
    BANGLA: "আপনার গুগল বিজনেস প্রোফাইল খুঁজে পাইনি",
    BANGLISH: "apnar Google Business profile khuje pai nai",
  },
  "Strong rating but limited review volume": {
    ENGLISH: "your reviews are limited compared to your rating",
    BANGLA: "আপনার রেটিং ভালো হলেও রিভিউ কম",
    BANGLISH: "apnar rating bhalo but review kom",
  },
};

export const STRENGTH_PHRASES = {
  strongGoogleRating: {
    ENGLISH: (rating: number, reviewCount: number | null) =>
      `your Google profile has a strong rating (${rating.toFixed(1)}★${reviewCount !== null ? `, ${reviewCount} reviews` : ""})`,
    BANGLA: (rating: number, reviewCount: number | null) =>
      `আপনার গুগল প্রোফাইলের রেটিং বেশ ভালো (${rating.toFixed(1)}★${reviewCount !== null ? `, ${reviewCount} রিভিউ` : ""})`,
    BANGLISH: (rating: number, reviewCount: number | null) =>
      `apnar Google profile-er rating besh bhalo (${rating.toFixed(1)}★${reviewCount !== null ? `, ${reviewCount} review` : ""})`,
  },
  easyToReach: {
    ENGLISH: "your business is easy to reach online",
    BANGLA: "আপনার ব্যবসার সাথে অনলাইনে যোগাযোগ করা সহজ",
    BANGLISH: "apnar business-er shathe online-e jogajog kora shohoj",
  },
} as const;

const SERVICE_LABELS: Record<string, Record<OutreachLanguage, string>> = {
  WEBSITE_DEVELOPMENT: { ENGLISH: "website development", BANGLA: "ওয়েবসাইট তৈরি", BANGLISH: "website toiri" },
  SEO: { ENGLISH: "SEO", BANGLA: "এসইও", BANGLISH: "SEO" },
  GOOGLE_BUSINESS_OPTIMIZATION: {
    ENGLISH: "Google Business optimization",
    BANGLA: "গুগল বিজনেস অপ্টিমাইজেশন",
    BANGLISH: "Google Business optimization",
  },
  ONLINE_BOOKING: { ENGLISH: "online booking", BANGLA: "অনলাইন বুকিং", BANGLISH: "online booking" },
  ECOMMERCE: { ENGLISH: "e-commerce", BANGLA: "ই-কমার্স", BANGLISH: "e-commerce" },
  SOCIAL_MEDIA: { ENGLISH: "social media", BANGLA: "সোশ্যাল মিডিয়া", BANGLISH: "social media" },
  PAID_ADS: { ENGLISH: "paid ads", BANGLA: "পেইড বিজ্ঞাপন", BANGLISH: "paid ads" },
  CUSTOM_SOFTWARE: { ENGLISH: "custom software", BANGLA: "কাস্টম সফটওয়্যার", BANGLISH: "custom software" },
};

export function serviceLabel(service: string, language: OutreachLanguage): string {
  return SERVICE_LABELS[service]?.[language] ?? service;
}
