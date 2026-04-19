const { success, failure } = require("./_lib/response");
const { requestServiceAccountAccessToken, normalizePrivateKey } = require("./_lib/google-auth");

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_TIMEOUT_MS = 5000;
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3/calendars";

function getCalendarConfig() {
  return {
    clientEmail: process.env.GCAL_CLIENT_EMAIL,
    privateKey: normalizePrivateKey(process.env.GCAL_PRIVATE_KEY),
    calendarId: process.env.GCAL_CALENDAR_ID,
    timezone: process.env.GCAL_TIMEZONE || "Europe/Berlin",
    maxResults: Number.parseInt(process.env.GCAL_MAX_RESULTS || `${DEFAULT_MAX_RESULTS}`, 10),
    timeoutMs: Number.parseInt(process.env.GCAL_TIMEOUT_MS || `${DEFAULT_TIMEOUT_MS}`, 10)
  };
}

function formatDateLabel(isoValue, timezone) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone
  }).format(date);
}

function toCompactEvent(event, timezone) {
  const start = event.start?.dateTime || event.start?.date;
  const end = event.end?.dateTime || event.end?.date || start;
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);

  return {
    id: event.id,
    title: event.summary || "Ohne Titel",
    start,
    end,
    dateLabel: start ? formatDateLabel(start, timezone) : "",
    allDay
  };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

exports.handler = async () => {
  const cfg = getCalendarConfig();

  if (!cfg.clientEmail || !cfg.privateKey || !cfg.calendarId) {
    return failure(500, "CALENDAR_CONFIG_MISSING", "Kalenderdienst ist nicht konfiguriert.");
  }

  if (!Number.isFinite(cfg.maxResults) || cfg.maxResults < 1) {
    return failure(500, "CALENDAR_CONFIG_INVALID", "Kalenderdienst ist nicht korrekt konfiguriert.");
  }

  try {
    const token = await requestServiceAccountAccessToken({
      clientEmail: cfg.clientEmail,
      privateKey: cfg.privateKey,
      scope: CALENDAR_SCOPE,
      fetchImpl: (url, options) => fetchWithTimeout(url, options, cfg.timeoutMs)
    });

    const query = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: new Date().toISOString(),
      maxResults: String(cfg.maxResults),
      timeZone: cfg.timezone
    });

    const endpoint = `${GOOGLE_CALENDAR_BASE}/${encodeURIComponent(cfg.calendarId)}/events?${query.toString()}`;

    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      },
      cfg.timeoutMs
    );

    if (!response.ok) {
      return failure(502, "CALENDAR_UPSTREAM_ERROR", "Kalenderdaten derzeit nicht verfügbar.");
    }

    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    const compactItems = items.map((item) => toCompactEvent(item, cfg.timezone));

    return success(
      {
        timezone: cfg.timezone,
        items: compactItems
      },
      {
        source: "google-calendar"
      }
    );
  } catch (error) {
    if (error.name === "AbortError") {
      return failure(504, "CALENDAR_TIMEOUT", "Kalenderdienst antwortet zu langsam.");
    }

    if (error.message && error.message.startsWith("GOOGLE_TOKEN_")) {
      return failure(502, "CALENDAR_AUTH_FAILED", "Kalenderdaten derzeit nicht verfügbar.");
    }

    return failure(502, "CALENDAR_REQUEST_FAILED", "Kalenderdaten derzeit nicht verfügbar.");
  }
};
