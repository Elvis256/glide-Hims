import React, { useEffect, useState } from 'react';
import { TrendingUp, Zap } from 'lucide-react';

interface PerformanceMetrics {
  avgQueryTime: number;
  cacheHitRate: number;
  indexHealth: number;
  tableFragmentation: number;
  recommendationsCount: number;
}

export const PerformanceMetricsWidget: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    avgQueryTime: 0,
    cacheHitRate: 0,
    indexHealth: 0,
    tableFragmentation: 0,
    recommendationsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPerformanceMetrics = async () => {
      try {
        const response = await fetch('/api/finance/performance/metrics');
        if (response.ok) {
          const data = await response.json();
          setMetrics({
            avgQueryTime: data.averageQueryTimeMs || 0,
            cacheHitRate: data.cacheHitRate || 0,
            indexHealth: data.indexHealthScore || 0,
            tableFragmentation: data.fragmentationPercentage || 0,
            recommendationsCount: data.optimizationCount || 0,
          });
        }
      } catch (error) {
        console.error('Failed to fetch performance metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformanceMetrics();
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Performance Metrics</h3>
        <Zap className="w-6 h-6 text-yellow-500" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Avg Query Time</span>
            <div className="text-right">
              <p className="font-bold">{metrics.avgQueryTime.toFixed(2)}ms</p>
              <p className="text-xs text-gray-500">Target: &lt;50ms</p>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Cache Hit Rate</span>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${Math.min(metrics.cacheHitRate, 100)}%` }}
                />
              </div>
              <p className="font-bold w-12 text-right">{metrics.cacheHitRate.toFixed(1)}%</p>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Index Health</span>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${Math.min(metrics.indexHealth, 100)}%` }}
                />
              </div>
              <p className="font-bold w-12 text-right">{metrics.indexHealth.toFixed(1)}%</p>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Fragmentation</span>
            <p className={`font-bold ${metrics.tableFragmentation > 30 ? 'text-red-600' : 'text-green-600'}`}>
              {metrics.tableFragmentation.toFixed(1)}%
            </p>
          </div>

          {metrics.recommendationsCount > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {metrics.recommendationsCount} optimization recommendations available
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
