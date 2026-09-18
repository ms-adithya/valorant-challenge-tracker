// Privacy-conscious client error reporting with an optional delivery endpoint.
(function (root) {
  const QUEUE_KEY = "vctErrorQueue";
  const MAX_QUEUE = 20;
  let reporting = false;

  function scrub(value) {
    return String(value || "")
      .replace(/([?&](?:token|idToken|access_token|password|secret|apiKey)=)[^&\s]+/gi, "$1[redacted]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
      .slice(0, 2000);
  }

  function errorPayload(error, context) {
    const source = error instanceof Error ? error : new Error(String(error || "Unknown error"));
    return {
      message: scrub(source.message),
      name: scrub(source.name),
      stack: scrub(source.stack),
      context: scrub(context),
      path: root.location ? root.location.pathname : "",
      userAgent: root.navigator ? root.navigator.userAgent : "",
      at: new Date().toISOString(),
    };
  }

  function readQueue() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(QUEUE_KEY);
      const queue = raw ? JSON.parse(raw) : [];
      return Array.isArray(queue) ? queue : [];
    } catch (_) {
      return [];
    }
  }

  function writeQueue(queue) {
    try {
      if (root.localStorage) root.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
    } catch (_) {}
  }

  function endpoint() {
    return typeof root.VCT_ERROR_REPORT_URL === "string" ? root.VCT_ERROR_REPORT_URL.trim() : "";
  }

  function deliver(queue) {
    const url = endpoint();
    if (!url || !queue.length || reporting) return;
    reporting = true;
    const body = JSON.stringify({ errors: queue.slice(-MAX_QUEUE) });
    try {
      if (root.navigator && typeof root.navigator.sendBeacon === "function") {
        const accepted = root.navigator.sendBeacon(
          url,
          new Blob([body], { type: "application/json" })
        );
        if (accepted) {
          writeQueue([]);
          reporting = false;
          return;
        }
      }
      if (typeof root.fetch === "function") {
        root.fetch(url, {
          method: "POST",
          body,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        }).then(() => writeQueue([])).catch(() => {}).finally(() => { reporting = false; });
        return;
      }
    } catch (_) {}
    reporting = false;
  }

  function reportError(error, context) {
    const item = errorPayload(error, context);
    const queue = [...readQueue(), item].slice(-MAX_QUEUE);
    writeQueue(queue);
    deliver(queue);
    if (root.console && typeof root.console.error === "function") {
      root.console.error("VCT error", item.message, context || "");
    }
  }

  root.VCTErrorReporter = { reportError, scrub };
  root.addEventListener("error", (event) => {
    reportError(event.error || event.message, "window.error");
  });
  root.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, "unhandledrejection");
  });
})(typeof window !== "undefined" ? window : globalThis);
