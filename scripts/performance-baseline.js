const baseUrl = String(process.env.PERF_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const token = process.env.PERF_TOKEN || '';
const concurrency = Math.max(1, parseInt(process.env.PERF_CONCURRENCY || '10', 10));
const durationSeconds = Math.max(1, parseInt(process.env.PERF_DURATION_SECONDS || '30', 10));
const timeoutMs = Math.max(1000, parseInt(process.env.PERF_REQUEST_TIMEOUT_MS || '15000', 10));
const endpointList = process.env.PERF_ENDPOINTS || '/feeds?page=1&per_page=10,/posts?page=1&per_page=10,/questions?page=1&per_page=10';
const endpoints = endpointList.split(',').map((value) => value.trim()).filter(Boolean);

if (endpoints.length === 0) throw new Error('PERF_ENDPOINTS must include at least one endpoint');

const results = new Map(endpoints.map((endpoint) => [endpoint, { durations: [], statuses: {}, errors: 0, bytes: 0, maxMs: 0 }]));
const deadline = Date.now() + durationSeconds * 1000;

const percentile = (values, percent) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percent / 100) * sorted.length) - 1);
  return Number(sorted[Math.max(index, 0)].toFixed(2));
};

async function request(endpoint) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = process.hrtime.bigint();
  const metric = results.get(endpoint);
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal
    });
    const body = await response.arrayBuffer();
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    metric.durations.push(durationMs);
    metric.maxMs = Math.max(metric.maxMs, durationMs);
    metric.statuses[response.status] = (metric.statuses[response.status] || 0) + 1;
    metric.bytes += body.byteLength;
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    metric.durations.push(durationMs);
    metric.maxMs = Math.max(metric.maxMs, durationMs);
    metric.errors += 1;
  } finally {
    clearTimeout(timeout);
  }
}

async function worker(workerId) {
  let index = workerId % endpoints.length;
  while (Date.now() < deadline) {
    const endpoint = endpoints[index % endpoints.length];
    index += 1;
    await request(endpoint);
  }
}

const startedAt = Date.now();
await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index)));
const elapsedSeconds = (Date.now() - startedAt) / 1000;

const report = {};
let totalRequests = 0;
let totalErrors = 0;
for (const [endpoint, metric] of results.entries()) {
  const count = metric.durations.length;
  const averageMs = count ? metric.durations.reduce((sum, value) => sum + value, 0) / count : 0;
  totalRequests += count;
  totalErrors += metric.errors;
  report[endpoint] = {
    requests: count,
    errors: metric.errors,
    statuses: metric.statuses,
    requestsPerSecond: Number((count / elapsedSeconds).toFixed(2)),
    averageMs: Number(averageMs.toFixed(2)),
    p50Ms: percentile(metric.durations, 50),
    p95Ms: percentile(metric.durations, 95),
    p99Ms: percentile(metric.durations, 99),
    maxMs: Number(metric.maxMs.toFixed(2)),
    averageResponseBytes: count ? Math.round(metric.bytes / count) : 0
  };
}

console.log(JSON.stringify({
  configuration: { baseUrl, concurrency, durationSeconds, timeoutMs, endpoints, authenticated: Boolean(token) },
  summary: {
    elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
    totalRequests,
    totalErrors,
    requestsPerSecond: Number((totalRequests / elapsedSeconds).toFixed(2))
  },
  endpoints: report
}, null, 2));
