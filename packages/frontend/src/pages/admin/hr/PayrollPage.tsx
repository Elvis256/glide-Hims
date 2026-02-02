import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Users, Calendar, FileText, Download, Plus, Loader2, Play, Eye } from 'lucide-react';
import { hrService, type PayrollRun, type Employee } from '../../../services/hr';
import { facilitiesService } from '../../../services';

export default function PayrollPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const queryClient = useQueryClient();

  // Get facility
  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      try { return await facilitiesService.list(); } 
      catch { return []; }
    },
  });
  const facilityId = facilities[0]?.id;

  // Fetch employees
  const { data: employeesData } = useQuery({
    queryKey: ['employees', facilityId],
    queryFn: async () => {
      try {
        const res = await hrService.employees.list({ facilityId: facilityId! });
        return Array.isArray(res) ? res : (res as { data: Employee[] }).data || [];
      } catch { return []; }
    },
    enabled: !!facilityId,
  });
  const employees = employeesData || [];

  // Fetch payroll runs
  const { data: payrollRuns = [], isLoading } = useQuery({
    queryKey: ['payroll', facilityId, parseInt(selectedMonth.split('-')[0])],
    queryFn: async () => {
      try {
        return await hrService.payroll.list({ 
          facilityId, 
          year: parseInt(selectedMonth.split('-')[0]) 
        });
      } catch { return []; }
    },
    enabled: !!facilityId,
  });

  // Stats
  const stats = useMemo(() => {
    const currentRun = payrollRuns.find((p: PayrollRun) => 
      p.month === parseInt(selectedMonth.split('-')[1]) && 
      p.year === parseInt(selectedMonth.split('-')[0])
    );
    return {
      totalEmployees: employees.length,
      totalPayroll: currentRun?.totalNet || 0,
      payDate: currentRun?.status === 'paid' ? 'Paid' : currentRun ? 'Pending' : '--',
      payslipsGenerated: currentRun?.status === 'processed' || currentRun?.status === 'paid' ? employees.length : 0,
    };
  }, [payrollRuns, employees, selectedMonth]);

  // Create payroll mutation
  const createMutation = useMutation({
    mutationFn: async (data: { month: number; year: number }) => {
      return hrService.payroll.create({ facilityId: facilityId!, month: data.month, year: data.year });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      setShowCreateModal(false);
    },
  });

  // Process payroll mutation
  const processMutation = useMutation({
    mutationFn: async (id: string) => {
      return hrService.payroll.process(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });

  const handleCreatePayroll = () => {
    createMutation.mutate({ month: newMonth, year: newYear });
  };

  const formatCurrency = (amount: number) => {
    return `UGX ${amount.toLocaleString()}`;
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    processing: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    paid: 'bg-blue-100 text-blue-800',
  };

  if (!facilityId) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Please configure a facility first</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Management</h1>
          <p className="text-gray-500">Process and manage staff payroll</p>
        </div>
        <div className="flex gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          />
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Payslips
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Payroll
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Employees</p>
              <p className="text-2xl font-bold">{stats.totalEmployees}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Payroll</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPayroll)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pay Status</p>
              <p className="text-2xl font-bold">{stats.payDate}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Payslips Generated</p>
              <p className="text-2xl font-bold">{stats.payslipsGenerated}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">Payroll Runs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Period</th>
                <th className="text-left p-4 font-medium text-gray-600">Employees</th>
                <th className="text-left p-4 font-medium text-gray-600">Gross</th>
                <th className="text-left p-4 font-medium text-gray-600">Deductions</th>
                <th className="text-left p-4 font-medium text-gray-600">Net Pay</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                  </td>
                </tr>
              ) : payrollRuns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No payroll records for this period</p>
                    <p className="text-sm">Create a payroll run to get started</p>
                  </td>
                </tr>
              ) : (
                payrollRuns.map((run: PayrollRun) => (
                  <tr key={run.id} className="border-t hover:bg-gray-50">
                    <td className="p-4 font-medium">
                      {new Date(run.year, run.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="p-4 text-gray-600">{employees.length}</td>
                    <td className="p-4 text-gray-600">{formatCurrency(run.totalGross || 0)}</td>
                    <td className="p-4 text-red-600">{formatCurrency(run.totalDeductions || 0)}</td>
                    <td className="p-4 text-green-600 font-medium">{formatCurrency(run.totalNet || 0)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[run.status]}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {run.status === 'draft' && (
                          <button
                            onClick={() => processMutation.mutate(run.id)}
                            disabled={processMutation.isPending}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                            title="Process Payroll"
                          >
                            {processMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="View Payslips">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg" title="Download">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Payroll Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Create Payroll Run</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Month</label>
                  <select
                    value={newMonth}
                    onChange={(e) => setNewMonth(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2000, i).toLocaleDateString('en-US', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Year</label>
                  <select
                    value={newYear}
                    onChange={(e) => setNewYear(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {[2024, 2025, 2026, 2027].map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                This will create a payroll run for {employees.length} active employees.
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleCreatePayroll}
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
