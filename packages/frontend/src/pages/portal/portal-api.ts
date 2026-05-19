/**
 * Tiny standalone API client for the patient portal.
 *
 * F-04 hardening: the portal token is now an httpOnly cookie set by the
 * backend (Set-Cookie: portalToken=…; HttpOnly; SameSite=Strict; Path=
 * /api/v1/portal). The browser sends it automatically when withCredentials
 * is set; no JS-readable token, so XSS in the SPA cannot exfiltrate it.
 *
 * The patient profile is kept only in sessionStorage so it disappears when
 * the tab closes and never persists across browser sessions.
 */
import axios from 'axios';

const PORTAL_PATIENT_KEY = 'patientPortalProfile';

export const portalApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
});

export const portalAuth = {
  isLoggedIn(): boolean {
    return !!sessionStorage.getItem(PORTAL_PATIENT_KEY);
  },
  setSession(patient: any) {
    sessionStorage.setItem(PORTAL_PATIENT_KEY, JSON.stringify(patient));
  },
  getPatient(): any | null {
    const raw = sessionStorage.getItem(PORTAL_PATIENT_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  async signOut() {
    try {
      await portalApi.post('/portal/logout');
    } catch {
      // best-effort — the cookie is cleared client-side regardless
    }
    sessionStorage.removeItem(PORTAL_PATIENT_KEY);
  },
};
