(function initWidgets(global) {
  "use strict";

  const registry = new Map();

  function registerWidget(widgetDefinition) {
    if (!widgetDefinition || !widgetDefinition.type || typeof widgetDefinition.render !== "function") {
      throw new Error("Ungültige Widget-Definition.");
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
