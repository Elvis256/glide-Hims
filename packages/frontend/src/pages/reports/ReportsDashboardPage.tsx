import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Users,
  DollarSign,
  Package,
  TrendingUp,
  FileText,
  Activity,
  AlertTriangle,
  Boxes,
  ClipboardList,
  Banknote,
  Calendar,
  ArrowRight,
  Download,
  Printer,
} from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../lib/currency';

export default function ReportsDashboardPage() {
  // Fetch summary statistics
  const { data: stats } = useQuery({
    queryKey: ['reports-dashboard-stats'],
    queryFn: async () => {
      const [patients, encounters, billing] = await Promise.all([
        api.get('/patients?limit=1').catch(() => ({ data: { total: 0 } })),
        api.get('/encounters?limit=1').catch(() => ({ data: { total: 0 } })),
        api.get('/billing/invoices?limit=1').catch(() => ({ data: { total: 0, totalAmount: 0 } })),
      ]);
      return {
        totalPatients: patients.data?.total || 0,
        totalEncounters: encounters.data?.total || 0,
        totalInvoices: billing.data?.total || 0,
      };
    },
  });

  const reportCategories = [
    {
      title: 'Clinical Reports',
      icon: Activity,
      color: 'bg-blue-500',
      reports: [
        { name: 'Patient Statistics', href: '/reports/patients', icon: Users, description: 'Demographics, registrations, and patient trends' },
        { name: 'Visit Reports', href: '/reports/visits', icon: ClipboardList, description: 'Encounter history and visit patterns' },
        { name: 'Disease Statistics', href: '/reports/diseases', icon: Activity, description: 'Diagnosis trends and disease prevalence' },
        { name: 'Mortality Reports', href: '/reports/mortality', icon: FileText, description: 'Mortality statistics and causes' },
      ],
    },
    {
      title: 'Financial Reports',
      icon: DollarSign,
      color: 'bg-green-500',
      reports: [
        { name: 'Revenue Reports', href: '/reports/revenue', icon: TrendingUp, description: 'Income analysis and revenue trends' },
        { name: 'Collection Reports', href: '/reports/collections', icon: Banknote, description: 'Payment collections and cash flow' },
        { name: 'Outstanding Reports', href: '/reports/outstanding', icon: AlertTriangle, description: 'Unpaid invoices and aging analysis' },
      ],
    },
    {
      title: 'Inventory Reports',
      icon: Package,
      color: 'bg-purple-500',
      reports: [
        { name: 'Stock Reports', href: '/reports/stock', icon: Boxes, description: 'Current stock levels and valuation' },
        { name: 'Expiry Reports', href: '/reports/expiry', icon: AlertTriangle, description: 'Items nearing or past expiry date' },
        { name: 'Consumption Reports', href: '/reports/consumption', icon: BarChart3, description: 'Usage patterns and consumption trends' },
      ],
    },
  ];

  const quickStats = [
    { label: 'Total Patients', value: stats?.totalPatients || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Total Encounters', value: stats?.totalEncounters || 0, icon: ClipboardList, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Total Invoices', value: stats?.totalInvoices || 0, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-100' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports Dashboard</h1>
          <p className="text-gray-600">Access all hospital reports and analytics</p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="h-4 w-4" />
            Export All
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickStats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Report Period:</span>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg font-medium">Today</button>
            <button className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">This Week</button>
            <button className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">This Month</button>
            <button className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">This Year</button>
            <button className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Custom</button>
          </div>
        </div>
      </div>

      {/* Report Categories */}
      <div className="space-y-6">
        {reportCategories.map((category) => (
          <div key={category.title} className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex items-center gap-3">
              <div className={`p-2 rounded-lg ${category.color}`}>
                <category.icon className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{category.title}</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.reports.map((report) => (
                  <Link
                    key={report.href}
                    to={report.href}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-100">
                        <report.icon className="h-5 w-5 text-gray-600 group-hover:text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900 group-hover:text-blue-600">{report.name}</h3>
                          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Reports */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recently Generated Reports</h2>
        </div>
        <div className="p-4">
          <div className="text-center text-gray-500 py-8">
            <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>No recent reports generated</p>
            <p className="text-sm">Select a report category above to generate a new report</p>
          </div>
        </div>
      </div>
    </div>
  );
}
