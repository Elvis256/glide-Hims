import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DollarSign, Users, Calendar, FileText, Download, Plus, Loader2, Play, Eye, X, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { hrService, type PayrollRun, type Payslip, type Employee } from '../../../services/hr';
import { facilitiesService } from '../../../services';
import { formatCurrency } from '../../../lib/currency';
import { useInstitutionInfo } from '../../../lib/useInstitutionInfo';
import { generatePayslipPDF } from '../../../utils/hr-pdf-generator';

export default function PayrollPage() {
  const inst = useInstitutionInfo();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPayslipsModal, setShowPayslipsModal] = useState<string | null>(null);
  const [expandedPayslip, setExpandedPayslip] = useState<string | null>(null);
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const queryClient = useQueryClient();

  // Get facility
  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      try { return await facilitiesService.list(); } 
      catch (error) { console.error('Failed to load facilities:', error); toast.error('Failed to load facilities'); return []; }
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
      } catch (error) { console.error('Failed to load employees:', error); toast.error('Failed to load employee data'); return []; }
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
      } catch (error) { console.error('Failed to load payroll runs:', error); toast.error('Failed to load payroll data'); return []; }
    },
    enabled: !!facilityId,
  });

  // Fetch payslips for modal
  const { data: payslips = [], isLoading: payslipsLoading } = useQuery({
    queryKey: ['payslips', showPayslipsModal],
    queryFn: () => hrService.payroll.getPayslips(showPayslipsModal!),
    enabled: !!showPayslipsModal,
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
      payDate: currentRun?.status === 'paid' ? 'Paid' : currentRun?.status === 'completed' ? 'Completed' : currentRun ? 'Pending' : '--',
      payslipsGenerated: currentRun?.status === 'completed' || currentRun?.status === 'paid' ? currentRun.employeeCount : 0,
    };
  }, [payrollRuns, employees, selectedMonth]);

  // Create payroll mutation
  const createMutation = useMutation({
    mutationFn: async (data: { month: number; year: number }) => {
      return hrService.payroll.create({ facilityId: facilityId!, month: data.month, year: data.year });
    },
    onSuccess: () => {
      toast.success('Payroll run created');
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      setShowCreateModal(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create payroll'),
  });

  // Process payroll mutation
  const processMutation = useMutation({
    mutationFn: async (id: string) => {
      return hrService.payroll.process(id);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      if (result.employeeCount === 0) {
        toast.error('No employees with salary configured. Set basic salary in Staff Directory first.');
      } else {
        toast.success(`Payroll processed for ${result.employeeCount} employees. Net: ${formatCurrency(result.totalNet)}`);
      }
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to process payroll'),
  });

  // Reset payroll mutation
  const resetMutation = useMutation({
    mutationFn: async (id: string) => {
      return hrService.payroll.reset(id);
    },
    onSuccess: () => {
      toast.success('Payroll run reset to draft. Set staff salaries in Staff Directory, then process again.');
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to reset payroll'),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => hrService.payroll.approve(id),
    onSuccess: () => {
      toast.success('Payroll approved. You can now process it.');
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to approve payroll'),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => hrService.payroll.markPaid(id),
    onSuccess: () => {
      toast.success('Payroll marked as paid');
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to mark paid'),
  });

  const handleExport = async (id: string, type: 'paye' | 'nssf' | 'bank') => {
    try {
      await hrService.payroll.downloadExport(id, type);
      toast.success(`${type.toUpperCase()} export downloaded`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Export failed');
    }
  };

  const handleCreatePayroll = () => {
    createMutation.mutate({ month: newMonth, year: newYear });
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    approved: 'bg-purple-100 text-purple-800',
    processing: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    paid: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
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
              <p className="text-sm text-gray-500">Total Staff</p>
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
              <p className="text-sm text-gray-500">Total Net Pay</p>
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

      {/* Salary Warning */}
      {employees.length > 0 && employees.filter((e: Employee) => !e.basicSalary || Number(e.basicSalary) <= 0).length === employees.length && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-amber-800 font-medium">⚠️ No staff have salary configured</p>
          <p className="text-amber-600 text-sm mt-1">
            Go to <a href="/hr/staff" className="underline font-medium">Staff Directory</a> → Edit staff → set Basic Salary, Allowances, and Deductions before processing payroll.
          </p>
        </div>
      )}

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
                    <td className="p-4 text-gray-600">{run.employeeCount || 0}</td>
                    <td className="p-4 text-gray-600">{formatCurrency(run.totalGross || 0)}</td>
                    <td className="p-4 text-red-600">{formatCurrency(run.totalDeductions || 0)}</td>
                    <td className="p-4 text-green-600 font-medium">{formatCurrency(run.totalNet || 0)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[run.status] || 'bg-gray-100'}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 flex-wrap">
                        {run.status === 'draft' && (
                          <button
                            onClick={() => approveMutation.mutate(run.id)}
                            disabled={approveMutation.isPending}
                            className="px-2 py-1 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 rounded"
                            title="Approve (Draft → Approved)"
                          >
                            Approve
                          </button>
                        )}
                        {run.status === 'approved' && (
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
                        {(run.status === 'completed' || run.status === 'paid') && (
                          <button
                            onClick={() => setShowPayslipsModal(run.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="View Payslips"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {run.status === 'completed' && (
                          <button
                            onClick={() => {
                              if (confirm('Mark this payroll as paid? This is a final action.')) {
                                markPaidMutation.mutate(run.id);
                              }
                            }}
                            disabled={markPaidMutation.isPending}
                            className="px-2 py-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded"
                            title="Mark as Paid"
                          >
                            Mark Paid
                          </button>
                        )}
                        {(run.status === 'completed' || run.status === 'paid') && (
                          <>
                            <button
                              onClick={() => handleExport(run.id, 'paye')}
                              className="px-2 py-1 text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
                              title="Export PAYE CSV"
                            >
                              PAYE
                            </button>
                            <button
                              onClick={() => handleExport(run.id, 'nssf')}
                              className="px-2 py-1 text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
                              title="Export NSSF CSV"
                            >
                              NSSF
                            </button>
                            <button
                              onClick={() => handleExport(run.id, 'bank')}
                              className="px-2 py-1 text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
                              title="Export Bank CSV"
                            >
                              Bank
                            </button>
                          </>
                        )}
                        {run.status === 'completed' && run.status !== 'paid' && (
                          <button
                            onClick={() => {
                              if (confirm('Reset this payroll run to draft? This will delete all generated payslips.')) {
                                resetMutation.mutate(run.id);
                              }
                            }}
                            disabled={resetMutation.isPending}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"
                            title="Reset to Draft"
                          >
                            {resetMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </button>
                        )}
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
                This will create a draft payroll run. Click the Process button to calculate salaries.
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

      {/* View Payslips Modal */}
      {showPayslipsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Payslips</h2>
              <button onClick={() => { setShowPayslipsModal(null); setExpandedPayslip(null); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {payslipsLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                </div>
              ) : payslips.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No payslips found</p>
              ) : (
                <div className="space-y-2">
                  {payslips.map((slip: Payslip) => (
                    <div key={slip.id} className="border rounded-lg">
                      <button
                        onClick={() => setExpandedPayslip(expandedPayslip === slip.id ? null : slip.id)}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-left">
                            <p className="font-medium">{slip.employee?.fullName || 'Unknown'}</p>
                            <p className="text-sm text-gray-500">{slip.employee?.jobTitle || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Gross</p>
                            <p className="font-medium">{formatCurrency(slip.grossSalary)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Net</p>
                            <p className="font-medium text-green-600">{formatCurrency(slip.netSalary)}</p>
                          </div>
                          {expandedPayslip === slip.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </button>
                      {expandedPayslip === slip.id && (
                        <div className="border-t p-4 bg-gray-50">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 mb-1 font-medium">Earnings</p>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span>Basic Salary</span>
                                  <span>{formatCurrency(slip.basicSalary)}</span>
                                </div>
                                {slip.allowances?.map((a, i) => (
                                  <div key={i} className="flex justify-between text-gray-600">
                                    <span>{a.name}</span>
                                    <span>{formatCurrency(a.amount)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between font-medium border-t pt-1">
                                  <span>Gross Salary</span>
                                  <span>{formatCurrency(slip.grossSalary)}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1 font-medium">Deductions</p>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span>PAYE</span>
                                  <span className="text-red-600">{formatCurrency(slip.paye)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>NSSF (Employee)</span>
                                  <span className="text-red-600">{formatCurrency(slip.nssfEmployee)}</span>
                                </div>
                                <div className="flex justify-between text-gray-400">
                                  <span>NSSF (Employer)</span>
                                  <span>{formatCurrency(slip.nssfEmployer)}</span>
                                </div>
                                {slip.otherDeductions?.map((d, i) => (
                                  <div key={i} className="flex justify-between text-gray-600">
                                    <span>{d.name}</span>
                                    <span className="text-red-600">{formatCurrency(d.amount)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between font-medium border-t pt-1">
                                  <span>Total Deductions</span>
                                  <span className="text-red-600">{formatCurrency(slip.totalDeductions)}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1 font-medium">Summary</p>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span>Days Worked</span>
                                  <span>{slip.daysWorked}</span>
                                </div>
                                <div className="flex justify-between font-semibold text-green-600 border-t pt-1 text-base">
                                  <span>Net Pay</span>
                                  <span>{formatCurrency(slip.netSalary)}</span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    try {
                                      generatePayslipPDF(slip, {
                                        id: slip.employeeId || '',
                                        fullName: slip.employee?.fullName || 'Employee',
                                        jobTitle: slip.employee?.jobTitle,
                                        department: slip.employee?.department,
                                      }, inst);
                                      toast.success(`Payslip PDF downloaded for ${slip.employee?.fullName}`);
                                    } catch {
                                      toast.error('Failed to generate payslip PDF');
                                    }
                                  }}
                                  className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Download PDF
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Totals */}
                  <div className="border-t-2 border-gray-300 pt-3 mt-3">
                    <div className="flex justify-between text-sm font-semibold px-4">
                      <span>Total ({payslips.length} employees)</span>
                      <div className="flex gap-8">
                        <span>Gross: {formatCurrency(payslips.reduce((s: number, p: Payslip) => s + Number(p.grossSalary), 0))}</span>
                        <span className="text-red-600">Deductions: {formatCurrency(payslips.reduce((s: number, p: Payslip) => s + Number(p.totalDeductions), 0))}</span>
                        <span className="text-green-600">Net: {formatCurrency(payslips.reduce((s: number, p: Payslip) => s + Number(p.netSalary), 0))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
