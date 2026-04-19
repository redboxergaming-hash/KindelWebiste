(function initApp() {
  "use strict";

  const FULL_RELOAD_INTERVAL_MS = 0;
  const CONFIG_PATH = "config/dashboard.json";

  const widgetCleanupCallbacks = [];

  function createWidgetCard() {
    const card = document.createElement("article");
    card.className = "widget-card";
    return card;
  }

  function resolveWidget(type) {
    const registry = window.DashboardWidgets;
    if (!registry) {
      throw new Error("Widget-Registry nicht verfügbar.");
    }

    return registry.getWidget(type) || registry.getWidget("placeholder");
  }

  async function loadDashboardConfig() {
    const response = await fetch(CONFIG_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Config-HTTP-Fehler (${response.status})`);
    }

    const config = await response.json();
    if (!config || !Array.isArray(config.pages) || config.pages.length === 0) {
      throw new Error("Ungültige Dashboard-Konfiguration.");
    }

    return config;
  }

  function renderStatusMessage(message, isError) {
    const statusArea = document.getElementById("status-area");
    if (!statusArea) {
      return;
    }

    if (!message) {
      statusArea.innerHTML = "";
      return;
    }

    const cssClass = isError ? "status-message status-message--error" : "status-message";
    statusArea.innerHTML = `<p class="${cssClass}">${message}</p>`;
  }

  function renderWidgets(widgets) {
    const grid = document.getElementById("widget-grid");
    if (!grid) {
      return;
    }

    grid.innerHTML = "";

    widgets.forEach((widgetConfig) => {
      const widget = resolveWidget(widgetConfig.type);
      const card = createWidgetCard();
      grid.appendChild(card);

      const safeConfig =
        widgetConfig.type === widget.type
          ? widgetConfig
          : {
              ...widgetConfig,
              originalType: widgetConfig.type
            };

      const cleanup = widget.render(card, safeConfig);
      if (typeof cleanup === "function") {
        widgetCleanupCallbacks.push(cleanup);
      }
    });
  }

  function clearWidgetCleanupCallbacks() {
    widgetCleanupCallbacks.forEach((cleanup) => cleanup());
    widgetCleanupCallbacks.length = 0;
  }

  function renderPageHeader(page) {
    const title = document.getElementById("page-title");
    if (title) {
      title.textContent = page.name || "Dashboard";
    }
  }

  function startOptionalAutoReload() {
    if (FULL_RELOAD_INTERVAL_MS <= 0) {
      return;
    }

    window.setInterval(() => {
      window.location.reload();
    }, FULL_RELOAD_INTERVAL_MS);
  }

  async function bootstrapDashboard() {
    clearWidgetCleanupCallbacks();

    try {
      const config = await loadDashboardConfig();
      const firstPage = config.pages[0];

      renderPageHeader(firstPage);
      renderWidgets(Array.isArray(firstPage.widgets) ? firstPage.widgets : []);
      renderStatusMessage("", false);
    } catch (error) {
      console.error("Dashboard-Konfiguration konnte nicht geladen werden.", error);
      renderPageHeader({ name: "Dashboard" });
      renderWidgets([]);
      renderStatusMessage(
        "Konfiguration konnte nicht geladen werden. Bitte Datei und Server prüfen.",
        true
      );
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    document.documentElement.classList.add("app-ready");
    await bootstrapDashboard();
    startOptionalAutoReload();
    console.info("Kindle Smart Dashboard: Konfigurations-Rendering initialisiert.");
  });

  window.addEventListener("beforeunload", () => {
    clearWidgetCleanupCallbacks();
  });
})();
