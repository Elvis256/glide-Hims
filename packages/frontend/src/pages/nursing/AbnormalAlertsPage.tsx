import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  Bell,
  UserCircle,
  Clock,
  CheckCircle,
  XCircle,
  Thermometer,
  Activity,
  Heart,
  Wind,
  Droplets,
  Filter,
  Eye,
  Loader2,
} from 'lucide-react';
import api from '../../services/api';

interface Alert {
  id: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  vitalType: string;
  value: string;
  normalRange: string;
  severity: 'warning' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  triggeredAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

// Normal ranges for vitals
const normalRanges = {
  temperature: { min: 36.1, max: 37.2, unit: '°C', criticalLow: 35, criticalHigh: 39 },
  pulse: { min: 60, max: 100, unit: 'bpm', criticalLow: 40, criticalHigh: 120 },
  bloodPressureSystolic: { min: 90, max: 140, unit: 'mmHg', criticalLow: 70, criticalHigh: 180 },
  bloodPressureDiastolic: { min: 60, max: 90, unit: 'mmHg', criticalLow: 40, criticalHigh: 110 },
  respiratoryRate: { min: 12, max: 20, unit: '/min', criticalLow: 8, criticalHigh: 30 },
  oxygenSaturation: { min: 95, max: 100, unit: '%', criticalLow: 90, criticalHigh: 100 },
  bloodGlucose: { min: 70, max: 140, unit: 'mg/dL', criticalLow: 50, criticalHigh: 250 },
};

const vitalIcons: Record<string, React.ElementType> = {
  temperature: Thermometer,
  pulse: Activity,
  bpSystolic: Heart,
  respiratoryRate: Wind,
  oxygenSaturation: Droplets,
  bloodGlucose: Droplets,
};

const vitalLabels: Record<string, string> = {
  temperature: 'Temperature',
  pulse: 'Pulse Rate',
  bloodPressureSystolic: 'Blood Pressure',
  respiratoryRate: 'Respiratory Rate',
  oxygenSaturation: 'SpO2',
  bloodGlucose: 'Blood Glucose',
};

export default function AbnormalAlertsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch vitals and generate alerts from abnormal values
  useEffect(() => {
    const fetchVitals = async () => {
      setLoading(true);
      try {
        // Get recent vitals from all patients
        const response = await api.get('/vitals', { params: { limit: 100 } });
        const vitals = response.data?.data || response.data || [];
        
        // Generate alerts from abnormal vitals
        const generatedAlerts: Alert[] = [];
        
        for (const vital of vitals) {
          const patient = vital.encounter?.patient;
          if (!patient) continue;
          
          // Check each vital sign
          const checkVital = (
            type: keyof typeof normalRanges,
            value: number | undefined | null,
            formatValue?: (v: number) => string
          ) => {
            if (value == null) return;
            const range = normalRanges[type];
            const isAbnormal = value < range.min || value > range.max;
            const isCritical = value < range.criticalLow || value > range.criticalHigh;
            
            if (isAbnormal) {
              generatedAlerts.push({
                id: `${vital.id}-${type}`,
                patientId: patient.id,
                patientName: patient.fullName || patient.full_name || 'Unknown',
                patientMrn: patient.mrn,
                vitalType: type,
                value: formatValue ? formatValue(value) : `${value}${range.unit}`,
                normalRange: `${range.min}-${range.max}${range.unit}`,
                severity: isCritical ? 'critical' : 'warning',
                status: 'active',
                triggeredAt: vital.createdAt,
              });
            }
          };
          
          checkVital('temperature', vital.temperature, (v) => `${v}°C`);
          checkVital('pulse', vital.pulse, (v) => `${v} bpm`);
          checkVital('bloodPressureSystolic', vital.bloodPressureSystolic, (v) => 
            `${v}/${vital.bloodPressureDiastolic || 0} mmHg`
          );
          checkVital('respiratoryRate', vital.respiratoryRate, (v) => `${v}/min`);
          checkVital('oxygenSaturation', vital.oxygenSaturation, (v) => `${v}%`);
          checkVital('bloodGlucose', vital.bloodGlucose, (v) => `${v} mg/dL`);
        }
        
        // Sort by date, most recent first
        generatedAlerts.sort((a, b) => 
          new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
        );
        
        setAlerts(generatedAlerts);
      } catch (error) {
        console.error('Failed to fetch vitals:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchVitals();
  }, []);

  const filteredAlerts = alerts.filter((alert) => {
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    return true;
  });

  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status === 'active').length;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleAcknowledge = (alertId: string) => {
    console.log('Acknowledging alert:', alertId);
  };

  const handleResolve = (alertId: string) => {
    console.log('Resolving alert:', alertId);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="relative">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              {activeCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Abnormal Alerts</h1>
              <p className="text-sm text-gray-500">Monitor critical vital sign deviations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Alerts</p>
              <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Critical</p>
              <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Acknowledged</p>
              <p className="text-2xl font-bold text-yellow-600">
                {alerts.filter((a) => a.status === 'acknowledged').length}
              </p>
            </div>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Resolved Today</p>
              <p className="text-2xl font-bold text-green-600">
                {alerts.filter((a) => a.status === 'resolved').length}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">Filter:</span>
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'acknowledged', 'resolved'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-teal-100 text-teal-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-4">
          {(['all', 'critical', 'warning'] as const).map((severity) => (
            <button
              key={severity}
              onClick={() => setSeverityFilter(severity)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                severityFilter === severity
                  ? severity === 'critical'
                    ? 'bg-red-100 text-red-700'
                    : severity === 'warning'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-teal-100 text-teal-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No abnormal vitals detected</p>
                <p className="text-sm">All patient vitals are within normal ranges</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const Icon = vitalIcons[alert.vitalType] || AlertTriangle;
                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedAlert?.id === alert.id
                        ? 'border-teal-500 bg-teal-50'
                        : alert.severity === 'critical' && alert.status === 'active'
                        ? 'border-red-200 bg-red-50 hover:border-red-300'
                        : alert.status === 'active'
                        ? 'border-yellow-200 bg-yellow-50 hover:border-yellow-300'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        alert.severity === 'critical' ? 'bg-red-100' : 'bg-yellow-100'
                      }`}>
                        <Icon className={`w-5 h-5 ${
                          alert.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            alert.severity === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {alert.severity.toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            alert.status === 'active'
                              ? 'bg-red-100 text-red-700'
                              : alert.status === 'acknowledged'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {alert.status}
                          </span>
                        </div>
                        <p className="font-medium text-gray-900 mt-1">{alert.patientName}</p>
                        <p className="text-sm text-gray-500">{alert.patientMrn}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-gray-600">
                            {vitalLabels[alert.vitalType] || alert.vitalType}: <strong className="text-red-600">{alert.value}</strong>
                          </span>
                          <span className="text-gray-500">Normal: {alert.normalRange}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-gray-500 text-sm">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(alert.triggeredAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Alert Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedAlert ? (
            <>
              <h2 className="font-semibold text-gray-900 mb-4">Alert Details</h2>
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedAlert.patientName}</p>
                    <p className="text-sm text-gray-500">{selectedAlert.patientMrn}</p>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Vital Sign</p>
                  <p className="font-medium text-gray-900">{vitalLabels[selectedAlert.vitalType] || selectedAlert.vitalType}</p>
                </div>

                <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                  <p className="text-xs text-red-600">Abnormal Value</p>
                  <p className="font-bold text-red-700 text-lg">{selectedAlert.value}</p>
                  <p className="text-xs text-gray-500 mt-1">Normal: {selectedAlert.normalRange}</p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Detected At</p>
                  <p className="font-medium text-gray-900">
                    {new Date(selectedAlert.triggeredAt).toLocaleString()}
                  </p>
                </div>

                {selectedAlert.acknowledgedBy && (
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                    <p className="text-xs text-yellow-600">Acknowledged by</p>
                    <p className="font-medium text-gray-900">{selectedAlert.acknowledgedBy}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(selectedAlert.acknowledgedAt!).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {selectedAlert.status === 'active' && (
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <button
                    onClick={() => handleAcknowledge(selectedAlert.id)}
                    className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600"
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={() => handleResolve(selectedAlert.id)}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    Resolve
                  </button>
                </div>
              )}
              {selectedAlert.status === 'acknowledged' && (
                <button
                  onClick={() => handleResolve(selectedAlert.id)}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 mt-4"
                >
                  Mark as Resolved
                </button>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select an alert to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
