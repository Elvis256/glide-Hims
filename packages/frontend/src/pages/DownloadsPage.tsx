import { useEffect, useState } from 'react';
import { Download, Loader2, FileArchive, AlertCircle, Lock } from 'lucide-react';
import api from '../services/api';

interface Installer {
  id: string;
  name: string;
  version: string;
  channel: 'stable' | 'beta' | 'lts';
  kind: string;
  platform: string;
  filename: string;
  sizeBytes: string;
  sha256: string;
  releaseNotes: string | null;
  minLicenseTier: string | null;
  releasedAt: string;
}

const CHANNEL_BADGE: Record<string, string> = {
  stable: 'bg-emerald-100 text-emerald-700',
  beta: 'bg-amber-100 text-amber-700',
  lts: 'bg-blue-100 text-blue-700',
};

function fmtSize(bytes: string) {
  const n = Number(bytes);
  if (!isFinite(n) || n <= 0) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${u[i]}`;
}

export default function DownloadsPage() {
  const [items, setItems] = useState<Installer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/downloads')
      .then((r) => setItems(r.data?.data ?? r.data ?? []))
      .catch((e) => setError(e?.response?.data?.message ?? 'Failed to load installers'))
      .finally(() => setLoading(false));
  }, []);

  const href = (id: string) => `${api.defaults.baseURL || ''}/downloads/${id}/file`;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Software Updates & Installers</h1>
        <p className="text-sm text-gray-500 mt-1">
          Download the Glide HIMS installer for hybrid or standalone deployments. Verify each
          file's SHA-256 checksum before installation.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-500">
          <FileArchive className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          No installers are available to your account yet.
          <div className="text-xs mt-2">If you expected to see one, contact your administrator.</div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((it) => (
            <div key={it.id} className="bg-white rounded-xl shadow-sm border p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">{it.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">v{it.version} · {it.platform} · {it.kind}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${CHANNEL_BADGE[it.channel] || 'bg-gray-100'}`}>
                  {it.channel}
                </span>
              </div>

              {it.releaseNotes && (
                <p className="text-sm text-gray-600 mt-3 whitespace-pre-line line-clamp-4">{it.releaseNotes}</p>
              )}

              <div className="mt-4 text-xs text-gray-500 space-y-1">
                <div><span className="font-medium">Size:</span> {fmtSize(it.sizeBytes)}</div>
                <div className="font-mono break-all">SHA-256: {it.sha256}</div>
                <div><span className="font-medium">Released:</span> {new Date(it.releasedAt).toLocaleDateString()}</div>
                {it.minLicenseTier && (
                  <div className="flex items-center gap-1 text-amber-700"><Lock className="w-3 h-3" /> Requires {it.minLicenseTier} plan</div>
                )}
              </div>

              <a
                href={href(it.id)}
                className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                <Download className="w-4 h-4" /> Download {it.filename}
              </a>
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <strong>Verifying your download (Linux/macOS):</strong>
        <pre className="mt-2 text-xs bg-white rounded p-2 overflow-x-auto">sha256sum &lt;filename&gt;
# compare against the SHA-256 listed above</pre>
      </div>
    </div>
  );
}
