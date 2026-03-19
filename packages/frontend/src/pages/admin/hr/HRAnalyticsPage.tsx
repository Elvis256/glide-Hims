import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, TrendingUp, TrendingDown, Clock, DollarSign, Calendar,
  Loader2, BarChart3, PieChart, UserCheck, UserX, Briefcase,
  Award, MapPin, Building, Download, Filter, ArrowUpRight,
  ArrowDownRight, AlertCircle, Target, Percent
} from 'lucide-react';
import { toast } from 'sonner';
import { hrService, type PayrollRun, type Employee } from '../../../services/hr';
import { facilitiesService } from '../../../services';
import { formatCurrency } from '../../../lib/currency';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEPT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#e11d48', '#a855f7', '#0ea5e9', '#d946ef',
];

const SALARY_BANDS: { label: string; min: number; max: number }[] = [
  { label: '< 500K', min: 0, max: 500_000 },
  { label: '500K – 1M', min: 500_000, max: 1_000_000 },
  { label: '1M – 1.5M', min: 1_000_000, max: 1_500_000 },
  { label: '1.5M – 2M', min: 1_500_000, max: 2_000_000 },
  { label: '2M+', min: 2_000_000, max: Infinity },
];

const AGE_BANDS = ['<25', '25-30', '31-35', '36-40', '41-45', '46-50', '50+'] as const;
const TENURE_BANDS = ['<1 yr', '1-2 yrs', '2-5 yrs', '5-10 yrs', '10+ yrs'] as const;

function getDeptName(dept: Employee['department']): string {
  if (!dept) return 'Unassigned';
  if (typeof dept === 'string') return dept || 'Unassigned';
  return dept.name || 'Unassigned';
}

function getAge(dob: string | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getTenureYears(hireDate: string | undefined): number | null {
  if (!hireDate) return null;
  const d = new Date(hireDate);
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

function ageBand(age: number): string {
  if (age < 25) return '<25';
  if (age <= 30) return '25-30';
  if (age <= 35) return '31-35';
  if (age <= 40) return '36-40';
  if (age <= 45) return '41-45';
  if (age <= 50) return '46-50';
  return '50+';
}

function tenureBand(years: number): string {
  if (years < 1) return '<1 yr';
  if (years < 2) return '1-2 yrs';
  if (years < 5) return '2-5 yrs';
  if (years < 10) return '5-10 yrs';
  return '10+ yrs';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  iconColor,
  valueColor,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub: string;
  iconColor: string;
  valueColor?: string;
  trend?: { direction: 'up' | 'down'; text: string };
}) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${valueColor ?? ''}`}>{value}</p>
      <div className="flex items-center gap-1 mt-1">
        {trend && (
          trend.direction === 'up'
            ? <ArrowUpRight className="w-3 h-3 text-green-500" />
            : <ArrowDownRight className="w-3 h-3 text-red-500" />
        )}
        <p className="text-xs text-gray-400">{trend ? trend.text : sub}</p>
      </div>
    </div>
  );
}

function HorizontalBar({
  items,
  maxValue,
  total,
}: {
  items: { name: string; count: number }[];
  maxValue: number;
  total: number;
}) {
  if (items.length === 0) return <EmptyState icon={BarChart3} text="No department data" />;
  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0';
        const barPct = maxValue > 0 ? (item.count / maxValue) * 100 : 0;
        const color = DEPT_COLORS[idx % DEPT_COLORS.length];
        return (
          <div key={item.name}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-700 truncate max-w-[60%]">{item.name}</span>
              <span className="text-gray-500 font-medium">{item.count} ({pct}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{ width: `${barPct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <EmptyState icon={PieChart} text="No gender data available" />;

  let cumDeg = 0;
  const gradientParts: string[] = [];
  segments.forEach((seg) => {
    const deg = (seg.value / total) * 360;
    gradientParts.push(`${seg.color} ${cumDeg}deg ${cumDeg + deg}deg`);
    cumDeg += deg;
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="w-40 h-40 rounded-full"
        style={{
          background: `conic-gradient(${gradientParts.join(', ')})`,
          mask: 'radial-gradient(circle at center, transparent 55%, black 55%)',
          WebkitMask: 'radial-gradient(circle at center, transparent 55%, black 55%)',
        }}
      />
      <div className="flex flex-wrap justify-center gap-4">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: seg.color }} />
            <span className="text-gray-600">{seg.label}</span>
            <span className="font-semibold">{seg.value}</span>
            <span className="text-gray-400">({total > 0 ? ((seg.value / total) * 100).toFixed(0) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SimpleBarChart({
  items,
  colorFn,
}: {
  items: { label: string; value: number }[];
  colorFn?: (idx: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (items.every((i) => i.value === 0)) return <EmptyState icon={BarChart3} text="No data" />;
  return (
    <div className="flex items-end gap-2 h-48">
      {items.map((item, idx) => {
        const heightPct = (item.value / max) * 100;
        const color = colorFn ? colorFn(idx) : DEPT_COLORS[idx % DEPT_COLORS.length];
        return (
          <div key={item.label} className="flex flex-col items-center flex-1 min-w-0">
            <span className="text-xs font-medium text-gray-700 mb-1">{item.value || ''}</span>
            <div className="w-full flex justify-center" style={{ height: '160px' }}>
              <div
                className="w-full max-w-[40px] rounded-t transition-all duration-500"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: color,
                  alignSelf: 'flex-end',
                }}
              />
            </div>
            <span className="text-[10px] text-gray-500 mt-1 text-center truncate w-full">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="h-48 flex items-center justify-center text-gray-400">
      <div className="text-center">
        <Icon className="w-12 h-12 mx-auto mb-2" />
        <p>{text}</p>
      </div>
    </div>
  );
}

function Badge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${color}`}>
      {label}
      <span className="bg-white/60 rounded-full px-1.5 text-xs font-bold">{count}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function HRAnalyticsPage() {
  const [dateRange, setDateRange] = useState('30');

  // ------ Facility ------
  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      try { return await facilitiesService.list(); }
      catch { return []; }
    },
  });
  const facilityId = facilities[0]?.id;
  const facilityName = facilities[0]?.name || 'Institution';

  // ------ Dashboard stats ------
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['hr-dashboard', facilityId],
    queryFn: async () => {
      try {
        return await hrService.getDashboard(facilityId);
      } catch {
        return {
          totalEmployees: 0,
          activeEmployees: 0,
          pendingLeaveRequests: 0,
          presentToday: 0,
          absentToday: 0,
        };
      }
    },
    enabled: !!facilityId,
  });

  // ------ Employees ------
  const { data: employeesData } = useQuery({
    queryKey: ['employees', facilityId],
    queryFn: async () => {
      try {
        const res = await hrService.employees.list({ facilityId: facilityId! });
        return Array.isArray(res) ? res : (res as any).data || [];
      } catch { return []; }
    },
    enabled: !!facilityId,
  });
  const employees: Employee[] = employeesData || [];

  // ------ Payroll (current year) ------
  const currentYear = new Date().getFullYear();
  const { data: payrollData } = useQuery({
    queryKey: ['payroll', facilityId, currentYear],
    queryFn: async () => {
      try {
        const res = await hrService.payroll.list({ facilityId: facilityId!, year: currentYear });
        return Array.isArray(res) ? res : (res as any).data || [];
      } catch { return []; }
    },
    enabled: !!facilityId,
  });
  const payrollRuns: PayrollRun[] = payrollData || [];

  // =========================================================================
  // Computed analytics
  // =========================================================================

  // Attendance rate
  const attendanceRate = useMemo(() => {
    if (!dashboard || dashboard.activeEmployees === 0) return 0;
    return Math.round((dashboard.presentToday / dashboard.activeEmployees) * 100);
  }, [dashboard]);

  const attendanceRateColor = useMemo(() => {
    if (attendanceRate >= 90) return 'text-green-600';
    if (attendanceRate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  }, [attendanceRate]);

  // Department breakdown
  const departmentBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach((emp) => {
      const dept = getDeptName(emp.department);
      map[dept] = (map[dept] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [employees]);

  // Gender distribution
  const genderDist = useMemo(() => {
    const counts: Record<string, number> = { Male: 0, Female: 0, Unspecified: 0 };
    employees.forEach((emp) => {
      const g = (emp.gender || '').toLowerCase();
      if (g === 'male' || g === 'm') counts.Male++;
      else if (g === 'female' || g === 'f') counts.Female++;
      else counts.Unspecified++;
    });
    return counts;
  }, [employees]);

  // Employment type
  const employmentTypes = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach((emp) => {
      const t = emp.employmentType || 'unspecified';
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [employees]);

  const empTypeBadgeColor: Record<string, string> = {
    permanent: 'bg-green-100 text-green-800',
    'full-time': 'bg-green-100 text-green-800',
    contract: 'bg-blue-100 text-blue-800',
    'part-time': 'bg-yellow-100 text-yellow-800',
    intern: 'bg-purple-100 text-purple-800',
    unspecified: 'bg-gray-100 text-gray-600',
  };

  // Staff category
  const staffCategories = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach((emp) => {
      const cat = emp.staffCategory || 'Uncategorized';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [employees]);

  // Salary bands
  const salaryBandCounts = useMemo(() => {
    return SALARY_BANDS.map((band) => {
      const count = employees.filter((e) => {
        const sal = e.basicSalary ?? 0;
        return sal >= band.min && sal < band.max;
      }).length;
      return { label: band.label, value: count };
    });
  }, [employees]);

  // Payroll monthly trend (last 6 months)
  const payrollTrend = useMemo(() => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const sorted = [...payrollRuns].sort((a, b) => a.month - b.month);
    const last6 = sorted.slice(-6);
    return last6.map((pr) => ({
      label: months[pr.month - 1] || `M${pr.month}`,
      gross: pr.totalGross,
      deductions: pr.totalDeductions,
      net: pr.totalNet,
      employees: pr.employeeCount,
    }));
  }, [payrollRuns]);

  // Age distribution
  const ageDist = useMemo(() => {
    const counts: Record<string, number> = {};
    AGE_BANDS.forEach((b) => (counts[b] = 0));
    employees.forEach((emp) => {
      const age = getAge(emp.dateOfBirth);
      if (age !== null) counts[ageBand(age)]++;
    });
    return AGE_BANDS.map((b) => ({ label: b, value: counts[b] }));
  }, [employees]);

  // Tenure distribution
  const tenureDist = useMemo(() => {
    const counts: Record<string, number> = {};
    TENURE_BANDS.forEach((b) => (counts[b] = 0));
    employees.forEach((emp) => {
      const yrs = getTenureYears(emp.hireDate);
      if (yrs !== null) counts[tenureBand(yrs)]++;
    });
    return TENURE_BANDS.map((b) => ({ label: b, value: counts[b] }));
  }, [employees]);

  // Department summary (enhanced with salary & gender)
  const departmentSummary = useMemo(() => {
    const map: Record<string, { count: number; totalSalary: number; male: number; female: number }> = {};
    employees.forEach((emp) => {
      const dept = getDeptName(emp.department);
      if (!map[dept]) map[dept] = { count: 0, totalSalary: 0, male: 0, female: 0 };
      map[dept].count++;
      map[dept].totalSalary += emp.basicSalary ?? 0;
      const g = (emp.gender || '').toLowerCase();
      if (g === 'male' || g === 'm') map[dept].male++;
      else if (g === 'female' || g === 'f') map[dept].female++;
    });
    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        count: d.count,
        pct: employees.length > 0 ? ((d.count / employees.length) * 100).toFixed(1) : '0',
        avgSalary: d.count > 0 ? d.totalSalary / d.count : 0,
        male: d.male,
        female: d.female,
      }))
      .sort((a, b) => b.count - a.count);
  }, [employees]);

  // =========================================================================
  // PDF export
  // =========================================================================

  const handleExport = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      // Cover page
      doc.setFontSize(24);
      doc.setTextColor(30, 64, 175);
      doc.text('HR Analytics Report', pageWidth / 2, 60, { align: 'center' });
      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.text(facilityName, pageWidth / 2, 75, { align: 'center' });
      doc.setFontSize(11);
      doc.text(`Generated: ${dateStr}`, pageWidth / 2, 88, { align: 'center' });

      // Workforce summary
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('Workforce Summary', 14, 20);

      autoTable(doc, {
        startY: 28,
        head: [['Metric', 'Value']],
        body: [
          ['Total Employees', String(dashboard?.totalEmployees ?? employees.length)],
          ['Active Employees', String(dashboard?.activeEmployees ?? 0)],
          ['Present Today', String(dashboard?.presentToday ?? 0)],
          ['Absent Today', String(dashboard?.absentToday ?? 0)],
          ['Pending Leave Requests', String(dashboard?.pendingLeaveRequests ?? 0)],
          ['Attendance Rate', `${attendanceRate}%`],
          ['Departments', String(departmentBreakdown.length)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 64, 175] },
      });

      // Department breakdown
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Department Breakdown', 14, 20);

      autoTable(doc, {
        startY: 28,
        head: [['Department', 'Head Count', '% of Total', 'Avg Salary', 'Male', 'Female']],
        body: departmentSummary.map((d) => [
          d.name,
          String(d.count),
          `${d.pct}%`,
          formatCurrency(d.avgSalary),
          String(d.male),
          String(d.female),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [30, 64, 175] },
      });

      // Salary distribution
      if (employees.some((e) => e.basicSalary)) {
        doc.addPage();
        doc.setFontSize(16);
        doc.text('Salary Distribution', 14, 20);

        autoTable(doc, {
          startY: 28,
          head: [['Salary Band', 'Employee Count']],
          body: salaryBandCounts.map((b) => [b.label, String(b.value)]),
          theme: 'grid',
          headStyles: { fillColor: [30, 64, 175] },
        });
      }

      // Employee list (condensed)
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Employee Directory', 14, 20);

      autoTable(doc, {
        startY: 28,
        head: [['#', 'Name', 'Department', 'Job Title', 'Type', 'Status']],
        body: employees.map((emp, idx) => [
          String(idx + 1),
          emp.fullName || '-',
          getDeptName(emp.department),
          emp.jobTitle || '-',
          emp.employmentType || '-',
          emp.status || '-',
        ]),
        theme: 'grid',
        headStyles: { fillColor: [30, 64, 175] },
        styles: { fontSize: 8 },
      });

      // Page numbers
      const totalPages = doc.getNumberOfPages();
      for (let i = 2; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${i - 1} of ${totalPages - 1}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' },
        );
        doc.text(
          `${facilityName} — HR Analytics Report`,
          14,
          doc.internal.pageSize.getHeight() - 10,
        );
      }

      doc.save(`HR_Analytics_${now.toISOString().slice(0, 10)}.pdf`);
      toast.success('HR Analytics report exported successfully');
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Failed to export report');
    }
  };

  // =========================================================================
  // Render
  // =========================================================================

  if (!facilityId) {
    return (
      <div className="p-6 text-center text-gray-500">
        <AlertCircle className="w-10 h-10 mx-auto mb-2 text-gray-400" />
        <p>Please configure a facility first</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR Analytics</h1>
          <p className="text-gray-500">Workforce insights and metrics</p>
        </div>
        <div className="flex gap-3">
          <select
            className="px-4 py-2 border rounded-lg text-sm"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">This Year</option>
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ================================================================
              1. KEY METRICS
          ================================================================ */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard
              icon={Users}
              label="Total Staff"
              value={dashboard?.totalEmployees ?? employees.length}
              sub="All employees"
              iconColor="text-blue-600"
              trend={{ direction: 'up', text: '↗ Active' }}
            />
            <MetricCard
              icon={UserCheck}
              label="Active Staff"
              value={dashboard?.activeEmployees ?? 0}
              sub="Currently employed"
              iconColor="text-green-600"
              valueColor="text-green-600"
            />
            <MetricCard
              icon={Clock}
              label="Present Today"
              value={dashboard?.presentToday ?? 0}
              sub="Checked in"
              iconColor="text-blue-600"
              valueColor="text-blue-600"
            />
            <MetricCard
              icon={Calendar}
              label="Pending Leaves"
              value={dashboard?.pendingLeaveRequests ?? 0}
              sub="Awaiting approval"
              iconColor="text-yellow-600"
              valueColor="text-yellow-600"
            />
            <MetricCard
              icon={UserX}
              label="Absent Today"
              value={dashboard?.absentToday ?? 0}
              sub="Not present"
              iconColor="text-red-600"
              valueColor={(dashboard?.absentToday ?? 0) > 0 ? 'text-red-600' : ''}
            />
            <MetricCard
              icon={Percent}
              label="Attendance Rate"
              value={`${attendanceRate}%`}
              sub="Today"
              iconColor="text-indigo-600"
              valueColor={attendanceRateColor}
            />
          </div>

          {/* ================================================================
              2. WORKFORCE COMPOSITION
          ================================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department bar chart */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                Staff by Department
              </h2>
              <HorizontalBar
                items={departmentBreakdown}
                maxValue={Math.max(...departmentBreakdown.map((d) => d.count), 1)}
                total={employees.length}
              />
            </div>

            {/* Gender donut */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-pink-600" />
                Gender Distribution
              </h2>
              <DonutChart
                segments={[
                  { label: 'Male', value: genderDist.Male, color: '#3b82f6' },
                  { label: 'Female', value: genderDist.Female, color: '#ec4899' },
                  { label: 'Unspecified', value: genderDist.Unspecified, color: '#9ca3af' },
                ]}
              />
            </div>
          </div>

          {/* ================================================================
              3. EMPLOYMENT OVERVIEW
          ================================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Employment type */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-600" />
                Employment Type Breakdown
              </h2>
              {employmentTypes.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {employmentTypes.map(([type, count]) => (
                    <Badge
                      key={type}
                      label={type.charAt(0).toUpperCase() + type.slice(1)}
                      count={count}
                      color={empTypeBadgeColor[type.toLowerCase()] || 'bg-gray-100 text-gray-700'}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Briefcase} text="No employment type data" />
              )}
            </div>

            {/* Staff category */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" />
                Staff Category Distribution
              </h2>
              {staffCategories.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {staffCategories.map(([cat, count], idx) => (
                    <div
                      key={cat}
                      className="p-3 rounded-lg border text-center"
                      style={{ borderLeftColor: DEPT_COLORS[idx % DEPT_COLORS.length], borderLeftWidth: '4px' }}
                    >
                      <p className="text-lg font-bold text-gray-800">{count}</p>
                      <p className="text-xs text-gray-500 capitalize truncate">{cat}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Award} text="No staff category data" />
              )}
            </div>
          </div>

          {/* ================================================================
              4. SALARY ANALYTICS
          ================================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payroll trend */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Payroll Trend ({currentYear})
              </h2>
              {payrollTrend.length > 0 ? (
                <>
                  <SimpleBarChart
                    items={payrollTrend.map((p) => ({ label: p.label, value: p.net }))}
                    colorFn={() => '#10b981'}
                  />
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2">Month</th>
                          <th className="pb-2 text-right">Gross</th>
                          <th className="pb-2 text-right">Deductions</th>
                          <th className="pb-2 text-right">Net</th>
                          <th className="pb-2 text-right">Staff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollTrend.map((p) => (
                          <tr key={p.label} className="border-b last:border-0">
                            <td className="py-2 font-medium">{p.label}</td>
                            <td className="py-2 text-right">{formatCurrency(p.gross, { compact: true })}</td>
                            <td className="py-2 text-right text-red-600">{formatCurrency(p.deductions, { compact: true })}</td>
                            <td className="py-2 text-right text-green-600 font-medium">{formatCurrency(p.net, { compact: true })}</td>
                            <td className="py-2 text-right">{p.employees}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <EmptyState icon={DollarSign} text="No payroll data for this year" />
              )}
            </div>

            {/* Salary distribution */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Salary Distribution
              </h2>
              {employees.some((e) => e.basicSalary) ? (
                <div className="space-y-3">
                  {salaryBandCounts.map((band, idx) => {
                    const maxVal = Math.max(...salaryBandCounts.map((b) => b.value), 1);
                    const pct = (band.value / maxVal) * 100;
                    return (
                      <div key={band.label}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700">{band.label}</span>
                          <span className="text-gray-500 font-medium">{band.value} staff</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div
                            className="h-3 rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: DEPT_COLORS[(idx + 4) % DEPT_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={DollarSign} text="No salary data available" />
              )}
            </div>
          </div>

          {/* ================================================================
              5. AGE & TENURE ANALYSIS
          ================================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-600" />
                Age Distribution
              </h2>
              <SimpleBarChart
                items={ageDist}
                colorFn={(i) => DEPT_COLORS[(i + 2) % DEPT_COLORS.length]}
              />
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-teal-600" />
                Tenure Distribution
              </h2>
              <SimpleBarChart
                items={tenureDist}
                colorFn={(i) => DEPT_COLORS[(i + 7) % DEPT_COLORS.length]}
              />
            </div>
          </div>

          {/* ================================================================
              6. DEPARTMENT SUMMARY TABLE
          ================================================================ */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                Department Summary
              </h2>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-3 pr-4">Department</th>
                    <th className="pb-3 pr-4 text-right">Head Count</th>
                    <th className="pb-3 pr-4 text-right">% of Total</th>
                    <th className="pb-3 pr-4 text-right">Avg Salary</th>
                    <th className="pb-3 pr-4">Gender (M / F)</th>
                    <th className="pb-3 min-w-[120px]">Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentSummary.length > 0 ? (
                    departmentSummary.map((dept, idx) => (
                      <tr key={dept.name} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 pr-4 font-medium text-gray-800">{dept.name}</td>
                        <td className="py-3 pr-4 text-right font-semibold">{dept.count}</td>
                        <td className="py-3 pr-4 text-right">{dept.pct}%</td>
                        <td className="py-3 pr-4 text-right">{formatCurrency(dept.avgSalary)}</td>
                        <td className="py-3 pr-4">
                          <span className="text-blue-600">{dept.male}</span>
                          {' / '}
                          <span className="text-pink-600">{dept.female}</span>
                        </td>
                        <td className="py-3">
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div
                              className="h-2.5 rounded-full"
                              style={{
                                width: `${employees.length > 0 ? (dept.count / employees.length) * 100 : 0}%`,
                                backgroundColor: DEPT_COLORS[idx % DEPT_COLORS.length],
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        No departments found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
