import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import api from '../services/api';

/**
 * Standardized data-fetching hook for system admin pages.
 * Handles loading, error display, retry, and pagination.
 */
interface UseSystemApiOptions<T> {
  /** API endpoint path, e.g. '/tenants' */
  url: string;
  /** Query params (triggers reload when changed) */
  params?: Record<string, unknown>;
  /** Transform response data before storing */
  transform?: (data: any) => T;
  /** Whether to auto-load on mount. Default: true */
  autoLoad?: boolean;
  /** Error message prefix for toast */
  errorPrefix?: string;
}

interface UseSystemApiResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  total: number;
  reload: () => Promise<void>;
}

export function useSystemList<T = any[]>(opts: UseSystemApiOptions<T[]>): UseSystemApiResult<T[]> {
  const {
    url,
    params,
    transform,
    autoLoad = true,
    errorPrefix = 'Failed to load data',
  } = opts;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params: paramsRef.current });
      const meta = (res as any).meta;
      let items: any;
      if (Array.isArray(res.data)) {
        items = res.data;
      } else if (res.data?.items) {
        items = res.data.items;
      } else if (Array.isArray(res.data?.data)) {
        items = res.data.data;
      } else {
        items = res.data || [];
      }
      const result = transform ? transform(items) : items;
      setData(result);
      setTotal(meta?.total ?? res.data?.total ?? result.length);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || errorPrefix;
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      toast.error(errorPrefix, { description: typeof msg === 'string' ? msg : undefined });
    } finally {
      setLoading(false);
    }
  }, [url, errorPrefix, transform]);

  useEffect(() => {
    if (autoLoad) load();
  }, [load, autoLoad, JSON.stringify(params)]);

  return { data, loading, error, total, reload: load };
}

/**
 * Wraps an async action with toast feedback and error handling.
 * Returns [execute, loading] tuple.
 */
export function useSystemAction<TArgs extends any[] = []>(
  action: (...args: TArgs) => Promise<void>,
  opts?: { successMsg?: string; errorMsg?: string },
): [(...args: TArgs) => Promise<boolean>, boolean] {
  const [loading, setLoading] = useState(false);

  const execute = useCallback(
    async (...args: TArgs): Promise<boolean> => {
      setLoading(true);
      try {
        await action(...args);
        if (opts?.successMsg) toast.success(opts.successMsg);
        return true;
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || opts?.errorMsg || 'Operation failed';
        toast.error(typeof msg === 'string' ? msg : 'Operation failed');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [action, opts?.successMsg, opts?.errorMsg],
  );

  return [execute, loading];
}
