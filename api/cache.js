const TTL_MS = Number(process.env.CACHE_TTL_MS) || 5 * 60 * 1000;
const store = new Map();

function cacheMiddleware(req, res, next) {
  if (req.method !== 'GET') return next();

  const key = req.originalUrl;
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) {
    res.set('X-Cache', 'HIT');
    return res.json(hit.body);
  }
  if (hit) store.delete(key);

  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200 && body && body.success !== false) {
      store.set(key, { body, expires: Date.now() + TTL_MS });
    }
    res.set('X-Cache', 'MISS');
    return sendJson(body);
  };
  next();
}

function clearCache() {
  store.clear();
}

module.exports = { cacheMiddleware, clearCache, TTL_MS };
