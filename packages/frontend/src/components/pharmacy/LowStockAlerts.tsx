import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronUp, ShoppingCart, Package } from 'lucide-react';
import { pharmacyService, LowStockAlert } from '../../services/pharmacy';

export default function LowStockAlerts() {
  const [expanded, setExpanded] = useState(false);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['low-stock-alerts'],
    queryFn: () => pharmacyService.alerts.getLowStock(),
    refetchInterval: 60000,
  });

  const criticalCount = alerts.filter((a) => a.currentQuantity === 0).length;
  const warningCount = alerts.length - criticalCount;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48" />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
        <Package className="h-5 w-5 text-green-500" />
        <span className="text-sm text-gray-600">All stock levels are healthy</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <span className="font-medium text-gray-900">Low Stock Alerts</span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            {alerts.length}
          </span>
          {criticalCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">
              {criticalCount} out of stock
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              {warningCount} low
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {/* Expandable list */}
      {expanded && (
        <div className="border-t border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reorder Level</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deficit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {alerts.map((alert: LowStockAlert) => {
                  const isOutOfStock = alert.currentQuantity === 0;
                  const rowColor = isOutOfStock ? 'bg-red-50' : 'bg-orange-50';

                  return (
                    <tr key={alert.item.id} className={rowColor}>
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{alert.item.name}</span>
                          {alert.item.genericName && (
                            <span className="block text-xs text-gray-500">{alert.item.genericName}</span>
                          )}
                          <span className="block text-xs text-gray-400">{alert.item.code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-sm font-semibold ${
                            isOutOfStock ? 'text-red-600' : 'text-orange-600'
                          }`}
                        >
                          {alert.currentQuantity} {alert.item.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {alert.reorderLevel} {alert.item.unit}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-red-600">
                          −{alert.deficit} {alert.item.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href="/pharmacy/requisitions"
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                        >
                          <ShoppingCart className="h-3 w-3" />
                          Reorder
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
