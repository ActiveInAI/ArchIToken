import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type LocationLevel = "country" | "state" | "city" | "district";

interface GeoLocationItem {
  label: string;
  value: string;
  level: LocationLevel;
  isLeaf: boolean;
  countryCode?: string;
  stateCode?: string;
  areaCode?: string;
}

interface CountryRecord {
  name: string;
  isoCode: string;
  flag?: string;
}

interface StateRecord {
  name: string;
  isoCode: string;
  countryCode: string;
}

interface CityRecord {
  name: string;
  countryCode: string;
  stateCode: string;
}

type ChinaAreaData = Record<string, Record<string, string>>;

const chinaRootAreaCode = "86";
const chinaCountryCode = "CN";
const priorityCountryCodes = ["CN", "AU", "US", "CA", "GB", "SG", "AE"];
const countryDisplayNames = new Intl.DisplayNames(["zh-CN"], {
  type: "region",
});

let countryCache: CountryRecord[] | null = null;
let stateCache: StateRecord[] | null = null;
let cityCache: CityRecord[] | null = null;
let chinaAreaCache: ChinaAreaData | null = null;

export async function GET(request: NextRequest) {
  const level = request.nextUrl.searchParams.get("level") ?? "countries";
  const countryCode = normalizeCode(
    request.nextUrl.searchParams.get("country"),
  );
  const stateCode = request.nextUrl.searchParams.get("state")?.trim() ?? "";
  const areaCode = request.nextUrl.searchParams.get("area")?.trim() ?? "";

  if (level === "countries") {
    return jsonItems(await countryOptions());
  }

  if (level === "states" && countryCode) {
    return jsonItems(await stateOptions(countryCode));
  }

  if (level === "cities" && countryCode && stateCode) {
    return jsonItems(await cityOptions(countryCode, stateCode));
  }

  if (level === "districts" && countryCode === chinaCountryCode && areaCode) {
    return jsonItems(await chinaAreaOptions(areaCode, "district"));
  }

  return jsonItems([]);
}

function jsonItems(items: GeoLocationItem[]) {
  return NextResponse.json(
    { items },
    {
      headers: {
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    },
  );
}

function normalizeCode(value: string | null): string {
  return value?.trim().toUpperCase() ?? "";
}

async function countryOptions(): Promise<GeoLocationItem[]> {
  const countryRecords = await loadCountryRecords();
  return countryRecords.map(countryOption).sort((left, right) => {
    const leftRank = priorityCountryCodes.indexOf(left.countryCode ?? "");
    const rightRank = priorityCountryCodes.indexOf(right.countryCode ?? "");
    if (leftRank !== rightRank) {
      if (leftRank < 0) return 1;
      if (rightRank < 0) return -1;
      return leftRank - rightRank;
    }
    return left.value.localeCompare(right.value, "zh-CN");
  });
}

function countryOption(country: CountryRecord): GeoLocationItem {
  const countryName = localizedCountryName(country);
  return {
    label: country.flag ? `${country.flag} ${countryName}` : countryName,
    value: countryName,
    level: "country",
    countryCode: country.isoCode,
    isLeaf: false,
  };
}

function localizedCountryName(country: CountryRecord): string {
  const localized = countryDisplayNames.of(country.isoCode);
  return localized && localized !== country.isoCode ? localized : country.name;
}

async function stateOptions(countryCode: string): Promise<GeoLocationItem[]> {
  if (countryCode === chinaCountryCode) {
    return chinaAreaOptions(chinaRootAreaCode, "state");
  }

  const allStates = await loadStateRecords();
  const stateItems = allStates
    .filter((state) => state.countryCode === countryCode)
    .map((state) => stateOption(state, false));
  if (stateItems.length > 0) {
    return sortByValue(stateItems);
  }

  const allCities = await loadCityRecords();
  return sortByValue(
    allCities
      .filter((city) => city.countryCode === countryCode)
      .map((city) => cityOption(city)),
  );
}

function stateOption(state: StateRecord, isLeaf: boolean): GeoLocationItem {
  return {
    label: state.name,
    value: state.name,
    level: "state",
    countryCode: state.countryCode,
    stateCode: state.isoCode,
    isLeaf,
  };
}

async function cityOptions(
  countryCode: string,
  stateCode: string,
): Promise<GeoLocationItem[]> {
  if (countryCode === chinaCountryCode) {
    return chinaAreaOptions(stateCode, "city");
  }

  const allCities = await loadCityRecords();
  return sortByValue(
    allCities
      .filter(
        (city) =>
          city.countryCode === countryCode && city.stateCode === stateCode,
      )
      .map((city) => cityOption(city)),
  );
}

function cityOption(city: CityRecord): GeoLocationItem {
  return {
    label: city.name,
    value: city.name,
    level: "city",
    countryCode: city.countryCode,
    stateCode: city.stateCode,
    isLeaf: true,
  };
}

async function chinaAreaOptions(
  parentAreaCode: string,
  level: Exclude<LocationLevel, "country">,
): Promise<GeoLocationItem[]> {
  const chinaAreas = await loadChinaAreas();
  const children = chinaAreas[parentAreaCode] ?? {};
  return Object.entries(children)
    .map(([areaCode, name]) => ({
      label: name,
      value: name,
      level,
      countryCode: chinaCountryCode,
      stateCode: areaCode,
      areaCode,
      isLeaf: !chinaAreas[areaCode],
    }))
    .sort((left, right) => left.value.localeCompare(right.value, "zh-CN"));
}

function sortByValue(items: GeoLocationItem[]): GeoLocationItem[] {
  return items.sort((left, right) => left.value.localeCompare(right.value));
}

async function loadCountryRecords(): Promise<CountryRecord[]> {
  countryCache ??= await loadJson<CountryRecord[]>(
    "country-cities",
    "lib",
    "assets",
    "country.json",
  );
  return countryCache;
}

async function loadStateRecords(): Promise<StateRecord[]> {
  stateCache ??= await loadJson<StateRecord[]>(
    "country-cities",
    "lib",
    "assets",
    "state.json",
  );
  return stateCache;
}

async function loadCityRecords(): Promise<CityRecord[]> {
  cityCache ??= await loadJson<CityRecord[]>(
    "country-cities",
    "lib",
    "assets",
    "city.json",
  );
  return cityCache;
}

async function loadChinaAreas(): Promise<ChinaAreaData> {
  chinaAreaCache ??= await loadJson<ChinaAreaData>(
    "china-area-data",
    "data.json",
  );
  return chinaAreaCache;
}

async function loadJson<T>(...segments: string[]): Promise<T> {
  const filePath = join(process.cwd(), "node_modules", ...segments);
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}
