import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Download,
  RefreshCw,
  FileText,
} from 'lucide-react';
import api from '../../../services/api';
import { toast } from 'sonner';

interface StandardReportDto {
  id: string;
  name: string;
  description: string;
  reportType: string;
}

interface ReportData {
  reportName: string;
  generatedAt: Date;
  periodCovered: string;
  rows: any[];
  summary?: {
    totalRows: number;
    totalValues?: Record<string, number>;
  };
}

const CustomReportBuilderPage: React.FC = () => {
  const [reportType, setReportType] = useState<string>('trial-balance');
  const [period, setPeriod] = useState<string>(
    new Date().toISOString().substring(0, 7),
  );
  const [budget, setBudget] = useState<string>('');
  const [generatedReport, setGeneratedReport] = useState<ReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: standardReports, isLoading: reportsLoading } = useQuery({
    queryKey: ['standard-reports'],
    queryFn: async () => {
      const response = await api.get('/finance/reports/standard');
      return response.data.data as StandardReportDto[];
    },
  });

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const response = await api.post('/finance/reports/generate', {
        reportType,
        period,
        budget: budget || undefined,
      });
      setGeneratedReport(response.data.data);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportCSV = async () => {
    if (!generatedReport) return;

    try {
      const response = await api.post('/finance/reports/export-csv', {
        reportType,
        period,
        budget: budget || undefined,
      });

      const blob = new Blob([response.data.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        response.data.fileName ||
        `${reportType}-${period}-${Date.now()}.csv`;
      a.click();
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Custom Report Builder
          </h1>
          <p className="text-gray-600 mt-2">
            Generate and customize GL reports with various report types
          </p>
        </div>

        {/* Report Configuration */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Report Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Type
              </label>
              <select
                value={reportType}
                onChange={(e) => {
                  setReportType(e.target.value);
                  setGeneratedReport(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="trial-balance">Trial Balance</option>
                <option value="income-statement">Income Statement</option>
                <option value="balance-sheet">Balance Sheet</option>
                <option value="variance">Budget vs Actual Variance</option>
              </select>
              {reportsLoading ? (
                <p className="text-xs text-gray-500 mt-1">Loading reports...</p>
              ) : (
                standardReports && (
                  <p className="text-xs text-gray-500 mt-1">
                    {
                      standardReports.find(
                        (r) => r.reportType === reportType,
                      )?.description
                    }
                  </p>
                )
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Period
              </label>
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {reportType === 'variance' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget Period (Optional)
                </label>
                <input
                  type="month"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Leave blank for same period"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Generate Report
            </button>

            {generatedReport && (
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Export as CSV
              </button>
            )}
          </div>
        </div>

        {/* Standard Reports Grid */}
        {!generatedReport && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <h2 className="col-span-full text-lg font-semibold text-gray-900">
              Available Report Templates
            </h2>
            {reportsLoading ? (
              <div className="col-span-full p-6 text-center">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
              </div>
            ) : (
              standardReports?.map((report) => (
                <div
                  key={report.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                  onClick={() => {
                    setReportType(report.reportType);
                    setGeneratedReport(null);
                  }}
                >
                  <div className="flex items-start">
                    <FileText className="w-6 h-6 text-blue-500 mr-3 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {report.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {report.description}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportType(report.reportType);
                          handleGenerateReport();
                        }}
                        className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        Generate Now →
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Generated Report */}
        {generatedReport && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {generatedReport.reportName}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Period: {generatedReport.periodCovered}
                  </p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  Generated:{' '}
                  {new Date(generatedReport.generatedAt).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Summary */}
            {generatedReport.summary && (
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-900">
                  Total Rows: {generatedReport.summary.totalRows}
                </p>
                {generatedReport.summary.totalValues &&
                  Object.entries(generatedReport.summary.totalValues).map(
                    ([key, value]) => (
                      <p key={key} className="text-sm text-gray-600 mt-1">
                        {key}: {(value as number).toFixed(2)}
                      </p>
                    ),
                  )}
              </div>
            )}

            {/* Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {generatedReport.rows.length > 0 &&
                      Object.keys(generatedReport.rows[0]).map((key) => (
                        <th
                          key={key}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase"
                        >
                          {key}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {generatedReport.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {Object.values(row).map((value, cidx) => (
                        <td key={cidx} className="px-6 py-4 text-gray-600">
                          {typeof value === 'number'
                            ? value.toFixed(2)
                            : String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-between">
              <button
                onClick={() => setGeneratedReport(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back to Configuration
              </button>
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Export as CSV
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomReportBuilderPage;
