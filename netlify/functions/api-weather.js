const { success, failure } = require("./_lib/response");

const DEFAULT_TIMEOUT_MS = 4500;
const DEFAULT_UNITS = "metric";
const DEFAULT_LANG = "de";
const WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather";

function getWeatherConfig() {
  return {
    apiKey: process.env.WEATHER_API_KEY,
    lat: process.env.WEATHER_LAT,
    lon: process.env.WEATHER_LON,
    units: process.env.WEATHER_UNITS || DEFAULT_UNITS,
    lang: process.env.WEATHER_LANG || DEFAULT_LANG,
    timeoutMs: Number.parseInt(process.env.WEATHER_TIMEOUT_MS || `${DEFAULT_TIMEOUT_MS}`, 10)
  };
}

function mapCondition(main) {
  const normalized = String(main || "").toLowerCase();

  if (normalized.includes("cloud")) return "partly-cloudy";
  if (normalized.includes("clear")) return "sunny";
  if (normalized.includes("rain") || normalized.includes("drizzle") || normalized.includes("thunder")) {
    return "rain";
  }
  if (normalized.includes("snow")) return "snow";

  return normalized || "unknown";
}

function toCompactWeatherPayload(apiData) {
  return {
    location: apiData.name || "Unknown",
    condition: mapCondition(apiData.weather?.[0]?.main),
    temperatureC: Math.round(apiData.main?.temp),
    highC: Math.round(apiData.main?.temp_max),
    lowC: Math.round(apiData.main?.temp_min)
  };
}

exports.handler = async () => {
  const cfg = getWeatherConfig();

  if (!cfg.apiKey || !cfg.lat || !cfg.lon) {
    return failure(500, "WEATHER_CONFIG_MISSING", "Wetterdienst ist nicht konfiguriert.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const query = new URLSearchParams({
      lat: String(cfg.lat),
      lon: String(cfg.lon),
      units: cfg.units,
      lang: cfg.lang,
      appid: cfg.apiKey
    });

    const response = await fetch(`${WEATHER_API_URL}?${query.toString()}`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return failure(502, "WEATHER_UPSTREAM_ERROR", "Wetterdaten derzeit nicht verfügbar.");
    }

    const upstreamData = await response.json();
    const compactData = toCompactWeatherPayload(upstreamData);

    if (
      !Number.isFinite(compactData.temperatureC) ||
      !Number.isFinite(compactData.highC) ||
      !Number.isFinite(compactData.lowC)
    ) {
      return failure(502, "WEATHER_DATA_INVALID", "Wetterdaten derzeit nicht verfügbar.");
    }

    return success(compactData, {
      source: "openweather",
      units: cfg.units
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return failure(504, "WEATHER_TIMEOUT", "Wetterdienst antwortet zu langsam.");
    }

    return failure(502, "WEATHER_REQUEST_FAILED", "Wetterdaten derzeit nicht verfügbar.");
  } finally {
    clearTimeout(timeoutId);
  }
};
