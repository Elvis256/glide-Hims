import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  Mail,
  MessageSquare,
  Clock,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  User,
  Calendar,
  Filter,
  BellRing,
  Loader2,
} from 'lucide-react';

interface AlertConfig {
  id: string;
  name: string;
  daysBeforeExpiry: number;
  channels: ('email' | 'sms')[];
  recipients: string[];
  isActive: boolean;
  createdAt: string;
}

interface AlertHistory {
  id: string;
  medication: string;
  batch: string;
  daysToExpiry: number;
  sentAt: string;
  channel: 'email' | 'sms';
  recipient: string;
  status: 'sent' | 'snoozed' | 'dismissed';
}

export default function ExpiryAlertsPage() {
  const [alertConfigs, setAlertConfigs] = useState<AlertConfig[]>([]);
  const [selectedHistoryFilter, setSelectedHistoryFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Alert history would come from a real API endpoint
  // Currently showing empty until backend support is added
  const alertHistory: AlertHistory[] = [];
  const isLoading = false;

  const filteredHistory = useMemo(() => {
    if (selectedHistoryFilter === 'all') return alertHistory;
    return alertHistory.filter((h) => h.status === selectedHistoryFilter);
  }, [selectedHistoryFilter, alertHistory]);

  const stats = useMemo(() => {
    const activeConfigs = alertConfigs.filter((c) => c.isActive).length;
    const totalAlerts = alertHistory.length;
    const snoozedCount = alertHistory.filter((h) => h.status === 'snoozed').length;
    const dismissedCount = alertHistory.filter((h) => h.status === 'dismissed').length;
    return { activeConfigs, totalAlerts, snoozedCount, dismissedCount };
  }, [alertConfigs, alertHistory]);

  const toggleAlertActive = (id: string) => {
    setAlertConfigs((prev) =>
      prev.map((config) =>
        config.id === id ? { ...config, isActive: !config.isActive } : config
      )
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return { label: 'Sent', color: 'bg-green-100 text-green-700', icon: Check };
      case 'snoozed':
        return { label: 'Snoozed', color: 'bg-amber-100 text-amber-700', icon: Clock };
      case 'dismissed':
        return { label: 'Dismissed', color: 'bg-gray-100 text-gray-700', icon: X };
      default:
        return { label: 'Unknown', color: 'bg-gray-100 text-gray-700', icon: AlertTriangle };
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-7 h-7 text-blue-500" />
            Expiry Alerts
          </h1>
          <p className="text-gray-600 mt-1">Configure and manage expiry notifications</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Alert Rule
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Rules</p>
              <p className="text-xl font-bold text-gray-900">{stats.activeConfigs}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <BellRing className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Alerts Sent</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalAlerts}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Snoozed</p>
              <p className="text-xl font-bold text-amber-600">{stats.snoozedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <BellOff className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Dismissed</p>
              <p className="text-xl font-bold text-gray-600">{stats.dismissedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Alert Configurations */}
        <div className="w-96 flex flex-col">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            Alert Configuration
          </h2>
          <div className="flex-1 space-y-3 overflow-auto">
            {alertConfigs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <BellOff className="w-12 h-12 mb-3 text-gray-300" />
                <p className="text-sm font-medium">No alert rules configured</p>
                <p className="text-xs text-gray-400 mt-1">Add a rule to start receiving expiry alerts</p>
              </div>
            ) : null}
            {alertConfigs.map((config) => (
              <div
                key={config.id}
                className={`bg-white rounded-xl border shadow-sm p-4 ${
                  config.isActive ? 'border-blue-200' : 'border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{config.name}</h3>
                    <p className="text-sm text-gray-500">
                      Alert {config.daysBeforeExpiry} days before expiry
                    </p>
                  </div>
                  <button
                    onClick={() => toggleAlertActive(config.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.isActive ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-500">Channels:</span>
                  <div className="flex gap-1">
                    {config.channels.includes('email') && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                        <Mail className="w-3 h-3" />
                        Email
                      </span>
                    )}
                    {config.channels.includes('sms') && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                        <MessageSquare className="w-3 h-3" />
                        SMS
                      </span>
                    )}
                  </div>
                </div>
                <div className="mb-3">
                  <span className="text-xs text-gray-500">Recipients:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {config.recipients.map((recipient, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                      >
                        <User className="w-3 h-3" />
                        {recipient}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">
                    Created: {config.createdAt}
                  </span>
                  <div className="flex gap-1">
                    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button className="p-1.5 hover:bg-red-50 rounded transition-colors">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert History */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              Alert History
            </h2>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={selectedHistoryFilter}
                onChange={(e) => setSelectedHistoryFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Alerts</option>
                <option value="sent">Sent</option>
                <option value="snoozed">Snoozed</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </div>

          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Medication</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Days to Expiry</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Sent At</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Channel</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Recipient</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center text-gray-500">
                          <Loader2 className="w-12 h-12 mb-3 text-blue-500 animate-spin" />
                          <p className="text-sm font-medium">Loading alerts...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center text-gray-500">
                          <Bell className="w-12 h-12 mb-3 text-gray-300" />
                          <p className="text-sm font-medium">No expiry alerts</p>
                          <p className="text-xs text-gray-400 mt-1">Alerts will appear here when triggered</p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {filteredHistory.map((alert) => {
                    const statusBadge = getStatusBadge(alert.status);
                    const StatusIcon = statusBadge.icon;
                    return (
                      <tr key={alert.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{alert.medication}</p>
                            <p className="text-sm text-gray-500 font-mono">{alert.batch}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            alert.daysToExpiry <= 30
                              ? 'bg-red-50 text-red-700'
                              : alert.daysToExpiry <= 60
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            {alert.daysToExpiry} days
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{alert.sentAt}</td>
                        <td className="px-4 py-3">
                          {alert.channel === 'email' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                              <Mail className="w-3 h-3" />
                              Email
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                              <MessageSquare className="w-3 h-3" />
                              SMS
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{alert.recipient}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {alert.status === 'sent' && (
                            <div className="flex gap-1">
                              <button className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition-colors">
                                Snooze
                              </button>
                              <button className="px-2 py-1 text-xs bg-gray-50 text-gray-700 rounded hover:bg-gray-100 transition-colors">
                                Dismiss
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add Alert Modal Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Alert Rule</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alert Name</label>
                <input
                  type="text"
                  placeholder="e.g., 30 Day Alert"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Days Before Expiry</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="30">30 Days</option>
                  <option value="60">60 Days</option>
                  <option value="90">90 Days</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notification Channels</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">Email</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <MessageSquare className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">SMS</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipients</label>
                <input
                  type="text"
                  placeholder="Email or phone number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
