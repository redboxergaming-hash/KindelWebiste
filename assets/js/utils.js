(function initAppUtils(global) {
  "use strict";

  function isDebugEnabled() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") {
      return true;
    }

    return window.localStorage.getItem("dashboard_debug") === "1";
  }

  function createLogger(scope) {
    const debug = isDebugEnabled();
    const prefix = `[${scope}]`;

    return {
      debug: (...args) => {
        if (debug) {
          console.debug(prefix, ...args);
        }
      },
      info: (...args) => {
        if (debug) {
          console.info(prefix, ...args);
        }
      },
      warn: (...args) => {
        console.warn(prefix, ...args);
      },
      error: (...args) => {
        console.error(prefix, ...args);
      }
    };
  }

  global.AppUtils = {
    createLogger
  };
})(window);
