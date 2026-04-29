/**
 * Tiny standalone API client for the patient portal.
 *
 * This intentionally does NOT use the main `services/api.ts` axios instance,
 * because that one is wired to the staff JWT cookie/localStorage and would
 * fight with the staff session if both happen to be open. The portal token
 * is stored under a separate key (`patientPortalToken`) and only attached
 * to /portal/* requests.
 */
import axios from 'axios';

const PORTAL_TOKEN_KEY = 'patientPortalToken';
const PORTAL_PATIENT_KEY = 'patientPortalProfile';

export const portalApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
});

portalApi.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(PORTAL_TOKEN_KEY);
  if (t) {
    cfg.headers = cfg.headers || {};
    (cfg.headers as any).Authorization = `Bearer ${t}`;
  }
  return cfg;
});

export const portalAuth = {
  isLoggedIn(): boolean {
    return !!localStorage.getItem(PORTAL_TOKEN_KEY);
  },
  setSession(token: string, patient: any) {
    localStorage.setItem(PORTAL_TOKEN_KEY, token);
    localStorage.setItem(PORTAL_PATIENT_KEY, JSON.stringify(patient));
  },
  getPatient(): any | null {
    const raw = localStorage.getItem(PORTAL_PATIENT_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  signOut() {
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    localStorage.removeItem(PORTAL_PATIENT_KEY);
  },
};
