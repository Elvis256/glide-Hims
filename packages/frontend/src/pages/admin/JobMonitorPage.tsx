import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface JobInfo {
  name: string;
  type: string;
  running?: boolean;
  cronTime?: string;
  nextRun?: string | null;
  lastRun?: string | null;
}

interface JobMonitorResponse {
  cronJobs: JobInfo[];
  intervals: JobInfo[];
  timeouts: JobInfo[];
  total: number;
}

export default function JobMonitorPage() {
  const [data, setData] = useState<JobMonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<JobMonitorResponse>('/admin/jobs');
      setData(res.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4 items-center">
        <div>
          <h1 className="text-2xl font-bold">Background Jobs</h1>
          <p className="text-sm text-gray-600">
            Cron, interval, and timeout schedules currently registered.
          </p>
        </div>
        <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded">
          Refresh
        </button>
      </div>
      {loading && !data ? (
        <p>Loading...</p>
      ) : !data ? (
        <p className="text-red-600">Failed to load.</p>
      ) : (
        <>
          <p className="text-sm text-gray-700 mb-3">
            Total scheduled jobs: <strong>{data.total}</strong>
          </p>
          <div className="bg-white rounded shadow overflow-x-auto mb-6">
            <h3 className="p-3 font-semibold border-b">Cron Jobs ({data.cronJobs.length})</h3>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Schedule</th>
                  <th className="text-left p-3">Running</th>
                  <th className="text-left p-3">Last Run</th>
                  <th className="text-left p-3">Next Run</th>
                </tr>
              </thead>
              <tbody>
                {data.cronJobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-500">
                      No cron jobs registered.
                    </td>
                  </tr>
                ) : (
                  data.cronJobs.map((j) => (
                    <tr key={j.name} className="border-b">
                      <td className="p-3 font-mono">{j.name}</td>
                      <td className="p-3 font-mono text-gray-600">{j.cronTime}</td>
                      <td className="p-3">{j.running ? '✅' : '⏸'}</td>
                      <td className="p-3 text-gray-600">
                        {j.lastRun ? new Date(j.lastRun).toLocaleString() : '—'}
                      </td>
                      <td className="p-3 text-gray-600">
                        {j.nextRun ? new Date(j.nextRun).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.intervals.length > 0 && (
            <div className="bg-white rounded shadow mb-6">
              <h3 className="p-3 font-semibold border-b">Intervals ({data.intervals.length})</h3>
              <ul className="p-3 list-disc pl-8 text-sm">
                {data.intervals.map((j) => (
                  <li key={j.name}>{j.name}</li>
                ))}
              </ul>
            </div>
          )}

          {data.timeouts.length > 0 && (
            <div className="bg-white rounded shadow">
              <h3 className="p-3 font-semibold border-b">Timeouts ({data.timeouts.length})</h3>
              <ul className="p-3 list-disc pl-8 text-sm">
                {data.timeouts.map((j) => (
                  <li key={j.name}>{j.name}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
