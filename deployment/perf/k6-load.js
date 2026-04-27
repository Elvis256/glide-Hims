// k6 load test — ramps to 100 concurrent users hitting read-heavy endpoints.
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE   = __ENV.BASE_URL || 'http://localhost:3000';
const USER   = __ENV.USER     || 'admin';
const PASS   = __ENV.PASS     || 'Admin@123';
const TENANT = __ENV.TENANT   || '';

const loginTrend = new Trend('login_duration_ms', true);
const listTrend  = new Trend('list_duration_ms',  true);

export const options = {
  scenarios: {
    rampup: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 25 },
        { duration: '1m',  target: 100 },
        { duration: '2m',  target: 100 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed:   ['rate<0.02'],
    http_req_duration: ['p(95)<1500'],
    list_duration_ms:  ['p(95)<1200'],
  },
};

function login() {
  const t0 = Date.now();
  const res = http.post(
    `${BASE}/api/v1/auth/login`,
    JSON.stringify({ username: USER, password: PASS, tenantSlug: TENANT || undefined }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  loginTrend.add(Date.now() - t0);
  check(res, { 'login ok': (r) => r.status === 200 || r.status === 201 });
}

export default function () {
  if (__ITER === 0) login();

  group('reads', () => {
    const t0 = Date.now();
    const r1 = http.get(`${BASE}/api/v1/patients?page=1&limit=20`);
    listTrend.add(Date.now() - t0);
    check(r1, { 'patients 200': (r) => r.status === 200 });

    const r2 = http.get(`${BASE}/api/v1/queue?page=1&limit=20`);
    check(r2, { 'queue ok': (r) => r.status === 200 || r.status === 404 });

    const r3 = http.get(`${BASE}/api/v1/encounters?page=1&limit=20`);
    check(r3, { 'encounters ok': (r) => r.status === 200 || r.status === 404 });
  });

  sleep(Math.random() * 2 + 1);
}
