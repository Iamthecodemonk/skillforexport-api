import logger from './logger.js';

const performanceLogger = logger.child('PERFORMANCE');

const percentile = (sorted, value) => {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((value / 100) * sorted.length) - 1);
  return Number(sorted[Math.max(0, index)].toFixed(2));
};

const routeName = (req) => {
  const route = req && req.routeOptions && req.routeOptions.url;
  if (route) return `${req.method} ${route}`;
  const path = req && req.raw && req.raw.url ? String(req.raw.url).split('?')[0] : 'unknown';
  return `${req && req.method || 'UNKNOWN'} ${path}`;
};

export function createPerformanceMonitor({ slowRequestMs = 1000, sampleSize = 500 } = {}) {
  const starts = new WeakMap();
  const routes = new Map();
  const startedAt = new Date();

  const record = (name, durationMs, statusCode) => {
    const current = routes.get(name) || { count: 0, errors: 0, totalMs: 0, maxMs: 0, samples: [] };
    current.count += 1;
    current.totalMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    if (statusCode >= 500) current.errors += 1;
    current.samples.push(durationMs);
    if (current.samples.length > sampleSize) current.samples.shift();
    routes.set(name, current);
  };

  return {
    onRequest(req, reply, done) {
      starts.set(req, process.hrtime.bigint());
      done();
    },

    onResponse(req, reply, done) {
      const start = starts.get(req);
      if (start) {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        const name = routeName(req);
        record(name, durationMs, reply.statusCode);
        const context = {
          method: req.method,
          route: name,
          statusCode: reply.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          requestId: req.id
        };
        if (durationMs >= slowRequestMs) performanceLogger.warn('Slow request', context);
        else performanceLogger.debug('Request completed', context);
      }
      starts.delete(req);
      done();
    },

    snapshot() {
      const routeMetrics = {};
      let totalRequests = 0;
      let totalErrors = 0;
      for (const [name, metric] of routes.entries()) {
        const sorted = [...metric.samples].sort((a, b) => a - b);
        totalRequests += metric.count;
        totalErrors += metric.errors;
        routeMetrics[name] = {
          count: metric.count,
          errors: metric.errors,
          averageMs: Number((metric.totalMs / metric.count).toFixed(2)),
          p50Ms: percentile(sorted, 50),
          p95Ms: percentile(sorted, 95),
          p99Ms: percentile(sorted, 99),
          maxMs: Number(metric.maxMs.toFixed(2)),
          sampleCount: sorted.length
        };
      }
      return {
        startedAt: startedAt.toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        totalRequests,
        totalErrors,
        slowRequestThresholdMs: slowRequestMs,
        routes: routeMetrics
      };
    }
  };
}

export default createPerformanceMonitor;
