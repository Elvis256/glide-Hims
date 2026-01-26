import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  Search,
  UserCircle,
  Thermometer,
  Activity,
  Heart,
  Wind,
  Droplets,
  Calendar,
  Loader2,
} from 'lucide-react';
import { patientsService } from '../../services/patients';
import { vitalsService, type VitalRecord } from '../../services/vitals';

interface TrendData {
  date: string;
  temperature: number;
  pulse: number;
  bpSystolic: number;
  bpDiastolic: number;
  respiratoryRate: number;
  oxygenSaturation: number;
}

interface Patient {
  id: string;
  mrn: string;
  name: string;
}

type VitalType = 'temperature' | 'pulse' | 'bp' | 'respiratoryRate' | 'oxygenSaturation';

const vitalConfig: Record<VitalType, { label: string; icon: React.ElementType; color: string; unit: string; min: number; max: number }> = {
  temperature: { label: 'Temperature', icon: Thermometer, color: 'rgb(239, 68, 68)', unit: '°C', min: 35, max: 40 },
  pulse: { label: 'Pulse Rate', icon: Activity, color: 'rgb(236, 72, 153)', unit: 'bpm', min: 40, max: 120 },
  bp: { label: 'Blood Pressure', icon: Heart, color: 'rgb(239, 68, 68)', unit: 'mmHg', min: 50, max: 160 },
  respiratoryRate: { label: 'Respiratory Rate', icon: Wind, color: 'rgb(59, 130, 246)', unit: '/min', min: 8, max: 28 },
  oxygenSaturation: { label: 'SpO2', icon: Droplets, color: 'rgb(59, 130, 246)', unit: '%', min: 85, max: 100 },
};

export default function VitalTrendsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedVital, setSelectedVital] = useState<VitalType>('temperature');
  const [dateRange, setDateRange] = useState('7d');
  const [vitalsData, setVitalsData] = useState<VitalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Search patients
  useEffect(() => {
    if (searchTerm.length < 2) {
      setPatients([]);
      return;
    }
    const search = async () => {
      try {
        const response = await patientsService.search({ search: searchTerm });
        const data = response.data || [];
        setPatients(data.map((p) => ({
          id: p.id,
          mrn: p.mrn,
          name: p.fullName || 'Unknown',
        })));
      } catch (error) {
        console.error('Failed to search patients:', error);
      }
    };
    search();
  }, [searchTerm]);

  // Load vitals for selected patient
  useEffect(() => {
    if (!selectedPatient) {
      setVitalsData([]);
      return;
    }
    const loadVitals = async () => {
      setLoading(true);
      try {
        const data = await vitalsService.getPatientHistory(selectedPatient.id, 100);
        setVitalsData(data);
      } catch (error) {
        console.error('Failed to load vitals:', error);
        setVitalsData([]);
      } finally {
        setLoading(false);
      }
    };
    loadVitals();
  }, [selectedPatient]);

  const config = vitalConfig[selectedVital];

  // Convert vitals to trend data
  const trendData: TrendData[] = useMemo(() => {
    if (!vitalsData.length) return [];
    
    // Get date range limit
    const now = new Date();
    const daysMap: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };
    const days = daysMap[dateRange] || 7;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    return vitalsData
      .filter(v => new Date(v.createdAt) >= cutoff)
      .map(v => ({
        date: new Date(v.createdAt).toISOString().split('T')[0],
        temperature: v.temperature || 0,
        pulse: v.pulse || 0,
        bpSystolic: v.bloodPressureSystolic || 0,
        bpDiastolic: v.bloodPressureDiastolic || 0,
        respiratoryRate: v.respiratoryRate || 0,
        oxygenSaturation: v.oxygenSaturation || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [vitalsData, dateRange]);

  const getChartData = () => {
    return trendData.map((d) => {
      if (selectedVital === 'bp') {
        return { date: d.date, value: d.bpSystolic, value2: d.bpDiastolic };
      }
      return { date: d.date, value: d[selectedVital] };
    });
  };

  const chartData = getChartData();

  const scaleValue = (value: number) => {
    const range = config.max - config.min;
    return ((value - config.min) / range) * 100;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getLatestStats = () => {
    if (trendData.length < 1) {
      return { current: '--', change: 0, trend: 'stable' as const };
    }
    
    const latest = trendData[trendData.length - 1];
    const previous = trendData.length > 1 ? trendData[trendData.length - 2] : latest;
    
    if (selectedVital === 'bp') {
      const change = latest.bpSystolic - previous.bpSystolic;
      return {
        current: `${latest.bpSystolic}/${latest.bpDiastolic}`,
        change: change,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      };
    }
    
    const current = latest[selectedVital];
    const prev = previous[selectedVital];
    const change = current - prev;
    
    return {
      current: current.toString(),
      change: Number(change.toFixed(1)),
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
    };
  };

  const stats = getLatestStats();

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
            <TrendingUp className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Vital Trends</h1>
              <p className="text-sm text-gray-500">Analyze patient vital sign trends</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="7d">Last 7 Days</option>
            <option value="14d">Last 14 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        {/* Patient & Vital Selection */}
        <div className="space-y-4 flex flex-col min-h-0">
          {/* Patient Selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Patient</h2>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patient..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
              />
              {showDropdown && patients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPatient(p);
                        setSearchTerm('');
                        setShowDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                    >
                      <UserCircle className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.mrn}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedPatient ? (
              <div className="p-3 rounded-lg border border-teal-500 bg-teal-50">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-8 h-8 text-teal-600" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{selectedPatient.name}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-2">Search and select a patient</p>
            )}
          </div>

          {/* Vital Type Selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex-1">
            <h2 className="font-semibold text-gray-900 mb-3">Vital Sign</h2>
            <div className="space-y-2">
              {(Object.keys(vitalConfig) as VitalType[]).map((vital) => {
                const cfg = vitalConfig[vital];
                const Icon = cfg.icon;
                return (
                  <button
                    key={vital}
                    onClick={() => setSelectedVital(vital)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      selectedVital === vital
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" style={{ color: cfg.color }} />
                    <span className="text-sm font-medium text-gray-900">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
          ) : !selectedPatient ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Select a patient to view vital trends</p>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No vitals recorded for {selectedPatient.name}</p>
                <p className="text-sm">in the selected time range</p>
              </div>
            </div>
          ) : (
            <>
              {/* Stats Summary */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = config.icon;
                      return <Icon className="w-5 h-5" style={{ color: config.color }} />;
                    })()}
                    <h2 className="font-semibold text-gray-900">{config.label} Trend</h2>
                  </div>
                  <p className="text-sm text-gray-500">{selectedPatient?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.current} <span className="text-sm font-normal text-gray-500">{config.unit}</span>
                  </p>
                  <p className={`text-sm ${
                    stats.trend === 'up' ? 'text-red-600' : stats.trend === 'down' ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {stats.change > 0 ? '+' : ''}{stats.change} from previous
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div className="flex-1 min-h-0">
                <div className="h-full flex flex-col">
                  {/* Y-axis labels and chart */}
                  <div className="flex-1 flex">
                    {/* Y-axis */}
                    <div className="w-12 flex flex-col justify-between text-xs text-gray-500 pr-2">
                      <span>{config.max}</span>
                      <span>{Math.round((config.max + config.min) / 2)}</span>
                      <span>{config.min}</span>
                    </div>
                    
                    {/* Chart area */}
                    <div className="flex-1 relative border-l border-b border-gray-200">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div key={i} className="border-t border-gray-100 w-full" />
                        ))}
                      </div>
                      
                      {/* Data points and line */}
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                    {/* Line */}
                    <polyline
                      fill="none"
                      stroke={config.color}
                      strokeWidth="2"
                      points={chartData
                        .map((d, i) => {
                          const x = (i / (chartData.length - 1)) * 100;
                          const y = 100 - scaleValue(d.value);
                          return `${x}%,${y}%`;
                        })
                        .join(' ')}
                    />
                    
                    {/* Secondary line for BP */}
                    {selectedVital === 'bp' && (
                      <polyline
                        fill="none"
                        stroke={config.color}
                        strokeWidth="2"
                        strokeDasharray="4"
                        opacity="0.6"
                        points={chartData
                          .map((d, i) => {
                            const x = (i / (chartData.length - 1)) * 100;
                            const y = 100 - scaleValue(d.value2!);
                            return `${x}%,${y}%`;
                          })
                          .join(' ')}
                      />
                    )}
                    
                    {/* Data points */}
                    {chartData.map((d, i) => {
                      const x = (i / (chartData.length - 1)) * 100;
                      const y = 100 - scaleValue(d.value);
                      return (
                        <circle
                          key={i}
                          cx={`${x}%`}
                          cy={`${y}%`}
                          r="4"
                          fill="white"
                          stroke={config.color}
                          strokeWidth="2"
                        />
                      );
                    })}
                  </svg>
                </div>
              </div>
              
              {/* X-axis labels */}
              <div className="flex ml-12 pt-2">
                {chartData.map((d, i) => (
                  <div key={i} className="flex-1 text-center text-xs text-gray-500">
                    {formatDate(d.date)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend for BP */}
          {selectedVital === 'bp' && (
            <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-red-500" />
                <span className="text-sm text-gray-600">Systolic</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-red-500 opacity-60" style={{ borderStyle: 'dashed' }} />
                <span className="text-sm text-gray-600">Diastolic</span>
              </div>
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
