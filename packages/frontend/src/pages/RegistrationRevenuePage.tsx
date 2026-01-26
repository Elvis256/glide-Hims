import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  ArrowLeft,
  Download,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Banknote,
  Smartphone,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

interface RevenueData {
  totalRevenue: number;
  previousPeriod: number;
  changePercent: number;
  cashRevenue: number;
  cardRevenue: number;
  mobileRevenue: number;
  insuranceRevenue: number;
  refundsTotal: number;
  netRevenue: number;
  dailyBreakdown: { date: string; amount: number }[];
  serviceBreakdown: { service: string; amount: number; transactions: number }[];
  paymentMethodTrend: { method: string; current: number; previous: number }[];
}

// Mock data
const mockData: RevenueData = {
  totalRevenue: 125000000,
  previousPeriod: 118000000,
  changePercent: 5.9,
  cashRevenue: 65000000,
  cardRevenue: 25000000,
  mobileRevenue: 15000000,
  insuranceRevenue: 20000000,
  refundsTotal: 2500000,
  netRevenue: 122500000,
  dailyBreakdown: [
    { date: '01', amount: 4200000 },
    { date: '02', amount: 3800000 },
    { date: '03', amount: 4500000 },
    { date: '04', amount: 5100000 },
    { date: '05', amount: 4800000 },
    { date: '06', amount: 2100000 },
    { date: '07', amount: 1800000 },
    { date: '08', amount: 4600000 },
    { date: '09', amount: 4300000 },
    { date: '10', amount: 4900000 },
  ],
  serviceBreakdown: [
    { service: 'Consultation', amount: 35000000, transactions: 2800 },
    { service: 'Laboratory', amount: 28000000, transactions: 1200 },
    { service: 'Radiology', amount: 22000000, transactions: 450 },
    { service: 'Pharmacy', amount: 18000000, transactions: 3200 },
    { service: 'Registration', amount: 12000000, transactions: 4200 },
    { service: 'Procedures', amount: 10000000, transactions: 180 },
  ],
  paymentMethodTrend: [
    { method: 'Cash', current: 65000000, previous: 62000000 },
    { method: 'Card', current: 25000000, previous: 22000000 },
    { method: 'Mobile', current: 15000000, previous: 14000000 },
    { method: 'Insurance', current: 20000000, previous: 20000000 },
  ],
};

export default function RegistrationRevenuePage() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('month');

  const data = mockData;
  const maxDaily = Math.max(...data.dailyBreakdown.map(d => d.amount));

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-green-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Revenue Report</h1>
              <p className="text-gray-500 text-sm">Reception billing revenue analysis</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border rounded overflow-hidden">
            {['week', 'month', 'quarter'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm capitalize ${
                  dateRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-5 gap-3 mb-4 flex-shrink-0">
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Total Revenue</span>
            <span className={`flex items-center gap-1 text-xs ${data.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {data.changePercent}%
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900">UGX {(data.totalRevenue / 1000000).toFixed(1)}M</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="w-4 h-4 text-green-600" />
            <span className="text-xs text-gray-500">Cash</span>
          </div>
          <p className="text-lg font-bold text-green-600">UGX {(data.cashRevenue / 1000000).toFixed(1)}M</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-gray-500">Card</span>
          </div>
          <p className="text-lg font-bold text-blue-600">UGX {(data.cardRevenue / 1000000).toFixed(1)}M</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-gray-500">Mobile</span>
          </div>
          <p className="text-lg font-bold text-purple-600">UGX {(data.mobileRevenue / 1000000).toFixed(1)}M</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-orange-600" />
            <span className="text-xs text-gray-500">Insurance</span>
          </div>
          <p className="text-lg font-bold text-orange-600">UGX {(data.insuranceRevenue / 1000000).toFixed(1)}M</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Daily Trend Chart */}
        <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Daily Revenue Trend</h2>
          <div className="flex-1 flex items-end gap-1 min-h-0 pb-6">
            {data.dailyBreakdown.map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <span className="text-xs text-gray-600 mb-1">{(item.amount / 1000000).toFixed(1)}M</span>
                <div
                  className="w-full bg-green-500 rounded-t transition-all hover:bg-green-600"
                  style={{ height: `${(item.amount / maxDaily) * 120}px` }}
                />
                <span className="text-xs text-gray-500 mt-2">{item.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Net Revenue Summary */}
        <div className="card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Net Revenue</h2>
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-xs text-green-600 mb-1">Gross Revenue</p>
              <p className="text-2xl font-bold text-green-700">
                UGX {(data.totalRevenue / 1000000).toFixed(1)}M
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xs text-red-600 mb-1">Refunds</p>
              <p className="text-lg font-bold text-red-600">
                - UGX {(data.refundsTotal / 1000000).toFixed(2)}M
              </p>
            </div>
            <div className="border-t pt-3">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-xs text-blue-600 mb-1">Net Revenue</p>
                <p className="text-2xl font-bold text-blue-700">
                  UGX {(data.netRevenue / 1000000).toFixed(1)}M
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Service Breakdown */}
        <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Revenue by Service</h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {data.serviceBreakdown.map((service, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{service.service}</span>
                  <span className="font-bold text-green-600">
                    UGX {(service.amount / 1000000).toFixed(1)}M
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{service.transactions.toLocaleString()} transactions</span>
                  <span>{Math.round(service.amount / data.totalRevenue * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${(service.amount / data.totalRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Method Comparison */}
        <div className="card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">vs Previous Period</h2>
          <div className="flex-1 overflow-y-auto space-y-3">
            {data.paymentMethodTrend.map((method, idx) => {
              const change = ((method.current - method.previous) / method.previous * 100).toFixed(1);
              const isPositive = method.current >= method.previous;
              return (
                <div key={idx} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-sm">{method.method}</span>
                    <span className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {change}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{(method.current / 1000000).toFixed(1)}M</span>
                    <span className="text-gray-400">vs {(method.previous / 1000000).toFixed(1)}M</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
