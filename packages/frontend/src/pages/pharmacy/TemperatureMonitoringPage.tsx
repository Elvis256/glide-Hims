import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Thermometer,
  AlertTriangle,
  CheckCircle,
  Plus,
  Loader2,
  X,
  Snowflake,
  Sun,
  Droplets,
  Clock,
  Activity,
  ArrowLeft,
} from 'lucide-react';
import {
  pharmacyService,
  type TemperatureSensorWithReading,
  type TemperatureLogEntry,
  type SensorReadingsResponse,
} from '../../services/pharmacy';

type View = 'dashboard' | 'sensor-detail' | 'add-sensor' | 'add-reading';

export default function TemperatureMonitoringPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('dashboard');
  const [selectedSensorId, setSelectedSensorId] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view !== 'dashboard' && (
            <button
              onClick={() => setView('dashboard')}
              className="p-1 rounded hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Temperature Monitoring</h1>
            <p className="text-sm text-gray-500 mt-1">
              Cold chain monitoring for refrigerated and frozen medications
            </p>
          </div>
        </div>
        {view === 'dashboard' && (
          <div className="flex gap-2">
            <button
              onClick={() => setView('add-reading')}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              <Thermometer className="w-4 h-4" />
              Manual Reading
            </button>
            <button
              onClick={() => setView('add-sensor')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Sensor
            </button>
          </div>
        )}
      </div>

      {view === 'dashboard' && (
        <DashboardView
          onSelectSensor={(sensorId) => {
            setSelectedSensorId(sensorId);
            setView('sensor-detail');
          }}
        />
      )}
      {view === 'sensor-detail' && (
        <SensorDetailView sensorId={selectedSensorId} onBack={() => setView('dashboard')} />
      )}
      {view === 'add-sensor' && <AddSensorForm onDone={() => setView('dashboard')} />}
      {view === 'add-reading' && <AddReadingForm onDone={() => setView('dashboard')} />}
    </div>
  );
}

// ── Dashboard View ──────────────────────────────────────────────────────
function DashboardView({ onSelectSensor }: { onSelectSensor: (sensorId: string) => void }) {
  const queryClient = useQueryClient();

  const { data: sensors = [], isLoading: sensorsLoading } = useQuery<TemperatureSensorWithReading[]>({
    queryKey: ['temperature-sensors'],
    queryFn: pharmacyService.temperature.getSensors,
    refetchInterval: 30000,
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<TemperatureLogEntry[]>({
    queryKey: ['temperature-alerts'],
    queryFn: pharmacyService.temperature.getAlerts,
    refetchInterval: 15000,
  });

  const ackMutation = useMutation({
    mutationFn: pharmacyService.temperature.acknowledgeAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['temperature-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['temperature-sensors'] });
      toast.success('Alert acknowledged');
    },
    onError: () => toast.error('Failed to acknowledge alert'),
  });

  const getStorageIcon = (type: string) => {
    switch (type) {
      case 'frozen': return <Snowflake className="w-5 h-5 text-blue-500" />;
      case 'refrigerated': return <Thermometer className="w-5 h-5 text-cyan-500" />;
      default: return <Sun className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusColor = (sensor: TemperatureSensorWithReading) => {
    if (!sensor.latestReading) return 'border-gray-200 bg-gray-50';
    if (sensor.latestReading.alertType === 'critical') return 'border-red-300 bg-red-50';
    if (sensor.latestReading.alertType === 'warning') return 'border-amber-300 bg-amber-50';
    if (sensor.latestReading.isAlert) return 'border-amber-300 bg-amber-50';
    return 'border-green-300 bg-green-50';
  };

  return (
    <div className="space-y-6">
      {/* Active Alerts */}
      {!alertsLoading && alerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Active Alerts ({alerts.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`border-2 rounded-lg p-4 ${
                  alert.alertType === 'critical' ? 'border-red-400 bg-red-50' : 'border-amber-400 bg-amber-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{alert.location}</p>
                    <p className="text-sm text-gray-600">Sensor: {alert.sensorId}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      alert.alertType === 'critical'
                        ? 'bg-red-200 text-red-800'
                        : 'bg-amber-200 text-amber-800'
                    }`}
                  >
                    {alert.alertType?.toUpperCase()}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span className="font-bold text-2xl text-red-700">{Number(alert.temperature).toFixed(1)}°C</span>
                  {alert.humidity != null && (
                    <span className="flex items-center gap-1 text-gray-500">
                      <Droplets className="w-3 h-3" />
                      {Number(alert.humidity).toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(alert.recordedAt).toLocaleString()}
                  </span>
                  <button
                    onClick={() => ackMutation.mutate(alert.id)}
                    disabled={ackMutation.isPending}
                    className="text-xs px-3 py-1 bg-white border rounded hover:bg-gray-50"
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sensors Grid */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Sensors
        </h2>

        {sensorsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : sensors.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Thermometer className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>No sensors registered. Add one to start monitoring.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sensors.map((sensor) => (
              <button
                key={sensor.id}
                onClick={() => onSelectSensor(sensor.sensorId)}
                className={`border-2 rounded-lg p-4 text-left hover:shadow-md transition-shadow ${getStatusColor(sensor)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStorageIcon(sensor.storageType)}
                    <h3 className="font-medium text-gray-900">{sensor.name}</h3>
                  </div>
                  {!sensor.isActive && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Inactive</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">{sensor.location}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Range: {Number(sensor.minTemp).toFixed(0)}°C to {Number(sensor.maxTemp).toFixed(0)}°C
                </p>

                {sensor.latestReading ? (
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <span className="font-bold text-3xl">
                        {Number(sensor.latestReading.temperature).toFixed(1)}
                      </span>
                      <span className="text-lg text-gray-500">°C</span>
                      {sensor.latestReading.humidity != null && (
                        <span className="text-sm text-gray-400 ml-2">
                          {Number(sensor.latestReading.humidity).toFixed(0)}% RH
                        </span>
                      )}
                    </div>
                    {sensor.latestReading.isAlert ? (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-gray-400 italic">No readings yet</div>
                )}

                {sensor.latestReading && (
                  <p className="text-xs text-gray-400 mt-2">
                    Last: {new Date(sensor.latestReading.recordedAt).toLocaleString()}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sensor Detail View ──────────────────────────────────────────────────
function SensorDetailView({ sensorId, onBack }: { sensorId: string; onBack: () => void }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading } = useQuery<SensorReadingsResponse>({
    queryKey: ['sensor-readings', sensorId, dateFrom, dateTo],
    queryFn: () =>
      pharmacyService.temperature.getSensorReadings(
        sensorId,
        dateFrom || undefined,
        dateTo || undefined,
      ),
  });

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Sensor: {sensorId} — Reading History
        </h2>

        {/* Date Filters */}
        <div className="flex items-center gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded-md px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="datetime-local"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded-md px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        {/* Stats */}
        {data?.stats && (
          <div className="grid grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Readings', value: data.stats.count },
              { label: 'Min', value: `${data.stats.min.toFixed(1)}°C` },
              { label: 'Max', value: `${data.stats.max.toFixed(1)}°C` },
              { label: 'Avg', value: `${data.stats.avg.toFixed(1)}°C` },
              { label: 'Alerts', value: data.stats.alertCount },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-lg font-bold">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Readings Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : !data?.readings.length ? (
          <p className="text-center py-8 text-gray-500">No readings found for this sensor.</p>
        ) : (
          <div className="overflow-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Temperature</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Humidity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.readings.map((r) => (
                  <tr key={r.id} className={r.isAlert ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-2 text-sm">{new Date(r.recordedAt).toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm font-medium">
                      {Number(r.temperature).toFixed(1)}°C
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {r.humidity != null ? `${Number(r.humidity).toFixed(0)}%` : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {r.isAlert ? (
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            r.alertType === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {r.alertType?.toUpperCase()}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                          NORMAL
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Sensor Form ─────────────────────────────────────────────────────
function AddSensorForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    sensorId: '',
    name: '',
    location: '',
    storageType: 'refrigerated' as 'refrigerated' | 'frozen' | 'room_temperature',
    minTemp: '',
    maxTemp: '',
  });

  const mutation = useMutation({
    mutationFn: pharmacyService.temperature.createSensor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['temperature-sensors'] });
      toast.success('Sensor registered');
      onDone();
    },
    onError: () => toast.error('Failed to register sensor'),
  });

  const defaults: Record<string, { min: number; max: number }> = {
    refrigerated: { min: 2, max: 8 },
    frozen: { min: -25, max: -15 },
    room_temperature: { min: 15, max: 25 },
  };

  const handleTypeChange = (type: string) => {
    const d = defaults[type] || defaults.refrigerated;
    setForm({
      ...form,
      storageType: type as any,
      minTemp: String(d.min),
      maxTemp: String(d.max),
    });
  };

  return (
    <div className="bg-white border rounded-lg p-6 max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Register New Sensor</h3>
        <button onClick={onDone} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sensor ID</label>
        <input
          type="text"
          value={form.sensorId}
          onChange={(e) => setForm({ ...form, sensorId: e.target.value })}
          className="w-full border rounded-md px-3 py-2 text-sm"
          placeholder="e.g. FRIDGE-01"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Friendly Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full border rounded-md px-3 py-2 text-sm"
          placeholder="e.g. Main Pharmacy Fridge"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
        <input
          type="text"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="w-full border rounded-md px-3 py-2 text-sm"
          placeholder="e.g. Pharmacy Store Room A"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Storage Type</label>
        <select
          value={form.storageType}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm"
        >
          <option value="refrigerated">Refrigerated (2-8°C)</option>
          <option value="frozen">Frozen (-25 to -15°C)</option>
          <option value="room_temperature">Room Temperature (15-25°C)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Min Temp (°C)</label>
          <input
            type="number"
            step="0.1"
            value={form.minTemp}
            onChange={(e) => setForm({ ...form, minTemp: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Temp (°C)</label>
          <input
            type="number"
            step="0.1"
            value={form.maxTemp}
            onChange={(e) => setForm({ ...form, maxTemp: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onDone} className="px-4 py-2 border rounded-md text-sm">
          Cancel
        </button>
        <button
          onClick={() =>
            mutation.mutate({
              sensorId: form.sensorId,
              name: form.name,
              location: form.location,
              storageType: form.storageType,
              minTemp: form.minTemp ? Number(form.minTemp) : undefined,
              maxTemp: form.maxTemp ? Number(form.maxTemp) : undefined,
            })
          }
          disabled={mutation.isPending || !form.sensorId || !form.name || !form.location}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Registering...' : 'Register Sensor'}
        </button>
      </div>
    </div>
  );
}

// ── Add Reading Form ────────────────────────────────────────────────────
function AddReadingForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    sensorId: '',
    temperature: '',
    humidity: '',
  });

  const { data: sensors = [] } = useQuery<TemperatureSensorWithReading[]>({
    queryKey: ['temperature-sensors'],
    queryFn: pharmacyService.temperature.getSensors,
  });

  const mutation = useMutation({
    mutationFn: pharmacyService.temperature.recordReading,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['temperature-sensors'] });
      queryClient.invalidateQueries({ queryKey: ['temperature-alerts'] });
      if (data.isAlert) {
        toast.warning(`Reading recorded — ALERT: ${Number(data.temperature).toFixed(1)}°C is out of range!`);
      } else {
        toast.success('Reading recorded successfully');
      }
      onDone();
    },
    onError: () => toast.error('Failed to record reading'),
  });

  return (
    <div className="bg-white border rounded-lg p-6 max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Record Manual Temperature Reading</h3>
        <button onClick={onDone} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sensor</label>
        <select
          value={form.sensorId}
          onChange={(e) => setForm({ ...form, sensorId: e.target.value })}
          className="w-full border rounded-md px-3 py-2 text-sm"
        >
          <option value="">Select a sensor...</option>
          {sensors.map((s) => (
            <option key={s.id} value={s.sensorId}>
              {s.name} ({s.location})
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°C)</label>
          <input
            type="number"
            step="0.1"
            value={form.temperature}
            onChange={(e) => setForm({ ...form, temperature: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="e.g. 4.5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Humidity % (optional)</label>
          <input
            type="number"
            step="1"
            value={form.humidity}
            onChange={(e) => setForm({ ...form, humidity: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="e.g. 45"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onDone} className="px-4 py-2 border rounded-md text-sm">
          Cancel
        </button>
        <button
          onClick={() =>
            mutation.mutate({
              sensorId: form.sensorId,
              temperature: Number(form.temperature),
              humidity: form.humidity ? Number(form.humidity) : undefined,
            })
          }
          disabled={mutation.isPending || !form.sensorId || !form.temperature}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Recording...' : 'Record Reading'}
        </button>
      </div>
    </div>
  );
}
