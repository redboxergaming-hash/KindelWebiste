(function initWidgets(global) {
  "use strict";

  const registry = new Map();
  const logger = (window.AppUtils && window.AppUtils.createLogger("widgets")) || console;

  function registerWidget(widgetDefinition) {
    if (!widgetDefinition || !widgetDefinition.type || typeof widgetDefinition.render !== "function") {
      throw new Error("Ungültige Widget-Definition (type/render erforderlich).");
    }

    registry.set(widgetDefinition.type, widgetDefinition);
  }

  function getWidget(type) {
    return registry.get(type);
  }

  function formatIsoDateTime(date) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function humanizeWeatherCondition(condition) {
    const map = {
      "partly-cloudy": "leicht bewölkt",
      cloudy: "bewölkt",
      sunny: "sonnig",
      rain: "Regen"
    };

    return map[condition] || condition || "unbekannt";
  }

  function formatCalendarTimeRange(startIso, endIso) {
    const start = new Date(startIso);
    const end = new Date(endIso);

    const dayFormatter = new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "2-digit"
    });

    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit"
    });

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "Zeit unbekannt";
    }

    return `${dayFormatter.format(start)} ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
  }

  async function fetchWeather(endpoint, signal) {
    const response = await fetch(endpoint, { signal, cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Weather HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || !payload.ok || !payload.data) {
      throw new Error("Ungültige Wetterdaten.");
    }

    return payload.data;
  }

  async function fetchCalendar(endpoint, signal) {
    const response = await fetch(endpoint, { signal, cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Calendar HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || !payload.ok || !payload.data || !Array.isArray(payload.data.items)) {
      throw new Error("Ungültige Kalenderdaten.");
    }

    return payload.data.items;
  }

  function withCacheBusting(url, enabled) {
    if (!enabled) {
      return url;
    }

    try {
      const parsedUrl = new URL(url, window.location.origin);
      parsedUrl.searchParams.set("_ts", String(Date.now()));
      return parsedUrl.toString();
    } catch (error) {
      return url;
    }
  }
  async function fetchFeed(endpoint, source, signal) {
    const query = new URLSearchParams();
    if (source) {
      query.set("source", source);
    }

    const url = query.toString() ? `${endpoint}?${query.toString()}` : endpoint;
    const response = await fetch(url, { signal, cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Feed HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || !payload.ok || !payload.data || !Array.isArray(payload.data.items)) {
      throw new Error("Ungültige Feed-Daten.");
    }

    return payload.data;
  }
  registerWidget({
    type: "clock",
    render(container, widgetConfig = {}) {
      container.classList.add("widget-clock", "widget-card--wide");
      container.innerHTML =
        `<p class="widget-card__title">${widgetConfig.title || "Aktuelle Zeit"}</p>` +
        '<time class="widget-clock__time" datetime="">--:--</time>' +
        '<time class="widget-clock__date" datetime="">Datum wird geladen</time>';

      const timeElement = container.querySelector(".widget-clock__time");
      const dateElement = container.querySelector(".widget-clock__date");

      const timeFormatter = new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit"
      });

      const dateFormatter = new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
      });

      const updateClock = () => {
        const now = new Date();
        const isoDateTime = formatIsoDateTime(now);

        timeElement.textContent = timeFormatter.format(now);
        timeElement.dateTime = isoDateTime;

        dateElement.textContent = dateFormatter.format(now);
        dateElement.dateTime = isoDateTime;
      };

      updateClock();

      const minuteMs = 60 * 1000;
      const delayUntilNextMinute = minuteMs - (Date.now() % minuteMs);

      let tickIntervalId;
      const alignTimeoutId = window.setTimeout(() => {
        updateClock();
        tickIntervalId = window.setInterval(updateClock, minuteMs);
      }, delayUntilNextMinute);

      return function destroyClockWidget() {
        window.clearTimeout(alignTimeoutId);
        if (tickIntervalId) {
          window.clearInterval(tickIntervalId);
        }
      };
    }
  });

  registerWidget({
    type: "weather",
    render(container, widgetConfig = {}) {
      container.classList.add("widget-weather");
      container.innerHTML =
        `<p class="widget-card__title">${widgetConfig.title || "Wetter"}</p>` +
        '<p class="widget-weather__loading">Lade Wetterdaten …</p>';

      const controller = new AbortController();

      const endpoint = widgetConfig.endpoint || "/api/weather";

      fetchWeather(endpoint, controller.signal)
        .then((data) => {
          container.innerHTML =
            `<p class="widget-card__title">${widgetConfig.title || "Wetter"}</p>` +
            `<p class="widget-weather__location">${data.location}</p>` +
            `<p class="widget-weather__temp">${data.temperatureC}°C</p>` +
            `<p class="widget-weather__condition">${humanizeWeatherCondition(data.condition)}</p>` +
            `<p class="widget-weather__range">${data.lowC}° / ${data.highC}°</p>`;
        })
        .catch((error) => {
          if (error.name === "AbortError") {
            return;
          }

          logger.warn("Weather-Widget konnte nicht geladen werden.", error);
          container.innerHTML =
            `<p class="widget-card__title">${widgetConfig.title || "Wetter"}</p>` +
            '<p class="widget-weather__error">Wetter derzeit nicht verfügbar.</p>';
        });

      return function destroyWeatherWidget() {
        controller.abort();
      };
    }
  });

  registerWidget({
    type: "calendar",
    render(container, widgetConfig = {}) {
      container.classList.add("widget-calendar");
      container.innerHTML =
        `<p class="widget-card__title">${widgetConfig.title || "Kalender"}</p>` +
        '<p class="widget-calendar__loading">Lade Termine …</p>';

      const controller = new AbortController();
      const endpoint = widgetConfig.endpoint || "/api/calendar";
      const maxItems = Number.isInteger(widgetConfig.maxItems) ? widgetConfig.maxItems : 3;

      fetchCalendar(endpoint, controller.signal)
        .then((items) => {
          const upcomingItems = items.slice(0, Math.max(1, maxItems));

          if (upcomingItems.length === 0) {
            container.innerHTML =
              `<p class="widget-card__title">${widgetConfig.title || "Kalender"}</p>` +
              '<p class="widget-calendar__empty">Keine anstehenden Termine.</p>';
            return;
          }

          const rows = upcomingItems
            .map((item) => {
              const timeLabel = formatCalendarTimeRange(item.start, item.end);
              const title = item.title || "Ohne Titel";
              return (
                '<li class="widget-calendar__item">' +
                `<span class="widget-calendar__time">${timeLabel}</span>` +
                `<span class="widget-calendar__title">${title}</span>` +
                "</li>"
              );
            })
            .join("");

          container.innerHTML =
            `<p class="widget-card__title">${widgetConfig.title || "Kalender"}</p>` +
            `<ul class="widget-calendar__list">${rows}</ul>`;
        })
        .catch((error) => {
          if (error.name === "AbortError") {
            return;
          }

          logger.warn("Kalender-Widget konnte nicht geladen werden.", error);
          container.innerHTML =
            `<p class="widget-card__title">${widgetConfig.title || "Kalender"}</p>` +
            '<p class="widget-calendar__error">Kalender derzeit nicht verfügbar.</p>';
        });

      return function destroyCalendarWidget() {
        controller.abort();
      };
    }
  });

  registerWidget({
    type: "feed",
    render(container, widgetConfig = {}) {
      container.classList.add("widget-feed");
      container.innerHTML =
        `<p class="widget-card__title">${widgetConfig.title || "Feed"}</p>` +
        '<p class="widget-feed__loading">Lade Feed …</p>';

      const controller = new AbortController();
      const endpoint = widgetConfig.endpoint || "/api/feed";
      const source = widgetConfig.source || "";
      const maxItems = Number.isInteger(widgetConfig.maxItems) ? widgetConfig.maxItems : 3;

      fetchFeed(endpoint, source, controller.signal)
        .then((feedData) => {
          const items = feedData.items.slice(0, Math.max(1, maxItems));

          if (items.length === 0) {
            container.innerHTML =
              `<p class="widget-card__title">${widgetConfig.title || "Feed"}</p>` +
              '<p class="widget-feed__empty">Keine neuen Einträge.</p>';
            return;
          }

          const sourceLine = feedData.title
            ? `<p class="widget-feed__source">${feedData.title}</p>`
            : "";

          const rows = items
            .map((item) => `<li class="widget-feed__item">${item.title || "Ohne Titel"}</li>`)
            .join("");

          container.innerHTML =
            `<p class="widget-card__title">${widgetConfig.title || "Feed"}</p>` +
            sourceLine +
            `<ul class="widget-feed__list">${rows}</ul>`;
        })
        .catch((error) => {
          if (error.name === "AbortError") {
            return;
          }

          logger.warn("Feed-Widget konnte nicht geladen werden.", error);
          container.innerHTML =
            `<p class="widget-card__title">${widgetConfig.title || "Feed"}</p>` +
            '<p class="widget-feed__error">Feed derzeit nicht verfügbar.</p>';
        });

      return function destroyFeedWidget() {
        controller.abort();
      };
    }
  });

  registerWidget({
    type: "webcam",
    render(container, widgetConfig = {}) {
      container.classList.add("widget-webcam", "widget-card--wide");

      const imageUrl = widgetConfig.imageUrl || "";
      const cacheBust = widgetConfig.cacheBust === true;
      const refreshMs = Number.isInteger(widgetConfig.refreshMs) ? widgetConfig.refreshMs : 0;

      if (!imageUrl) {
        container.innerHTML =
          `<p class="widget-card__title">${widgetConfig.title || "Webcam"}</p>` +
          '<p class="widget-webcam__error">Snapshot derzeit nicht verfügbar.</p>';
        return;
      }

      const renderLoadingState = () => {
        container.innerHTML =
          `<p class="widget-card__title">${widgetConfig.title || "Webcam"}</p>` +
          '<p class="widget-webcam__loading">Lade Snapshot …</p>';
      };

      const renderImageState = (resolvedUrl) => {
        container.innerHTML =
          `<p class="widget-card__title">${widgetConfig.title || "Webcam"}</p>` +
          '<div class="widget-webcam__frame">' +
          `<img class="widget-webcam__image" src="${resolvedUrl}" alt="${widgetConfig.title || "Webcam Snapshot"}" loading="lazy" />` +
          "</div>";
      };

      const renderErrorState = () => {
        container.innerHTML =
          `<p class="widget-card__title">${widgetConfig.title || "Webcam"}</p>` +
          '<p class="widget-webcam__error">Snapshot derzeit nicht verfügbar.</p>';
      };

      let refreshIntervalId;
      let disposed = false;
      let loadRunId = 0;

      const loadSnapshot = (showLoading) => {
        if (showLoading) {
          renderLoadingState();
        }

        const snapshotUrl = withCacheBusting(imageUrl, cacheBust);
        const preloader = new Image();
        loadRunId += 1;
        const currentRunId = loadRunId;

        preloader.onload = () => {
          if (disposed || currentRunId !== loadRunId) {
            return;
          }
          renderImageState(snapshotUrl);
        };

        preloader.onerror = () => {
          if (disposed || currentRunId !== loadRunId) {
            return;
          }
          logger.warn("Webcam-Snapshot konnte nicht geladen werden.");
          renderErrorState();
        };

        preloader.src = snapshotUrl;
      };

      loadSnapshot(true);

      if (refreshMs > 0) {
        refreshIntervalId = window.setInterval(() => loadSnapshot(false), refreshMs);
      }

      return function destroyWebcamWidget() {
        disposed = true;
        if (refreshIntervalId) {
          window.clearInterval(refreshIntervalId);
        }
      };
    }
  });

  registerWidget({
    type: "placeholder",
    render(container, widgetConfig = {}) {
      container.classList.add("widget-placeholder");
      container.innerHTML =
        `<p class="widget-card__title">${widgetConfig.title || "Widget"}</p>` +
        `<h3>${widgetConfig.originalType || "Unbekanntes Widget"}</h3>` +
        '<p class="widget-placeholder__hint">Dieser Widget-Typ ist noch nicht implementiert.</p>';
    }
  });

  global.DashboardWidgets = {
    registerWidget,
    getWidget
  };
})(window);
