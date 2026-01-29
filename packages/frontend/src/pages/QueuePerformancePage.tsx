import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Clock,
  Users,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { queueService } from '../services/queue';
import type { QueueStats } from '../services/queue';

export default function QueuePerformancePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await queueService.getStats();
        setStats(data);
      } catch (err) {
        setError('Failed to load queue performance data');
        console.error('Error fetching queue stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const getWaitTimeColor = (wait: number) => {
    if (wait <= 10) return 'text-green-600';
    if (wait <= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const hasData = stats && (stats.waiting > 0 || stats.inService > 0 || stats.completed > 0);
  const servicePoints = stats?.byServicePoint ? Object.entries(stats.byServicePoint) : [];

  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading performance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium mb-2">Error Loading Data</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Queue Performance</h1>
                <p className="text-gray-500 text-sm">Wait times and service efficiency</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-medium mb-2">No Performance Data</p>
            <p className="text-gray-500 text-sm">Queue activity will appear here once patients are processed.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Queue Performance</h1>
              <p className="text-gray-500 text-sm">Wait times and service efficiency</p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-4 flex-shrink-0">
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <p className={`text-3xl font-bold ${getWaitTimeColor(stats.avgWaitTime)}`}>
            {stats.avgWaitTime}m
          </p>
          <p className="text-sm text-gray-500 mt-1">Avg Wait Time</p>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Users className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-3xl font-bold text-yellow-600">{stats.waiting}</p>
          <p className="text-sm text-gray-500 mt-1">Waiting</p>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats.inService}</p>
          <p className="text-sm text-gray-500 mt-1">In Service</p>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-sm text-gray-500 mt-1">Completed</p>
        </div>
      </div>

      {/* Service Points Breakdown */}
      {servicePoints.length > 0 && (
        <div className="card p-4 flex-1 min-h-0 overflow-hidden">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">By Service Point</h2>
          <div className="overflow-y-auto h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {servicePoints.map(([servicePoint, data]) => (
                <div key={servicePoint} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium capitalize">
                      {servicePoint.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-yellow-500" />
                      {data.waiting} waiting
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="w-3 h-3 text-blue-500" />
                      {data.inService} in service
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
