import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Download,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface QueuePerformanceData {
  avgWaitTime: number;
  avgServiceTime: number;
  totalServed: number;
  noShowRate: number;
  peakWaitTime: number;
  minWaitTime: number;
  hourlyStats: { hour: string; patients: number; avgWait: number }[];
  departmentPerformance: { department: string; avgWait: number; served: number; noShows: number }[];
  staffPerformance: { staff: string; served: number; avgService: number; rating: number }[];
  waitTimeTrend: { date: string; avgWait: number }[];
}

// Mock data
const mockData: QueuePerformanceData = {
  avgWaitTime: 18,
  avgServiceTime: 12,
  totalServed: 127,
  noShowRate: 4.2,
  peakWaitTime: 35,
  minWaitTime: 5,
  hourlyStats: [
    { hour: '08:00', patients: 12, avgWait: 8 },
    { hour: '09:00', patients: 24, avgWait: 22 },
    { hour: '10:00', patients: 28, avgWait: 28 },
    { hour: '11:00', patients: 18, avgWait: 15 },
    { hour: '12:00', patients: 8, avgWait: 8 },
    { hour: '13:00', patients: 5, avgWait: 5 },
    { hour: '14:00', patients: 15, avgWait: 12 },
    { hour: '15:00', patients: 12, avgWait: 10 },
    { hour: '16:00', patients: 5, avgWait: 6 },
  ],
  departmentPerformance: [
    { department: 'General OPD', avgWait: 22, served: 45, noShows: 3 },
    { department: 'Pediatrics', avgWait: 15, served: 25, noShows: 1 },
    { department: 'Cardiology', avgWait: 25, served: 18, noShows: 2 },
    { department: 'Gynecology', avgWait: 18, served: 22, noShows: 1 },
    { department: 'Orthopedics', avgWait: 20, served: 17, noShows: 0 },
  ],
  staffPerformance: [
    { staff: 'Dr. Sarah Nambi', served: 32, avgService: 12, rating: 4.8 },
    { staff: 'Dr. James Okello', served: 28, avgService: 15, rating: 4.6 },
    { staff: 'Dr. Francis Olweny', served: 18, avgService: 20, rating: 4.9 },
    { staff: 'Dr. Mary Apio', served: 24, avgService: 10, rating: 4.7 },
    { staff: 'Dr. David Otim', served: 25, avgService: 14, rating: 4.5 },
  ],
  waitTimeTrend: [
    { date: 'Mon', avgWait: 16 },
    { date: 'Tue', avgWait: 19 },
    { date: 'Wed', avgWait: 22 },
    { date: 'Thu', avgWait: 18 },
    { date: 'Fri', avgWait: 20 },
    { date: 'Sat', avgWait: 12 },
    { date: 'Sun', avgWait: 8 },
  ],
};

export default function QueuePerformancePage() {
  const navigate = useNavigate();

  const data = mockData;
  const maxPatients = Math.max(...data.hourlyStats.map(h => h.patients));
  const maxWait = Math.max(...data.hourlyStats.map(h => h.avgWait));

  const getWaitTimeColor = (wait: number) => {
    if (wait <= 10) return 'text-green-600';
    if (wait <= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

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
        <button className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-6 gap-3 mb-4 flex-shrink-0">
        <div className="card p-3 text-center">
          <p className={`text-2xl font-bold ${getWaitTimeColor(data.avgWaitTime)}`}>{data.avgWaitTime}m</p>
          <p className="text-xs text-gray-500">Avg Wait Time</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{data.avgServiceTime}m</p>
          <p className="text-xs text-gray-500">Avg Service</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{data.totalServed}</p>
          <p className="text-xs text-gray-500">Total Served</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{data.noShowRate}%</p>
          <p className="text-xs text-gray-500">No-Show Rate</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-orange-600">{data.peakWaitTime}m</p>
          <p className="text-xs text-gray-500">Peak Wait</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{data.minWaitTime}m</p>
          <p className="text-xs text-gray-500">Min Wait</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Hourly Distribution */}
        <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Hourly Distribution</h2>
          <div className="flex-1 flex items-end gap-1 min-h-0 pb-6">
            {data.hourlyStats.map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div className="flex flex-col items-center w-full">
                  <span className="text-xs text-gray-500 mb-1">{item.avgWait}m</span>
                  <div className="w-full flex gap-0.5">
                    <div
                      className="flex-1 bg-blue-500 rounded-t"
                      style={{ height: `${(item.patients / maxPatients) * 80}px` }}
                      title={`${item.patients} patients`}
                    />
                    <div
                      className="flex-1 bg-yellow-500 rounded-t"
                      style={{ height: `${(item.avgWait / maxWait) * 80}px` }}
                      title={`${item.avgWait}m wait`}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-500 mt-2">{item.hour}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 text-xs pt-2 border-t flex-shrink-0">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded" /> Patients</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded" /> Wait Time</span>
          </div>
        </div>

        {/* Weekly Trend */}
        <div className="card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Weekly Trend</h2>
          <div className="flex-1 flex items-end gap-2 min-h-0">
            {data.waitTimeTrend.map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <span className="text-xs text-gray-600 mb-1">{item.avgWait}m</span>
                <div
                  className={`w-full rounded-t ${item.avgWait > 20 ? 'bg-red-500' : item.avgWait > 15 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ height: `${item.avgWait * 3}px` }}
                />
                <span className="text-xs text-gray-500 mt-2">{item.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Department Performance */}
        <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">By Department</h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {data.departmentPerformance.map((dept, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{dept.department}</span>
                  <span className={`font-bold ${getWaitTimeColor(dept.avgWait)}`}>{dept.avgWait}m</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    {dept.served} served
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-red-500" />
                    {dept.noShows} no-shows
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Staff Performance */}
        <div className="card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Staff Performance</h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {data.staffPerformance.map((staff, idx) => (
              <div key={idx} className="p-2 border rounded-lg">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm">{staff.staff}</span>
                  <span className="text-yellow-600 text-xs">⭐ {staff.rating}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{staff.served} patients</span>
                  <span>{staff.avgService}m avg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
