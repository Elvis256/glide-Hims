import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Search,
  Filter,
  Calendar,
  User,
  LogIn,
  LogOut,
  Edit,
  Eye,
  Trash2,
  Download,
  ChevronDown,
  Check,
  Globe,
  Clock,
  FileText,
  AlertTriangle,
  Shield,
  Loader2,
} from 'lucide-react';
import { usersService, type ActivityLog as APIActivityLog } from '../../../services';

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: 'login' | 'logout' | 'view' | 'create' | 'update' | 'delete' | 'export' | 'permission_change';
  description: string;
  module: string;
  ipAddress: string;
  timestamp: string;
  details?: string;
}

const actionTypes = ['All Actions', 'login', 'logout', 'view', 'create', 'update', 'delete', 'export', 'permission_change'];
const moduleTypes = ['All Modules', 'Authentication', 'Patients', 'Vitals', 'Security', 'Pharmacy', 'Laboratory', 'Reports', 'Users'];

export default function UserActivityLogPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('All Actions');
  const [selectedModule, setSelectedModule] = useState('All Modules');
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [showModuleDropdown, setShowModuleDropdown] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  // Fetch activity logs from API
  const { data: apiLogs, isLoading } = useQuery({
    queryKey: ['activity-logs', selectedAction, selectedModule, dateFrom, dateTo],
    queryFn: () => usersService.activityLogs.list({
      action: selectedAction !== 'All Actions' ? selectedAction : undefined,
      module: selectedModule !== 'All Modules' ? selectedModule : undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    }),
    staleTime: 30000,
  });

  // Transform API data with fallback
  const activityLogs: ActivityLog[] = useMemo(() => {
    if (!apiLogs) return [];
    return apiLogs.map((l: APIActivityLog) => ({
      id: l.id,
      userId: l.userId,
      userName: l.userName,
      userRole: l.userRole || 'User',
      action: l.action as ActivityLog['action'],
      description: l.description,
      module: l.module,
      ipAddress: l.ipAddress || 'N/A',
      timestamp: l.timestamp,
      details: l.details,
    }));
  }, [apiLogs]);

  const filteredLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      const matchesSearch =
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.ipAddress.includes(searchTerm);
      return matchesSearch;
    });
  }, [activityLogs, searchTerm]);

  const getActionIcon = (action: ActivityLog['action']) => {
    const icons = {
      login: <LogIn className="w-4 h-4" />,
      logout: <LogOut className="w-4 h-4" />,
      view: <Eye className="w-4 h-4" />,
      create: <FileText className="w-4 h-4" />,
      update: <Edit className="w-4 h-4" />,
      delete: <Trash2 className="w-4 h-4" />,
      export: <Download className="w-4 h-4" />,
      permission_change: <Shield className="w-4 h-4" />,
    };
    return icons[action];
  };

  const getActionBadge = (action: ActivityLog['action']) => {
    const styles = {
      login: 'bg-green-100 text-green-700',
      logout: 'bg-gray-100 text-gray-700',
      view: 'bg-blue-100 text-blue-700',
      create: 'bg-emerald-100 text-emerald-700',
      update: 'bg-yellow-100 text-yellow-700',
      delete: 'bg-red-100 text-red-700',
      export: 'bg-purple-100 text-purple-700',
      permission_change: 'bg-orange-100 text-orange-700',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[action]}`}>
        {getActionIcon(action)}
        {action.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Activity className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Activity Log</h1>
            <p className="text-sm text-gray-500">Monitor user actions and system events</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50">
          <Download className="w-4 h-4" />
          Export Logs
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by user, action, or IP address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Action Filter */}
        <div className="relative">
          <button
            onClick={() => { setShowActionDropdown(!showActionDropdown); setShowModuleDropdown(false); }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
          >
            <Activity className="w-4 h-4 text-gray-500" />
            <span className="text-sm">{selectedAction}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {showActionDropdown && (
            <div className="absolute top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {actionTypes.map((action) => (
                <button
                  key={action}
                  onClick={() => { setSelectedAction(action); setShowActionDropdown(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                >
                  {action.replace('_', ' ')}
                  {selectedAction === action && <Check className="w-4 h-4 text-orange-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Module Filter */}
        <div className="relative">
          <button
            onClick={() => { setShowModuleDropdown(!showModuleDropdown); setShowActionDropdown(false); }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
          >
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm">{selectedModule}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {showModuleDropdown && (
            <div className="absolute top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {moduleTypes.map((module) => (
                <button
                  key={module}
                  onClick={() => { setSelectedModule(module); setShowModuleDropdown(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                >
                  {module}
                  {selectedModule === module && <Check className="w-4 h-4 text-orange-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Total Events</span>
            <Activity className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activityLogs.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Logins Today</span>
            <LogIn className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activityLogs.filter(l => l.action === 'login').length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Data Changes</span>
            <Edit className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activityLogs.filter(l => ['create', 'update', 'delete'].includes(l.action)).length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Security Events</span>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activityLogs.filter(l => l.action === 'permission_change').length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
              <span className="ml-2 text-gray-600">Loading activity logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Activity className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-lg font-medium">No activity logs found</p>
              <p className="text-sm">Activity logs will appear here once user actions are recorded.</p>
            </div>
          ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Module</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{log.timestamp}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{log.userName}</p>
                        <p className="text-xs text-gray-500">{log.userRole}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{getActionBadge(log.action)}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900">{log.description}</p>
                    {log.details && <p className="text-xs text-gray-500">{log.details}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{log.module}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 font-mono">{log.ipAddress}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Showing {filteredLogs.length} of {activityLogs.length} events
          </span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-100">Previous</button>
            <button className="px-3 py-1 text-sm bg-orange-600 text-white rounded">1</button>
            <button className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-100">2</button>
            <button className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-100">Next</button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Activity Details</h3>
              <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{selectedLog.userName}</p>
                  <p className="text-sm text-gray-500">{selectedLog.userRole}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Action</p>
                  <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Module</p>
                  <p className="mt-1 text-sm font-medium">{selectedLog.module}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Timestamp</p>
                  <p className="mt-1 text-sm font-medium">{selectedLog.timestamp}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">IP Address</p>
                  <p className="mt-1 text-sm font-mono">{selectedLog.ipAddress}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Description</p>
                <p className="mt-1 text-sm">{selectedLog.description}</p>
              </div>
              {selectedLog.details && (
                <div>
                  <p className="text-xs text-gray-500 uppercase">Details</p>
                  <p className="mt-1 text-sm bg-gray-50 p-2 rounded font-mono">{selectedLog.details}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
