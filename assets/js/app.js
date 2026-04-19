(function initApp() {
  "use strict";

  const FULL_RELOAD_INTERVAL_MS = 0;
  const CONFIG_PATH = "config/dashboard.json";
  const DEFAULT_ROTATION_MS = 20000;
  const LOCAL_EDITOR_CONFIG_KEY = "kindle_dashboard_editor_config";

  const logger = (window.AppUtils && window.AppUtils.createLogger("app")) || console;

  const widgetCleanupCallbacks = [];
  let pageRotationIntervalId;

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

  function parsePreviewConfig() {
    try {
      const stored = window.localStorage.getItem(LOCAL_EDITOR_CONFIG_KEY);
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored);
      if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
        return parsed;
      }
    } catch (error) {
      logger.warn("Preview-Konfiguration konnte nicht gelesen werden.", error);
    }

    return null;
  }

  async function loadDashboardConfig() {
    const params = new URLSearchParams(window.location.search);
    const usePreviewConfig = params.get("preview") === "1";

    if (usePreviewConfig) {
      const previewConfig = parsePreviewConfig();
      if (previewConfig) {
        return previewConfig;
      }
    }

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

  function getAppMode() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");

    if (mode === "editor" || mode === "dashboard") {
      return mode;
    }

    return "dashboard";
  }

  function setActiveModeStyling(mode) {
    document.body.classList.toggle("mode-dashboard", mode === "dashboard");
    document.body.classList.toggle("mode-editor", mode === "editor");

    document.querySelectorAll("[data-mode-link]").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.modeLink === mode);
    });
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

  function clearWidgetCleanupCallbacks() {
    widgetCleanupCallbacks.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        logger.warn("Widget-Cleanup fehlgeschlagen.", error);
      }
    });

    widgetCleanupCallbacks.length = 0;
  }

  function stopPageRotation() {
    if (pageRotationIntervalId) {
      window.clearInterval(pageRotationIntervalId);
      pageRotationIntervalId = undefined;
    }
  }

  function showDashboardShell() {
    const grid = document.getElementById("widget-grid");
    const editorRoot = document.getElementById("editor-root");
    if (grid) grid.style.display = "grid";
    if (editorRoot) editorRoot.style.display = "none";
  }

  function showEditorShell() {
    const grid = document.getElementById("widget-grid");
    const editorRoot = document.getElementById("editor-root");
    if (grid) grid.style.display = "none";
    if (editorRoot) editorRoot.style.display = "block";
  }

  function renderWidgets(widgets) {
    const grid = document.getElementById("widget-grid");
    if (!grid) {
      return;
    }

    clearWidgetCleanupCallbacks();
    grid.innerHTML = "";

    const safeWidgets = Array.isArray(widgets) ? widgets : [];

    safeWidgets.forEach((widgetConfig) => {
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

  function renderPageHeader(titleText, sublineText) {
    const title = document.getElementById("page-title");
    if (title) {
      title.textContent = titleText;
    }

    const subline = document.querySelector(".subline");
    if (subline) {
      subline.textContent = sublineText;
    }
  }

  function getInitialPageIndex(pages) {
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get("page");

    if (!pageParam) {
      return 0;
    }

    const asNumber = Number.parseInt(pageParam, 10);
    if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= pages.length) {
      return asNumber - 1;
    }

    const byNameIndex = pages.findIndex((page) => page.name && page.name.toLowerCase() === pageParam.toLowerCase());
    return byNameIndex >= 0 ? byNameIndex : 0;
  }

  function startPageRotation(pages, initialIndex, rotationMs) {
    stopPageRotation();

    if (pages.length <= 1 || rotationMs <= 0) {
      return;
    }

    let activeIndex = initialIndex;

    pageRotationIntervalId = window.setInterval(() => {
      activeIndex = (activeIndex + 1) % pages.length;
      const page = pages[activeIndex];
      renderPageHeader(page.name || "Dashboard", `Seite ${activeIndex + 1}/${pages.length}`);
      renderWidgets(page.widgets);
    }, rotationMs);
  }

  function startOptionalAutoReload() {
    if (FULL_RELOAD_INTERVAL_MS <= 0) {
      return;
    }

    window.setInterval(() => {
      window.location.reload();
    }, FULL_RELOAD_INTERVAL_MS);
  }

  function renderEditorMode(config) {
    const editorRoot = document.getElementById("editor-root");
    if (!editorRoot || !window.DashboardEditor) {
      throw new Error("Editor-Modul nicht verfügbar.");
    }

    stopPageRotation();
    clearWidgetCleanupCallbacks();
    showEditorShell();

    window.DashboardEditor.mountEditor(editorRoot, config, {
      onChange: (localConfig) => {
        const pageCount = Array.isArray(localConfig.pages) ? localConfig.pages.length : 0;
        window.localStorage.setItem(LOCAL_EDITOR_CONFIG_KEY, JSON.stringify(localConfig));
        renderPageHeader("Editor", `${pageCount} Seiten · lokale Änderungen aktiv`);
      },
      onPreview: (localConfig) => {
        window.localStorage.setItem(LOCAL_EDITOR_CONFIG_KEY, JSON.stringify(localConfig));
        window.location.href = "?mode=dashboard&preview=1";
      }
    });
  }

  function renderDashboardMode(config) {
    const pages = Array.isArray(config.pages) ? config.pages : [];
    if (pages.length === 0) {
      throw new Error("Keine Seiten in der Konfiguration vorhanden.");
    }

    const pageIndex = getInitialPageIndex(pages);
    const currentPage = pages[pageIndex];
    const parsedRotationMs = Number.parseInt(config.rotationMs, 10);
    const rotationMs = Number.isFinite(parsedRotationMs) ? parsedRotationMs : DEFAULT_ROTATION_MS;

    showDashboardShell();
    renderPageHeader(currentPage.name || "Dashboard", `Seite ${pageIndex + 1}/${pages.length}`);
    renderWidgets(currentPage.widgets);
    startPageRotation(pages, pageIndex, rotationMs);
  }

  async function bootstrapApp() {
    const mode = getAppMode();
    setActiveModeStyling(mode);
    stopPageRotation();

    try {
      const config = await loadDashboardConfig();

      if (mode === "editor") {
        renderEditorMode(config);
      } else {
        renderDashboardMode(config);
      }

      renderStatusMessage("", false);
    } catch (error) {
      logger.error("App konnte nicht initialisiert werden.", error);
      showDashboardShell();
      renderPageHeader("Dashboard", "Fehler beim Laden");
      renderWidgets([]);
      renderStatusMessage(
        "Konfiguration konnte nicht geladen werden. Bitte Datei und Server prüfen.",
        true
      );
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    document.documentElement.classList.add("app-ready");
    await bootstrapApp();
    startOptionalAutoReload();
    logger.info("Moduslogik initialisiert.");
  });

  window.addEventListener("beforeunload", () => {
    stopPageRotation();
    clearWidgetCleanupCallbacks();
  });
})();
