import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  ArrowLeft,
  Calendar,
  Download,
  Printer,
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  Loader2,
  FileX,
} from 'lucide-react';

interface DailySummary {
  registrations: number;
  revisits: number;
  tokensIssued: number;
  appointmentsBooked: number;
  totalRevenue: number;
  cashPayments: number;
  insurancePayments: number;
  mobilePayments: number;
  refunds: number;
  avgWaitTime: number;
  peakHour: string;
  staffPerformance: { name: string; patients: number; revenue: number }[];
  departmentBreakdown: { name: string; patients: number; revenue: number }[];
}

export default function RegistrationDailySummaryPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<DailySummary | null>(null);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Daily Summary Report</h1>
              <p className="text-gray-500 text-sm">Registration desk daily operations</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input py-2 text-sm"
          />
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading daily summary...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !data && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileX className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h2>
            <p className="text-gray-500 mb-4">
              Daily summary data is not available for the selected date.
            </p>
            <p className="text-sm text-gray-400">
              Select a different date or check back later.
            </p>
          </div>
        </div>
      )}

      {/* Data Content */}
      {!isLoading && data && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-5 gap-3 mb-4 flex-shrink-0">
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{data.registrations}</p>
              <p className="text-xs text-gray-500">New Registrations</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{data.revisits}</p>
              <p className="text-xs text-gray-500">Revisits</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-purple-600">{data.tokensIssued}</p>
              <p className="text-xs text-gray-500">Tokens Issued</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{data.appointmentsBooked}</p>
              <p className="text-xs text-gray-500">Appointments</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{data.avgWaitTime}m</p>
              <p className="text-xs text-gray-500">Avg Wait Time</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
            {/* Left: Revenue Summary */}
            <div className="card p-4 flex flex-col min-h-0">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 flex-shrink-0">
                <DollarSign className="w-4 h-4 text-green-600" />
                Revenue Summary
              </h2>
              <div className="flex-1 overflow-y-auto space-y-3">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-green-600 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-700">
                    UGX {data.totalRevenue.toLocaleString()}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm">Cash Payments</span>
                    <span className="font-medium">UGX {data.cashPayments.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm">Insurance</span>
                    <span className="font-medium">UGX {data.insurancePayments.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm">Mobile Money</span>
                    <span className="font-medium">UGX {data.mobilePayments.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-red-50 rounded text-red-700">
                    <span className="text-sm">Refunds</span>
                    <span className="font-medium">-UGX {data.refunds.toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-1">Peak Hour</p>
                  <p className="font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-600" />
                    {data.peakHour}
                  </p>
                </div>
              </div>
            </div>

            {/* Middle: Department Breakdown */}
            <div className="card p-4 flex flex-col min-h-0">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 flex-shrink-0">
                <Users className="w-4 h-4 text-blue-600" />
                By Department
              </h2>
              <div className="flex-1 overflow-y-auto space-y-2">
                {data.departmentBreakdown.map((dept, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm">{dept.name}</span>
                      <span className="text-xs text-gray-500">{dept.patients} patients</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(dept.patients / data.tokensIssued) * 100}%` }}
                      />
                    </div>
                    <p className="text-right text-xs text-green-600 font-medium">
                      UGX {dept.revenue.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Staff Performance */}
            <div className="card p-4 flex flex-col min-h-0">
              <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Staff Performance</h2>
              <div className="flex-1 overflow-y-auto space-y-2">
                {data.staffPerformance.map((staff, idx) => (
                  <div key={idx} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm">
                          {idx + 1}
                        </div>
                        <span className="font-medium text-sm">{staff.name}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-lg font-bold text-blue-600">{staff.patients}</p>
                        <p className="text-xs text-gray-500">Patients</p>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-sm font-bold text-green-600">
                          {(staff.revenue / 1000000).toFixed(1)}M
                        </p>
                        <p className="text-xs text-gray-500">Revenue</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
