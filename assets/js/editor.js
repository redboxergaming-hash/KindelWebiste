(function initEditorModule(global) {
  "use strict";

  const AVAILABLE_WIDGET_TYPES = ["clock", "weather", "calendar", "feed", "webcam", "text", "placeholder"];

  function cloneConfig(config) {
    return JSON.parse(JSON.stringify(config || { pages: [] }));
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function createButton(label, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function createField(labelText, inputElement) {
    const wrapper = document.createElement("label");
    wrapper.className = "editor-field";

    const label = document.createElement("span");
    label.className = "editor-field__label";
    label.textContent = labelText;

    wrapper.appendChild(label);
    wrapper.appendChild(inputElement);
    return wrapper;
  }

  function validateConfigShape(config) {
    if (!config || typeof config !== "object") {
      throw new Error("Konfiguration muss ein Objekt sein.");
    }

    if (!Array.isArray(config.pages)) {
      throw new Error("Konfiguration benötigt ein pages-Array.");
    }

    config.pages.forEach((page, index) => {
      if (!page || typeof page !== "object") {
        throw new Error(`Seite ${index + 1} ist ungültig.`);
      }

      if (!Array.isArray(page.widgets)) {
        throw new Error(`Seite ${index + 1} benötigt ein widgets-Array.`);
      }
    });

    return true;
  }

  function mountEditor(root, initialConfig, options = {}) {
    const onChange = typeof options.onChange === "function" ? options.onChange : () => {};
    const onPreview = typeof options.onPreview === "function" ? options.onPreview : () => {};

    const state = {
      config: cloneConfig(initialConfig),
      importText: "",
      importError: ""
    };

    state.config.pages = ensureArray(state.config.pages);

    function emitChange() {
      onChange(cloneConfig(state.config));
    }

    function addPage() {
      const nextIndex = state.config.pages.length + 1;
      state.config.pages.push({
        name: `Neue Seite ${nextIndex}`,
        widgets: []
      });
      render();
      emitChange();
    }

    function renamePage(pageIndex, value) {
      const page = state.config.pages[pageIndex];
      if (!page) return;
      page.name = value;
      emitChange();
    }

    function addWidget(pageIndex, widgetType) {
      const page = state.config.pages[pageIndex];
      if (!page) return;
      page.widgets = ensureArray(page.widgets);
      page.widgets.push({
        type: widgetType,
        title: widgetType.charAt(0).toUpperCase() + widgetType.slice(1)
      });
      render();
      emitChange();
    }

    function removeWidget(pageIndex, widgetIndex) {
      const page = state.config.pages[pageIndex];
      if (!page) return;
      page.widgets = ensureArray(page.widgets);
      page.widgets.splice(widgetIndex, 1);
      render();
      emitChange();
    }

    function moveWidget(pageIndex, widgetIndex, direction) {
      const page = state.config.pages[pageIndex];
      if (!page) return;
      page.widgets = ensureArray(page.widgets);
      const targetIndex = widgetIndex + direction;
      if (targetIndex < 0 || targetIndex >= page.widgets.length) return;

      const [item] = page.widgets.splice(widgetIndex, 1);
      page.widgets.splice(targetIndex, 0, item);
      render();
      emitChange();
    }

    function updateWidgetField(pageIndex, widgetIndex, key, value) {
      const page = state.config.pages[pageIndex];
      if (!page || !page.widgets || !page.widgets[widgetIndex]) return;
      page.widgets[widgetIndex][key] = value;
      emitChange();
    }

    function buildWidgetConfigFields(pageIndex, widgetIndex, widget) {
      const fields = document.createElement("div");
      fields.className = "editor-widget-fields";

      const addTextInput = (label, key, placeholder = "") => {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "editor-input";
        input.value = widget[key] || "";
        input.placeholder = placeholder;
        input.addEventListener("input", (event) => updateWidgetField(pageIndex, widgetIndex, key, event.target.value));
        fields.appendChild(createField(label, input));
      };

      const addNumberInput = (label, key, fallbackValue) => {
        const input = document.createElement("input");
        input.type = "number";
        input.min = "1";
        input.className = "editor-input";
        input.value = Number.isFinite(widget[key]) ? widget[key] : fallbackValue;
        input.addEventListener("input", (event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          updateWidgetField(pageIndex, widgetIndex, key, Number.isFinite(parsed) ? parsed : fallbackValue);
        });
        fields.appendChild(createField(label, input));
      };

      const addTextarea = (label, key, placeholder = "") => {
        const textarea = document.createElement("textarea");
        textarea.className = "editor-textarea";
        textarea.value = widget[key] || "";
        textarea.placeholder = placeholder;
        textarea.addEventListener("input", (event) => updateWidgetField(pageIndex, widgetIndex, key, event.target.value));
        fields.appendChild(createField(label, textarea));
      };

      switch (widget.type) {
        case "clock":
          addTextInput("Titel", "title", "Aktuelle Zeit");
          break;
        case "weather":
          addTextInput("Titel", "title", "Wetter");
          addTextInput("Location Label", "locationLabel", "z. B. Berlin Mitte");
          break;
        case "calendar":
          addTextInput("Titel", "title", "Kalender");
          addNumberInput("Max Items", "maxItems", 3);
          break;
        case "feed":
          addTextInput("Titel", "title", "News Feed");
          addTextInput("Source", "source", "hn");
          break;
        case "webcam":
          addTextInput("Titel", "title", "Webcam");
          addTextInput("Image URL", "imageUrl", "https://...");
          break;
        case "text":
          addTextInput("Titel", "title", "Text");
          addTextarea("Content", "content", "Kurzer Textinhalt");
          break;
        default:
          addTextInput("Titel", "title", "Widget");
          break;
      }

      return fields;
    }

    function buildWidgetItem(pageIndex, widget, widgetIndex, total) {
      const item = document.createElement("li");
      item.className = "editor-widget-item";

      const meta = document.createElement("div");
      meta.className = "editor-widget-item__meta";

      const type = document.createElement("strong");
      type.textContent = widget.type || `widget-${widgetIndex + 1}`;

      const label = document.createElement("span");
      label.textContent = widget.title || "Ohne Titel";

      meta.appendChild(type);
      meta.appendChild(label);

      const actions = document.createElement("div");
      actions.className = "editor-widget-actions";
      actions.appendChild(createButton("↑", "editor-btn editor-btn--small", () => moveWidget(pageIndex, widgetIndex, -1)));
      actions.appendChild(createButton("↓", "editor-btn editor-btn--small", () => moveWidget(pageIndex, widgetIndex, 1)));
      actions.appendChild(createButton("Entfernen", "editor-btn editor-btn--small", () => removeWidget(pageIndex, widgetIndex)));

      if (widgetIndex === 0) {
        actions.children[0].disabled = true;
      }
      if (widgetIndex === total - 1) {
        actions.children[1].disabled = true;
      }

      item.appendChild(meta);
      item.appendChild(actions);
      item.appendChild(buildWidgetConfigFields(pageIndex, widgetIndex, widget));
      return item;
    }

    function buildPageCard(page, pageIndex) {
      const widgets = ensureArray(page.widgets);
      const card = document.createElement("article");
      card.className = "editor-page-card";

      const header = document.createElement("div");
      header.className = "editor-page-card__header";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "editor-page-name-input";
      nameInput.value = page.name || "";
      nameInput.placeholder = `Seite ${pageIndex + 1}`;
      nameInput.addEventListener("input", (event) => renamePage(pageIndex, event.target.value));

      const counter = document.createElement("span");
      counter.textContent = `${widgets.length} Widgets`;

      header.appendChild(nameInput);
      header.appendChild(counter);
      card.appendChild(header);

      const widgetList = document.createElement("ul");
      widgetList.className = "editor-widget-list";

      widgets.forEach((widget, widgetIndex) => {
        widgetList.appendChild(buildWidgetItem(pageIndex, widget, widgetIndex, widgets.length));
      });

      if (widgets.length === 0) {
        const empty = document.createElement("li");
        empty.className = "editor-widget-item editor-widget-item--empty";
        empty.textContent = "Noch keine Widgets";
        widgetList.appendChild(empty);
      }

      card.appendChild(widgetList);

      const addRow = document.createElement("div");
      addRow.className = "editor-add-widget-row";

      const select = document.createElement("select");
      select.className = "editor-select";
      AVAILABLE_WIDGET_TYPES.forEach((type) => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
      });

      const addButton = createButton("Add Widget", "editor-btn", () => addWidget(pageIndex, select.value));
      addRow.appendChild(select);
      addRow.appendChild(addButton);
      card.appendChild(addRow);

      return card;
    }

    function exportJsonString() {
      return JSON.stringify(state.config, null, 2);
    }

    function downloadExport() {
      const json = exportJsonString();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "dashboard-config.json";
      link.click();

      URL.revokeObjectURL(url);
    }

    function applyImportText() {
      state.importError = "";

      try {
        const parsed = JSON.parse(state.importText);
        validateConfigShape(parsed);
        state.config = cloneConfig(parsed);
        state.config.pages = ensureArray(state.config.pages);
        render();
        emitChange();
      } catch (error) {
        state.importError = error.message || "Import fehlgeschlagen.";
        render();
      }
    }

    function importFromFile(file) {
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        state.importText = String(reader.result || "");
        applyImportText();
      };
      reader.readAsText(file, "utf-8");
    }

    function buildImportExportPanel() {
      const panel = document.createElement("section");
      panel.className = "editor-import-export";

      const title = document.createElement("h3");
      title.textContent = "Export / Import";
      panel.appendChild(title);

      const exportArea = document.createElement("textarea");
      exportArea.className = "editor-textarea editor-textarea--code";
      exportArea.readOnly = true;
      exportArea.value = exportJsonString();
      panel.appendChild(exportArea);

      const exportActions = document.createElement("div");
      exportActions.className = "editor-import-export__actions";
      exportActions.appendChild(createButton("JSON herunterladen", "editor-btn", downloadExport));
      exportActions.appendChild(
        createButton("Preview im Dashboard", "editor-btn", () => {
          onPreview(cloneConfig(state.config));
        })
      );
      panel.appendChild(exportActions);

      const importInput = document.createElement("textarea");
      importInput.className = "editor-textarea editor-textarea--code";
      importInput.placeholder = "JSON hier einfügen …";
      importInput.value = state.importText;
      importInput.addEventListener("input", (event) => {
        state.importText = event.target.value;
      });
      panel.appendChild(importInput);

      const importActions = document.createElement("div");
      importActions.className = "editor-import-export__actions";

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "application/json,.json";
      fileInput.className = "editor-file-input";
      fileInput.addEventListener("change", (event) => {
        const file = event.target.files && event.target.files[0];
        importFromFile(file);
      });

      importActions.appendChild(createButton("JSON importieren", "editor-btn", applyImportText));
      importActions.appendChild(fileInput);
      panel.appendChild(importActions);

      if (state.importError) {
        const error = document.createElement("p");
        error.className = "editor-import-error";
        error.textContent = state.importError;
        panel.appendChild(error);
      }

      return panel;
    }

    function render() {
      root.innerHTML = "";

      const intro = document.createElement("p");
      intro.className = "editor-intro";
      intro.textContent = "Editor-Shell: lokale Bearbeitung im Browserzustand (ohne Speichern).";
      root.appendChild(intro);

      const topActions = document.createElement("div");
      topActions.className = "editor-top-actions";
      topActions.appendChild(createButton("Seite hinzufügen", "editor-btn", addPage));
      root.appendChild(topActions);

      const pageList = document.createElement("div");
      pageList.className = "editor-page-list";

      state.config.pages.forEach((page, pageIndex) => {
        pageList.appendChild(buildPageCard(page, pageIndex));
      });

      if (state.config.pages.length === 0) {
        const empty = document.createElement("p");
        empty.className = "editor-empty";
        empty.textContent = "Noch keine Seiten vorhanden.";
        pageList.appendChild(empty);
      }

      root.appendChild(pageList);
      root.appendChild(buildImportExportPanel());
    }

    render();
    emitChange();
  }

  global.DashboardEditor = {
    mountEditor
  };
})(window);
