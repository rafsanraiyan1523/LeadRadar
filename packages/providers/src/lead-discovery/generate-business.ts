import type { BusinessStatus, BusinessSummary } from "@lead-radar/types";
import { resolveCategoryTemplate } from "./data/categories";
import { resolveLocationTemplate } from "./data/locations";
import {
  createSeededRandom,
  hashStringToSeed,
  pick,
  randomFloat,
  randomInt,
} from "../lib/seeded-random";
import { buildGoogleMapsSearchUrl } from "../lib/google-maps-url";
import { encodeMockId } from "./mock-id";

const BUSINESS_STATUS_WEIGHTS: [BusinessStatus, number][] = [
  ["OPERATIONAL", 0.92],
  ["CLOSED_TEMPORARILY", 0.05],
  ["CLOSED_PERMANENTLY", 0.03],
];

function weightedPick<T>(random: () => number, weights: [T, number][]): T {
  const roll = random();
  let cumulative = 0;
  for (const [value, weight] of weights) {
    cumulative += weight;
    if (roll <= cumulative) {
      return value;
    }
  }
  return weights[weights.length - 1]![0];
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function bangladeshiPhoneNumber(random: () => number): string {
  const operatorPrefixes = ["13", "14", "15", "16", "17", "18", "19"];
  const prefix = pick(random, operatorPrefixes);
  const rest = Array.from({ length: 8 }, () => randomInt(random, 0, 9)).join("");
  return `+880${prefix}${rest}`;
}

export function generateBusiness(query: string, location: string, index: number): BusinessSummary {
  const seed = hashStringToSeed(`${query.toLowerCase()}|${location.toLowerCase()}|${index}`);
  const random = createSeededRandom(seed);

  const category = resolveCategoryTemplate(query);
  const area = resolveLocationTemplate(location);

  const useAreaPrefix = random() < 0.3;
  const areaWord = area.label.split(",")[0]!.trim();
  const namePrefix = pick(random, category.namePrefixes);
  const nameSuffix = pick(random, category.nameSuffixes);
  const name = useAreaPrefix ? `${areaWord} ${nameSuffix}` : `${namePrefix} ${nameSuffix}`;

  const road = pick(random, area.roadNames);
  const unitLabel = random() < 0.5 ? "House" : "Plot";
  const unitNumber = randomInt(random, 1, 60);
  const address = `${unitLabel} ${unitNumber}, ${road}, ${areaWord}, ${area.city}`;

  const latitude = area.center.latitude + randomFloat(random, -0.01, 0.01, 5);
  const longitude = area.center.longitude + randomFloat(random, -0.01, 0.01, 5);

  const hasGoogleProfile = random() < 0.78;
  const isStrongPerformer = random() > 0.15;
  const rating = hasGoogleProfile
    ? isStrongPerformer
      ? randomFloat(random, 3.9, 4.9)
      : randomFloat(random, 2.6, 3.8)
    : null;
  const reviewCount = hasGoogleProfile
    ? Math.round(randomInt(random, 4, isStrongPerformer ? 650 : 120) * (rating ?? 1))
    : null;

  const hasWebsite = random() < 0.55;
  const websiteUrl = hasWebsite ? `https://www.${slugify(name)}.example` : null;

  const hasPhone = random() < 0.85;
  const phone = hasPhone ? bangladeshiPhoneNumber(random) : null;

  const businessStatus = weightedPick(random, BUSINESS_STATUS_WEIGHTS);

  return {
    externalId: encodeMockId({ query, location, index }),
    name,
    category: category.canonical,
    address,
    city: area.city,
    country: area.country,
    location: { latitude, longitude },
    rating,
    reviewCount,
    businessStatus,
    websiteUrl,
    phone,
    googleMapsUri: buildGoogleMapsSearchUrl(name, address),
    hasGoogleProfile,
  };
}
