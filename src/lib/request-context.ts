import { isIP } from "node:net";

type HeaderReader = Pick<Headers, "get">;

export interface RequestGeoContext {
  country: string | null;
  region: string | null;
  regionCode: string | null;
  city: string | null;
  latitude: string | null;
  longitude: string | null;
  source: string | null;
}

export interface ClientRequestContext {
  ip: string;
  userAgent: string | null;
  geo: RequestGeoContext;
}

function firstHeader(headers: HeaderReader, names: string[]) {
  for (const name of names) {
    const value = headers.get(name)?.split(",")[0]?.trim();
    if (value) return value;
  }
  return null;
}

function decodeHeaderValue(value: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === "unknown") return null;

  try {
    return decodeURIComponent(normalized.replace(/\+/g, "%20"));
  } catch {
    return normalized;
  }
}

function stripPort(value: string) {
  const trimmed = value.trim().replace(/^"|"$/g, "");
  if (trimmed.startsWith("[") && trimmed.includes("]")) {
    return trimmed.slice(1, trimmed.indexOf("]"));
  }

  if (isIP(trimmed)) return trimmed;

  const ipv4WithPort = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) return ipv4WithPort[1];

  return trimmed;
}

function normalizeIp(value: string | null) {
  if (!value) return null;
  const candidate = stripPort(value);
  if (candidate.startsWith("::ffff:")) {
    const ipv4 = candidate.slice(7);
    return isIP(ipv4) ? ipv4 : null;
  }

  return isIP(candidate) ? candidate : null;
}

export function getClientIp(headers: HeaderReader) {
  const direct = firstHeader(headers, [
    "cf-connecting-ip",
    "true-client-ip",
    "x-real-ip",
    "x-client-ip",
  ]);
  const normalizedDirect = normalizeIp(direct);
  if (normalizedDirect) return normalizedDirect;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    for (const item of forwarded.split(",")) {
      const normalized = normalizeIp(item);
      if (normalized) return normalized;
    }
  }

  return "unknown";
}

export function getRequestGeo(headers: HeaderReader): RequestGeoContext {
  const country = decodeHeaderValue(firstHeader(headers, [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "x-geo-country",
    "cloudfront-viewer-country",
  ]));
  const region = decodeHeaderValue(firstHeader(headers, [
    "cf-ipregion",
    "cf-region",
    "x-vercel-ip-country-region",
    "x-geo-region",
    "x-real-ip-region",
    "x-real-ip-province",
  ]));
  const regionCode = decodeHeaderValue(firstHeader(headers, [
    "cf-ipregion-code",
    "cf-region-code",
    "x-vercel-ip-country-region",
    "x-geo-region-code",
  ]));
  const city = decodeHeaderValue(firstHeader(headers, [
    "cf-ipcity",
    "cf-city",
    "x-vercel-ip-city",
    "x-geo-city",
    "x-real-ip-city",
  ]));
  const latitude = decodeHeaderValue(firstHeader(headers, [
    "cf-iplatitude",
    "x-geo-latitude",
  ]));
  const longitude = decodeHeaderValue(firstHeader(headers, [
    "cf-iplongitude",
    "x-geo-longitude",
  ]));

  let source: string | null = null;
  if (headers.get("cf-connecting-ip") || headers.get("cf-ipcountry")) {
    source = "cloudflare";
  } else if (headers.get("x-vercel-ip-country")) {
    source = "vercel";
  } else if (country || region || city) {
    source = "proxy";
  }

  return { country, region, regionCode, city, latitude, longitude, source };
}

export function getClientRequestContext(headers: HeaderReader): ClientRequestContext {
  return {
    ip: getClientIp(headers),
    userAgent: headers.get("user-agent")?.slice(0, 500) ?? null,
    geo: getRequestGeo(headers),
  };
}
