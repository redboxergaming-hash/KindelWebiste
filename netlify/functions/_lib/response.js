function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

function success(data, meta = {}) {
  return json(200, {
    ok: true,
    data,
    meta: {
      generatedAt: new Date().toISOString(),
      ...meta
    }
  });
}

function failure(statusCode, code, message) {
  return json(statusCode, {
    ok: false,
    error: {
      code,
      message
    }
  });
}

module.exports = {
  json,
  success,
  failure
};
