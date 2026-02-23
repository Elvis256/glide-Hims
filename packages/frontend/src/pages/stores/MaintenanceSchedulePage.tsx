import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Wrench,
  Search,
  Plus,
  Filter,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Building2,
  User,
  FileText,
  Eye,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import assetsService from '../../services/assets';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';

export default function MaintenanceSchedulePage() {
  const facilityId = useFacilityId();
  const [activeTab, setActiveTab] = useState<'calendar' | 'workorders' | 'history'>('workorders');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: maintenanceDue = [], isLoading: dueLoading } = useQuery({
    queryKey: ['maintenance-due', facilityId],
    queryFn: () => assetsService.getMaintenanceDue(facilityId, 90),
    enabled: !!facilityId,
    staleTime: 60000,
  });

  const { data: maintenanceHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['maintenance-history-all', facilityId],
    queryFn: async () => {
      const assets = await assetsService.list(facilityId);
      const histories = await Promise.all(
        assets.slice(0, 10).map(a => assetsService.getMaintenanceHistory(a.id).catch(() => [] as typeof maintenanceHistory))
      );
      return histories.flat();
    },
    enabled: !!facilityId && activeTab === 'history',
    staleTime: 120000,
  });

  const filteredDue = useMemo(() => {
    return maintenanceDue.filter((asset) => {
      const matchesSearch =
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.assetCode.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [searchTerm, maintenanceDue]);

  const filteredHistory = useMemo(() => {
    return maintenanceHistory.filter((record) => {
      const matchesSearch =
        (record.assetId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (record.type || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [searchTerm, maintenanceHistory]);

  const now = new Date();
  const overdue = maintenanceDue.filter(a => a.nextMaintenanceDate && new Date(a.nextMaintenanceDate) < now);
  const dueSoon = maintenanceDue.filter(a => {
    if (!a.nextMaintenanceDate) return false;
    const d = new Date(a.nextMaintenanceDate);
    return d >= now;
  });

  const stats = {
    scheduled: maintenanceDue.length,
    inProgress: 0,
    overdue: overdue.length,
    completedMTD: maintenanceHistory.filter(h => {
      const d = new Date(h.maintenanceDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Schedule</h1>
          <p className="text-gray-600">Equipment maintenance and service management</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Scheduled</p>
              <p className="text-2xl font-bold text-blue-700">{stats.scheduled}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600">In Progress</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.inProgress}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">Overdue</p>
              <p className="text-2xl font-bold text-red-700">{stats.overdue}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Completed (MTD)</p>
              <p className="text-2xl font-bold text-green-700">{stats.completedMTD}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-4">
        <button
          onClick={() => setActiveTab('workorders')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'workorders' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Work Orders
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          PM Calendar
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          History
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search work orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="in-progress">In Progress</option>
          <option value="overdue">Overdue</option>
          <option value="completed">Completed</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
        {activeTab === 'workorders' && (
          <div className="overflow-auto flex-1">
            {dueLoading ? (
              <div className="flex-1 flex items-center justify-center h-full py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : filteredDue.length === 0 ? (
              <div className="flex-1 flex items-center justify-center h-full text-gray-500">
                <div className="text-center py-12">
                  <Wrench className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-medium">No Maintenance Due</p>
                  <p className="text-sm">Assets requiring maintenance will appear here</p>
                </div>
              </div>
            ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Asset</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Code</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Next Maintenance</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Location</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredDue.map((asset) => {
                  const isOverdue = asset.nextMaintenanceDate && new Date(asset.nextMaintenanceDate) < now;
                  return (
                    <tr key={asset.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{asset.name}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-blue-600 text-sm">{asset.assetCode}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600 capitalize">{asset.category.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Calendar className="w-3 h-3" />
                          {asset.nextMaintenanceDate ? new Date(asset.nextMaintenanceDate).toLocaleDateString() : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Building2 className="w-3 h-3" />
                          {asset.location || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isOverdue ? (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
                            <AlertCircle className="w-3 h-3" />
                            Overdue
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
                            <Clock className="w-3 h-3" />
                            Due Soon
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button className="p-1 hover:bg-gray-100 rounded" title="View">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="overflow-auto flex-1">
            <div className="p-4">
              <h3 className="font-medium text-gray-900 mb-4">Upcoming Maintenance Due (Next 90 Days)</h3>
              {dueLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
              ) : maintenanceDue.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-medium">No Maintenance Scheduled</p>
                  <p className="text-sm">Add maintenance schedules to assets to view here</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Asset</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Category</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Next Due</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Location</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {maintenanceDue.map((asset) => {
                      const isOverdue = asset.nextMaintenanceDate && new Date(asset.nextMaintenanceDate) < now;
                      return (
                        <tr key={asset.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{asset.name}</p>
                            <p className="text-sm text-gray-500">{asset.assetCode}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-600 capitalize">{asset.category.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-gray-900 font-medium">
                            {asset.nextMaintenanceDate ? new Date(asset.nextMaintenanceDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{asset.location || '—'}</td>
                          <td className="px-4 py-3">
                            {isOverdue ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Overdue</span>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Due Soon</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="overflow-auto flex-1">
            {historyLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex-1 flex items-center justify-center h-full text-gray-500">
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-medium">No Maintenance History</p>
                  <p className="text-sm">Completed maintenance records will appear here</p>
                </div>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Asset ID</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cost</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Performed By</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredHistory.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{record.assetId}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-full capitalize bg-blue-100 text-blue-700">{record.type}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{new Date(record.maintenanceDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{record.cost ? formatCurrency(record.cost) : '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {record.performedBy || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{record.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          {activeTab === 'workorders' && `Showing ${filteredDue.length} assets requiring maintenance`}
          {activeTab === 'calendar' && `${maintenanceDue.length} assets with upcoming maintenance`}
          {activeTab === 'history' && `${filteredHistory.length} maintenance records`}
        </div>
      </div>
    </div>
  );
}
