import { useState, useCallback } from 'react';
import type { PagePreset } from './print';

const STORAGE_KEY = 'glide-hims-print-format';
const DEFAULT_FORMAT: PagePreset = 'receipt';

const VALID_FORMATS: PagePreset[] = ['receipt', 'a4', 'a5', 'letter'];

function readStored(): PagePreset {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as PagePreset | null;
    if (v && VALID_FORMATS.includes(v)) return v;
  } catch { /* SSR / private browsing */ }
  return DEFAULT_FORMAT;
}

export function usePrintFormat() {
  const [format, setFormatRaw] = useState<PagePreset>(readStored);

  const setFormat = useCallback((f: PagePreset) => {
    try { localStorage.setItem(STORAGE_KEY, f); } catch { /* ignore */ }
    setFormatRaw(f);
  }, []);

  return { printFormat: format, setPrintFormat: setFormat } as const;
}
