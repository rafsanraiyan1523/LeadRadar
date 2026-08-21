export interface CategoryTemplate {
  /** Canonical, display-friendly category name. */
  canonical: string;
  /** Alternate phrasings that should resolve to this template. */
  synonyms: string[];
  namePrefixes: string[];
  nameSuffixes: string[];
}

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    canonical: "Beauty Salon",
    synonyms: ["salon", "beauty salon", "hair salon"],
    namePrefixes: ["Glow", "Bella", "Radiance", "Shine", "Elegance", "Charm", "Blush", "Lustre"],
    nameSuffixes: [
      "Beauty Salon",
      "Salon & Spa",
      "Beauty Lounge",
      "Hair & Beauty",
      "Beauty Studio",
    ],
  },
  {
    canonical: "Restaurant",
    synonyms: ["restaurant", "dining", "eatery"],
    namePrefixes: [
      "Spice",
      "Royal",
      "Bay Leaf",
      "Saffron",
      "Bismillah",
      "Heritage",
      "Copper",
      "Cedar",
    ],
    nameSuffixes: ["Restaurant", "Kitchen", "Dine", "Food Corner", "Dining"],
  },
  {
    canonical: "Dental Clinic",
    synonyms: ["dental clinic", "dentist", "dental care"],
    namePrefixes: ["Smile", "Bright", "Perfect", "Pearl", "Radiant", "Gentle"],
    nameSuffixes: ["Dental Clinic", "Dental Care", "Dental Center", "Smile Studio", "Dental Point"],
  },
  {
    canonical: "Gym",
    synonyms: ["gym", "fitness center", "fitness club"],
    namePrefixes: ["Iron", "Power", "Elite", "Peak", "Apex", "Titan"],
    nameSuffixes: ["Gym", "Fitness Center", "Fitness Club", "Strength Studio", "Fitness Zone"],
  },
  {
    canonical: "Hotel",
    synonyms: ["hotel", "inn", "residency"],
    namePrefixes: ["Grand", "Golden", "Sunrise", "Skyline", "Regency", "Pearl"],
    nameSuffixes: ["Hotel", "International Hotel", "Residency", "Inn", "Suites"],
  },
  {
    canonical: "Real Estate Agency",
    synonyms: ["real estate agency", "real estate", "realty", "property agency"],
    namePrefixes: ["Prime", "Skyline", "Metro", "Trust", "Horizon", "Landmark"],
    nameSuffixes: ["Real Estate", "Properties", "Realty", "Estates", "Property Consultants"],
  },
  {
    canonical: "Clothing Store",
    synonyms: ["clothing store", "fashion store", "apparel"],
    namePrefixes: ["Trend", "Urban", "Style", "Vogue", "Fabric", "Threads"],
    nameSuffixes: ["Fashion House", "Clothing", "Boutique", "Apparel", "Fashion Store"],
  },
  {
    canonical: "Cafe",
    synonyms: ["cafe", "coffee shop", "coffee house"],
    namePrefixes: ["Bean", "Brew", "Cloud", "Daily", "Roast", "Amber"],
    nameSuffixes: ["Cafe", "Coffee House", "Coffee Roasters", "Cafe & Bakery", "Coffee Corner"],
  },
  {
    canonical: "E-commerce Business",
    synonyms: ["e-commerce business", "ecommerce", "online store", "online shop"],
    namePrefixes: ["Click", "Quick", "Smart", "Digital", "Metro", "Nova"],
    nameSuffixes: ["Mart", "Shop BD", "Store", "Online Bazaar", "Marketplace"],
  },
];

const DEFAULT_TEMPLATE: Omit<CategoryTemplate, "canonical" | "synonyms"> = {
  namePrefixes: ["Prime", "Metro", "Royal", "Trust", "Elite", "Golden"],
  nameSuffixes: ["Enterprise", "Services", "House", "Center", "Solutions"],
};

export function resolveCategoryTemplate(query: string): CategoryTemplate {
  const normalized = query.trim().toLowerCase();
  const match = CATEGORY_TEMPLATES.find(
    (t) => t.canonical.toLowerCase() === normalized || t.synonyms.includes(normalized),
  );
  if (match) {
    return match;
  }

  const partial = CATEGORY_TEMPLATES.find(
    (t) =>
      normalized.includes(t.canonical.toLowerCase()) ||
      t.synonyms.some((s) => normalized.includes(s) || s.includes(normalized)),
  );
  if (partial) {
    return partial;
  }

  // Unknown/free-text query — fall back to a generic template that still
  // uses the caller's own words, so results always look plausible.
  const canonical = query.trim().replace(/\s+/g, " ") || "Business";
  return { canonical, synonyms: [], ...DEFAULT_TEMPLATE };
}
