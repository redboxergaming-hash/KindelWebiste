const { success, failure } = require("./_lib/response");

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_ITEMS = 3;

const DEFAULT_SOURCES = {
  hn: {
    label: "Hacker News",
    url: "https://hnrss.org/frontpage"
  },
  bbc: {
    label: "BBC World",
    url: "http://feeds.bbci.co.uk/news/world/rss.xml"
  }
};

function getSources() {
  if (!process.env.FEED_SOURCES_JSON) {
    return DEFAULT_SOURCES;
  }

  try {
    const parsed = JSON.parse(process.env.FEED_SOURCES_JSON);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (error) {
    return DEFAULT_SOURCES;
  }

  return DEFAULT_SOURCES;
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripHtml(value) {
  return decodeEntities(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTagValue(block, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(regex);
  return match ? stripHtml(match[1]) : "";
}

function parseRss(xmlText, sourceLabel, maxItems) {
  const channelTitle = extractTagValue(xmlText, "title") || sourceLabel;
  const itemBlocks = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];

  const items = itemBlocks.slice(0, maxItems).map((block) => ({
    title: extractTagValue(block, "title") || "Ohne Titel",
    publishedAt: extractTagValue(block, "pubDate") || "",
    source: sourceLabel
  }));

  return {
    title: channelTitle,
    items
  };
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml"
      }
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

exports.handler = async (event) => {
  const sources = getSources();
  const sourceKey = (event?.queryStringParameters?.source || process.env.FEED_DEFAULT_SOURCE || "hn").toLowerCase();
  const source = sources[sourceKey];
  const timeoutMs = Number.parseInt(process.env.FEED_TIMEOUT_MS || `${DEFAULT_TIMEOUT_MS}`, 10);
  const maxItems = Number.parseInt(process.env.FEED_MAX_ITEMS || `${DEFAULT_MAX_ITEMS}`, 10);

  if (!source || !source.url) {
    return failure(400, "FEED_SOURCE_INVALID", "Feed-Quelle ist nicht verfügbar.");
  }

  try {
    const response = await fetchWithTimeout(source.url, timeoutMs);
    if (!response.ok) {
      return failure(502, "FEED_UPSTREAM_ERROR", "Feed ist derzeit nicht verfügbar.");
    }

    const xmlText = await response.text();
    const compactFeed = parseRss(xmlText, source.label || sourceKey, Math.max(1, maxItems));

    return success(
      {
        source: sourceKey,
        title: compactFeed.title,
        items: compactFeed.items
      },
      {
        source: "rss",
        count: compactFeed.items.length
      }
    );
  } catch (error) {
    if (error.name === "AbortError") {
      return failure(504, "FEED_TIMEOUT", "Feed antwortet zu langsam.");
    }

    return failure(502, "FEED_REQUEST_FAILED", "Feed ist derzeit nicht verfügbar.");
  }
};
