import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Bed as BedIcon, Calendar, BarChart3 } from 'lucide-react';
import { ipdService } from '../../services/ipd';
import { getFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';

type BedNode = {
  id: string;
  number: string;
  type: string;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance' | 'cleaning';
  dailyRate: number;
  reservation: { until: string; reason: string } | null;
  currentPatient: {
    admissionId: string;
    patientId: string;
    name?: string;
    mrn?: string;
    admittedAt: string;
    losHours: number;
    attendingDoctor: string | null;
  } | null;
};

type WardNode = {
  ward: {
    id: string;
    name: string;
    code: string;
    totalBeds: number;
    occupied: number;
    available: number;
    reserved: number;
    maintenance: number;
  };
  beds: BedNode[];
};

const STATUS_STYLE: Record<string, string> = {
  available: 'bg-emerald-100 border-emerald-400 text-emerald-900',
  occupied: 'bg-rose-100 border-rose-400 text-rose-900',
  reserved: 'bg-amber-100 border-amber-400 text-amber-900',
  maintenance: 'bg-slate-200 border-slate-400 text-slate-700',
  cleaning: 'bg-sky-100 border-sky-400 text-sky-900',
};

export default function BedBoardPage() {
  const facilityId = getFacilityId();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tab, setTab] = useState<'board' | 'census'>('board');
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const [dateFrom, setDateFrom] = useState(monthAgo);
  const [dateTo, setDateTo] = useState(today);

  const board = useQuery<WardNode[]>({
    queryKey: ['bed-board', facilityId],
    queryFn: () => ipdService.bedBoard(facilityId!),
    enabled: !!facilityId,
    refetchInterval: autoRefresh ? 30_000 : false,
  });

  const census = useQuery({
    queryKey: ['ipd-census', facilityId, dateFrom, dateTo],
    queryFn: () => ipdService.census(facilityId!, dateFrom, dateTo),
    enabled: !!facilityId && tab === 'census',
  });

  useEffect(() => {
    if (board.error) toast.error('Failed to load bed-board');
  }, [board.error]);

  const totals = useMemo(() => {
    const w = board.data ?? [];
    return w.reduce(
      (a, w) => ({
        beds: a.beds + w.ward.totalBeds,
        occupied: a.occupied + w.ward.occupied,
        available: a.available + w.ward.available,
        reserved: a.reserved + w.ward.reserved,
      }),
      { beds: 0, occupied: 0, available: 0, reserved: 0 },
    );
  }, [board.data]);

  const occupancyPct = totals.beds ? Math.round((totals.occupied / totals.beds) * 100) : 0;

  const handleReserve = async (bedId: string) => {
    const reason = prompt('Reservation reason (e.g. elective admission Mr. X)?');
    if (!reason) return;
    try {
      await ipdService.reserveBed(bedId, 4, reason);
      toast.success('Bed reserved (4-hour hold)');
      board.refetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not reserve');
    }
  };

  const handleRelease = async (bedId: string) => {
    try {
      await ipdService.releaseReservation(bedId);
      toast.success('Reservation released');
      board.refetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not release');
    }
  };

  if (!facilityId) {
    return <div className="p-6 text-gray-500">No facility selected.</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BedIcon className="w-6 h-6 text-blue-600" />
            Bed-Board &amp; Census
          </h1>
          <p className="text-sm text-gray-500">
            {totals.beds} beds · {totals.occupied} occupied ({occupancyPct}%) · {totals.available} free ·{' '}
            {totals.reserved} reserved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh 30s
          </label>
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => board.refetch()}
            disabled={board.isFetching}
          >
            {board.isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </button>
        </div>
      </div>

      <div className="flex border-b">
        <button
          onClick={() => setTab('board')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            tab === 'board'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BedIcon className="w-4 h-4 inline mr-1" /> Board
        </button>
        <button
          onClick={() => setTab('census')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            tab === 'census'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-1" /> Census
        </button>
      </div>

      {tab === 'board' && (
        <>
          <Legend />
          {board.isLoading && <div className="text-gray-500">Loading wards…</div>}
          {board.data?.length === 0 && (
            <div className="card p-6 text-center text-gray-500">No wards configured.</div>
          )}
          <div className="space-y-4">
            {board.data?.map((ward) => (
              <div key={ward.ward.id} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">
                    {ward.ward.name}{' '}
                    {ward.ward.code && <span className="text-gray-400 text-xs">({ward.ward.code})</span>}
                  </h2>
                  <span className="text-xs text-gray-500">
                    {ward.ward.occupied}/{ward.ward.totalBeds} occupied
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {ward.beds.map((bed) => (
                    <BedTile
                      key={bed.id}
                      bed={bed}
                      onReserve={() => handleReserve(bed.id)}
                      onRelease={() => handleRelease(bed.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'census' && (
        <div className="space-y-4">
          <div className="flex items-end gap-3 flex-wrap">
            <label className="flex flex-col text-xs">
              <span className="text-gray-500">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input"
              />
            </label>
            <label className="flex flex-col text-xs">
              <span className="text-gray-500">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input"
              />
            </label>
            <button onClick={() => census.refetch()} className="btn-primary flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Run Report
            </button>
          </div>

          {census.isLoading && <div>Loading…</div>}
          {census.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard label="Total Beds" value={census.data.totalBeds} />
                <KpiCard label="Discharges" value={census.data.discharges} />
                <KpiCard label="ALOS (days)" value={census.data.alosDays} />
                <KpiCard label="Avg Daily Census" value={census.data.avgDailyCensus} />
                <KpiCard label="Avg Occupancy" value={`${census.data.avgOccupancyPct}%`} />
              </div>
              <div className="card p-4">
                <h3 className="font-semibold mb-2">Daily Occupancy (mid-day census)</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Occupied</th>
                        <th className="px-3 py-2">Occupancy %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {census.data.daily.map((d: any) => (
                        <tr key={d.date} className="border-t">
                          <td className="px-3 py-1.5">{d.date}</td>
                          <td className="px-3 py-1.5">{d.occupied}</td>
                          <td className="px-3 py-1.5">{d.occupancyPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {(['available', 'occupied', 'reserved', 'cleaning', 'maintenance'] as const).map((s) => (
        <span key={s} className={`px-2 py-1 rounded border ${STATUS_STYLE[s]}`}>
          {s}
        </span>
      ))}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function BedTile({
  bed,
  onReserve,
  onRelease,
}: {
  bed: BedNode;
  onReserve: () => void;
  onRelease: () => void;
}) {
  const cls = STATUS_STYLE[bed.status] || 'bg-gray-100 border-gray-300';
  return (
    <div className={`border rounded-md p-2 ${cls} text-xs flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <strong className="text-sm">#{bed.number}</strong>
        <span className="opacity-70">{bed.type}</span>
      </div>
      {bed.currentPatient ? (
        <>
          <div className="font-medium truncate" title={bed.currentPatient.name}>
            {bed.currentPatient.name}
          </div>
          <div className="opacity-70">
            MRN {bed.currentPatient.mrn} · {Math.round(bed.currentPatient.losHours / 24)}d LOS
          </div>
          {bed.currentPatient.attendingDoctor && (
            <div className="opacity-70 truncate">Dr. {bed.currentPatient.attendingDoctor}</div>
          )}
        </>
      ) : bed.reservation ? (
        <>
          <div className="font-medium">RESERVED</div>
          <div className="opacity-70 truncate" title={bed.reservation.reason}>
            {bed.reservation.reason || '—'}
          </div>
          <div className="opacity-70">
            until {new Date(bed.reservation.until).toLocaleString()}
          </div>
          <button onClick={onRelease} className="text-blue-600 underline self-start">
            Release
          </button>
        </>
      ) : bed.status === 'available' ? (
        <>
          <div className="opacity-70">{formatCurrency(bed.dailyRate)}/day</div>
          <button onClick={onReserve} className="text-blue-600 underline self-start">
            Reserve
          </button>
        </>
      ) : (
        <div className="opacity-70 capitalize">{bed.status}</div>
      )}
    </div>
  );
}
