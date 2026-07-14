import { useEffect, useState } from 'react';
import { authService } from '../services/auth';
import { useAuthStore } from '../store/auth';
import { ShieldAlert, X } from 'lucide-react';
import { toast } from 'sonner';

interface MeResponse {
  impersonating?: boolean;
  originalTenantId?: string | null;
  activeTenantId?: string | null;
}

export default function ImpersonationBanner() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [info, setInfo] = useState<MeResponse | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me = (await authService.getMe()) as unknown as MeResponse;
        if (!cancelled) setInfo(me);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (!info?.impersonating) return null;

  const handleStop = async () => {
    setStopping(true);
    try {
      const res = await authService.endImpersonation();
      const { login: loginFn } = useAuthStore.getState();
      loginFn(res.user, res.accessToken, res.refreshToken);
      toast.success('Impersonation ended');
      // Hard reload to refresh tenant-scoped data caches
      window.location.assign('/system/tenants');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to end impersonation');
      setStopping(false);
    }
  };

  return (
    <div className="sticky top-0 z-50 w-full bg-red-600 text-white shadow-md">
      <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Impersonation active.</strong> You are viewing tenant{' '}
            <code className="bg-red-700/40 px-1 rounded">{info.activeTenantId}</code>. All
            actions are audited under your admin account.
          </span>
        </div>
        <button
          onClick={handleStop}
          disabled={stopping}
          className="inline-flex items-center gap-1 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50 text-xs font-semibold px-3 py-1 rounded"
        >
          <X className="w-3 h-3" />
          {stopping ? 'Stopping…' : 'Stop impersonating'}
        </button>
      </div>
    </div>
  );
}
