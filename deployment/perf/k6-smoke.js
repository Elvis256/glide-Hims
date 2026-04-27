// k6 smoke test — single virtual user, sanity check that the standalone
// stack is alive and the critical happy path works.
//
// Run:  k6 run deployment/perf/k6-smoke.js
//   env BASE_URL=https://yourhost  USER=admin  PASS=Admin@123

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const USER = __ENV.USER || 'admin';
const PASS = __ENV.PASS || 'Admin@123';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed:   ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

export default function () {
  const health = http.get(`${BASE}/api/v1/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  const login = http.post(
    `${BASE}/api/v1/auth/login`,
    JSON.stringify({ username: USER, password: PASS }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(login, { 'login 200/201': (r) => r.status === 200 || r.status === 201 });

  sleep(1);
}
