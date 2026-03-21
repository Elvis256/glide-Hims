import { useState, useCallback } from 'react';
import { useAuthStore } from '../store/auth';

const STORAGE_KEY = 'glide-hims-doctor-cert-prefs';

interface DoctorCertPrefs {
  qualification: string;
  registrationNo: string;
}

function load(): DoctorCertPrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { qualification: '', registrationNo: '' };
}

function save(prefs: DoctorCertPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/**
 * Shared hook for doctor details across all certificate pages.
 * Uses the logged-in user's name + localStorage-persisted qualification/regNo.
 */
export function useDoctorCertPrefs() {
  const { user } = useAuthStore();
  const [prefs, setPrefs] = useState<DoctorCertPrefs>(load);

  const doctorName = user?.fullName || 'Certifying Physician';

  const updatePrefs = useCallback((partial: Partial<DoctorCertPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...partial }));
  }, []);

  const savePrefs = useCallback(() => {
    save(prefs);
  }, [prefs]);

  return { doctorName, prefs, updatePrefs, savePrefs };
}
