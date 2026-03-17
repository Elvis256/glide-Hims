import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Clock,
  Shield,
  Trash2,
  RotateCcw,
  Calendar,
  Package,
  Search,
  CheckCircle,
} from 'lucide-react';
import { pharmacyService, ExpiringItem, ExpiryAlertRecord } from '../../services/pharmacy';

type TabId = 'near-expiry' | 'quarantined' | 'processed';

const TABS: { id: TabId; label: string; icon: typeof Clock }[] = [
  { id: 'near-expiry', label: 'Near-Expiry Items', icon: Clock },
  { id: 'quarantined', label: 'Quarantined', icon: Shield },
  { id: 'processed', label: 'Processed History', icon: CheckCircle },
];

function getExpiryColor(daysUntilExpiry: number): string {
  if (daysUntilExpiry < 30) return 'bg-red-100 text-red-800';
  if (daysUntilExpiry < 60) return 'bg-orange-100 text-orange-800';
  return 'bg-yellow-100 text-yellow-800';
}

function getExpiryBadgeColor(daysUntilExpiry: number): string {
  if (daysUntilExpiry < 30) return 'bg-red-600';
  if (daysUntilExpiry < 60) return 'bg-orange-500';
  return 'bg-yellow-500';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ExpiryManagementPage() {
  const [activeTab, setActiveTab] = useState<TabId>('near-expiry');
  const [daysThreshold, setDaysThreshold] = useState(90);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  // Near-expiry items from stock ledger
  const { data: expiringItems = [], isLoading: loadingExpiring } = useQuery({
    queryKey: ['expiry-alerts', daysThreshold],
    queryFn: () => pharmacyService.expiry.getAlerts(daysThreshold),
  });

  // Full expiry report
  const { data: report, isLoading: loadingReport } = useQuery({
    queryKey: ['expiry-report'],
    queryFn: () => pharmacyService.expiry.getReport(),
  });

  // Quarantine mutation
  const quarantineMutation = useMutation({
    mutationFn: (data: { itemId: string; batchNumber?: string; notes?: string }) =>
      pharmacyService.expiry.quarantine(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expiry-report'] });
      queryClient.invalidateQueries({ queryKey: ['expiry-alerts'] });
      toast.success('Item quarantined successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to quarantine item'),
  });

  // Process (dispose/return) mutation
  const processMutation = useMutation({
    mutationFn: (data: { itemId: string; action: 'dispose' | 'return'; batchNumber?: string; notes?: string }) =>
      pharmacyService.expiry.process(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expiry-report'] });
      toast.success(
        variables.action === 'dispose' ? 'Item disposed successfully' : 'Item marked for return',
      );
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to process item'),
  });

  // Filtered near-expiry items
  const filteredExpiring = useMemo(() => {
    if (!searchTerm) return expiringItems;
    const term = searchTerm.toLowerCase();
    return expiringItems.filter(
      (item: ExpiringItem) =>
        item.itemName.toLowerCase().includes(term) ||
        item.itemCode.toLowerCase().includes(term) ||
        (item.batchNumber && item.batchNumber.toLowerCase().includes(term)),
    );
  }, [expiringItems, searchTerm]);

  const filteredQuarantined = useMemo(() => {
    const items = report?.quarantined || [];
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(
      (a: ExpiryAlertRecord) =>
        a.item?.name?.toLowerCase().includes(term) ||
        a.item?.code?.toLowerCase().includes(term) ||
        a.batchNumber?.toLowerCase().includes(term),
    );
  }, [report?.quarantined, searchTerm]);

  const processedItems = useMemo(() => {
    const disposed = report?.disposed || [];
    const returned = report?.returned || [];
    const all = [...disposed, ...returned].sort(
      (a, b) => new Date(b.actionDate || b.createdAt).getTime() - new Date(a.actionDate || a.createdAt).getTime(),
    );
    if (!searchTerm) return all;
    const term = searchTerm.toLowerCase();
    return all.filter(
      (a: ExpiryAlertRecord) =>
        a.item?.name?.toLowerCase().includes(term) ||
        a.item?.code?.toLowerCase().includes(term) ||
        a.batchNumber?.toLowerCase().includes(term),
    );
  }, [report?.disposed, report?.returned, searchTerm]);

  const isLoading = loadingExpiring || loadingReport;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expiry Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track, quarantine, and process near-expiry and expired items
          </p>
        </div>
        {report && (
          <div className="flex gap-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-center">
              <div className="text-lg font-bold text-yellow-700">{report.summary.nearExpiryCount}</div>
              <div className="text-xs text-yellow-600">Near Expiry</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-center">
              <div className="text-lg font-bold text-orange-700">{report.summary.quarantinedCount}</div>
              <div className="text-xs text-orange-600">Quarantined</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-center">
              <div className="text-lg font-bold text-gray-700">
                {report.summary.disposedCount + report.summary.returnedCount}
              </div>
              <div className="text-xs text-gray-600">Processed</div>
            </div>
          </div>
        )}
      </div>

      {/* Search + Threshold Controls */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by item name, code, or batch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        {activeTab === 'near-expiry' && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <label className="text-sm text-gray-600">Expiry within:</label>
            <select
              value={daysThreshold}
              onChange={(e) => setDaysThreshold(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
              <option value={365}>1 year</option>
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.id === 'near-expiry' && expiringItems.length > 0 && (
                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  {expiringItems.length}
                </span>
              )}
              {tab.id === 'quarantined' && (report?.summary.quarantinedCount || 0) > 0 && (
                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  {report?.summary.quarantinedCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Loading expiry data...</p>
        </div>
      ) : (
        <>
          {/* Tab 1: Near-Expiry Items */}
          {activeTab === 'near-expiry' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {filteredExpiring.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="h-12 w-12 text-gray-300 mx-auto" />
                  <p className="mt-2 text-sm text-gray-500">No items expiring within {daysThreshold} days</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Days Left</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredExpiring.map((item: ExpiringItem, idx: number) => (
                      <tr key={`${item.itemId}-${item.batchNumber}-${idx}`} className={getExpiryColor(item.daysUntilExpiry).replace('text-', 'bg-').split(' ')[0].replace('bg-red-100', 'bg-red-50').replace('bg-orange-100', 'bg-orange-50').replace('bg-yellow-100', 'bg-yellow-50')}>
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-sm font-medium text-gray-900">{item.itemName}</span>
                            {item.genericName && (
                              <span className="block text-xs text-gray-500">{item.genericName}</span>
                            )}
                            <span className="block text-xs text-gray-400">{item.itemCode}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.batchNumber || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.expiryDate)}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getExpiryBadgeColor(item.daysUntilExpiry)}`}
                          >
                            {item.daysUntilExpiry}d
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() =>
                              quarantineMutation.mutate({
                                itemId: item.itemId,
                                batchNumber: item.batchNumber,
                              })
                            }
                            disabled={quarantineMutation.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded-md hover:bg-orange-200 transition-colors disabled:opacity-50"
                          >
                            <Shield className="h-3 w-3" />
                            Quarantine
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Tab 2: Quarantined Items */}
          {activeTab === 'quarantined' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {filteredQuarantined.length === 0 ? (
                <div className="p-8 text-center">
                  <Shield className="h-12 w-12 text-gray-300 mx-auto" />
                  <p className="mt-2 text-sm text-gray-500">No quarantined items</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quarantined At</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredQuarantined.map((alert: ExpiryAlertRecord) => (
                      <tr key={alert.id} className="bg-orange-50">
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-sm font-medium text-gray-900">{alert.item?.name || '—'}</span>
                            {alert.item?.genericName && (
                              <span className="block text-xs text-gray-500">{alert.item.genericName}</span>
                            )}
                            <span className="block text-xs text-gray-400">{alert.item?.code}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{alert.batchNumber || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(alert.expiryDate)}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{alert.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {alert.actionDate ? formatDate(alert.actionDate) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                processMutation.mutate({
                                  itemId: alert.itemId,
                                  action: 'dispose',
                                  batchNumber: alert.batchNumber,
                                })
                              }
                              disabled={processMutation.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              Dispose
                            </button>
                            <button
                              onClick={() =>
                                processMutation.mutate({
                                  itemId: alert.itemId,
                                  action: 'return',
                                  batchNumber: alert.batchNumber,
                                })
                              }
                              disabled={processMutation.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Return
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Tab 3: Processed Items History */}
          {activeTab === 'processed' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {processedItems.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 text-gray-300 mx-auto" />
                  <p className="mt-2 text-sm text-gray-500">No processed items yet</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed At</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {processedItems.map((alert: ExpiryAlertRecord) => (
                      <tr key={alert.id}>
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-sm font-medium text-gray-900">{alert.item?.name || '—'}</span>
                            <span className="block text-xs text-gray-400">{alert.item?.code}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{alert.batchNumber || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(alert.expiryDate)}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{alert.quantity}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              alert.status === 'disposed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {alert.status === 'disposed' ? 'Disposed' : 'Returned'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {alert.actionDate ? formatDate(alert.actionDate) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                          {alert.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
