import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Eye,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import hrService from '../../services/hr';
import type { Payslip } from '../../services/hr';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December'];

export default function MyPayslipsPage() {
  const { user } = useAuthStore();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  const { data: payslips = [], isLoading, error } = useQuery({
    queryKey: ['my-payslips', selectedYear],
    queryFn: () => hrService.payroll.getMyPayslips(selectedYear === 0 ? undefined : selectedYear),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (isPaid: boolean) => {
    return isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
  };

  const getMonthName = (payslip: Payslip) => {
    return MONTHS[payslip.payrollRun?.month || 0];
  };

  const totalEarnings = payslips.reduce((sum, p) => sum + (p.netSalary || 0), 0);
  const totalDeductions = payslips.reduce((sum, p) => sum + (p.totalDeductions || 0), 0);

  // Generate year options
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Payslips</h1>
          <p className="text-gray-600">View and download your salary statements</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value={0}>All Years</option>
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Net Earnings</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalEarnings)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Deductions</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalDeductions)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Payslips Count</p>
              <p className="text-xl font-bold text-gray-900">{payslips.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payslips List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Payslip History</h2>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading payslips...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">
            Failed to load payslips. Please try again.
          </div>
        ) : payslips.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No payslips found for the selected period</p>
            <p className="text-sm mt-2">Payslips will appear here once payroll is processed.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {payslips.map((payslip) => (
              <div
                key={payslip.id}
                className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {getMonthName(payslip)} {payslip.payrollRun?.year}
                    </p>
                    <p className="text-sm text-gray-500">
                      {payslip.isPaid && payslip.paidDate
                        ? `Paid on ${new Date(payslip.paidDate).toLocaleDateString()}`
                        : 'Pending'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Net Salary</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(payslip.netSalary)}</p>
                  </div>
                  
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(payslip.isPaid)}`}>
                    {payslip.isPaid ? 'Paid' : 'Pending'}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedPayslip(payslip)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        // TODO: Implement PDF download endpoint
                        toast.success(`PDF download coming soon for ${getMonthName(payslip)} ${payslip.payrollRun?.year}`);
                      }}
                      className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payslip Detail Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Payslip - {getMonthName(selectedPayslip)} {selectedPayslip.payrollRun?.year}
              </h3>
              <button
                onClick={() => setSelectedPayslip(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Employee</p>
                  <p className="font-medium">{user?.fullName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pay Period</p>
                  <p className="font-medium">{getMonthName(selectedPayslip)} {selectedPayslip.payrollRun?.year}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Days Worked</p>
                  <p className="font-medium">{selectedPayslip.daysWorked}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedPayslip.isPaid)}`}>
                    {selectedPayslip.isPaid ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
              
              <hr />
              
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">Earnings</h4>
                <div className="flex justify-between">
                  <span className="text-gray-600">Basic Salary</span>
                  <span className="font-medium">{formatCurrency(selectedPayslip.basicSalary)}</span>
                </div>
                {selectedPayslip.overtimePay > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Overtime Pay ({selectedPayslip.overtimeHours} hrs)</span>
                    <span className="font-medium">{formatCurrency(selectedPayslip.overtimePay)}</span>
                  </div>
                )}
                {Object.entries(selectedPayslip.allowances || {}).map(([name, amount]) => (
                  <div key={name} className="flex justify-between">
                    <span className="text-gray-600 capitalize">{name.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{formatCurrency(amount as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-medium border-t pt-2">
                  <span>Gross Salary</span>
                  <span>{formatCurrency(selectedPayslip.grossSalary)}</span>
                </div>
              </div>
              
              <hr />
              
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">Deductions</h4>
                <div className="flex justify-between text-red-600">
                  <span>PAYE Tax</span>
                  <span>-{formatCurrency(selectedPayslip.paye)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>NSSF (Employee)</span>
                  <span>-{formatCurrency(selectedPayslip.nssfEmployee)}</span>
                </div>
                {Object.entries(selectedPayslip.otherDeductions || {}).map(([name, amount]) => (
                  <div key={name} className="flex justify-between text-red-600">
                    <span className="capitalize">{name.replace(/_/g, ' ')}</span>
                    <span>-{formatCurrency(amount as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-medium text-red-600 border-t pt-2">
                  <span>Total Deductions</span>
                  <span>-{formatCurrency(selectedPayslip.totalDeductions)}</span>
                </div>
              </div>
              
              <hr />
              
              <div className="flex justify-between text-lg font-bold">
                <span>Net Salary</span>
                <span className="text-green-600">{formatCurrency(selectedPayslip.netSalary)}</span>
              </div>
              
              <div className="pt-4">
                <button
                  onClick={() => {
                    toast.success(`PDF download coming soon for ${getMonthName(selectedPayslip)} ${selectedPayslip.payrollRun?.year}`);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
