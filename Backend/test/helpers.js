// Utilidades mínimas para probar middlewares de Express sin levantar un servidor real.

export function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

// Corre un middleware (req, res, next) y resuelve cuando `next()` se llama o cuando el
// middleware responde directamente (res.status().json()). Sirve tanto para middlewares
// síncronos como para los que resuelven una promesa internamente (p. ej. consultas a BD).
export function runMiddleware(middleware, req) {
  return new Promise((resolve) => {
    let settled = false;
    const res = makeRes();
    const origJson = res.json.bind(res);
    res.json = (payload) => {
      origJson(payload);
      if (!settled) {
        settled = true;
        resolve({ nextCalled: false, statusCode: res.statusCode, body: res.body });
      }
      return res;
    };
    const next = () => {
      if (!settled) {
        settled = true;
        resolve({ nextCalled: true, statusCode: null, body: null });
      }
    };
    middleware(req, res, next);
  });
}
