import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFacilityId } from '../../lib/facility';
import { labService } from '../../services/lab';
import { facilitiesService } from '../../services/facilities';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FileText,
  Search,
  Printer,
  Mail,
  Download,
  Eye,
  CheckCircle,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  X,
  Phone,
  MessageSquare,
  Send,
  Share2,
  Copy,
  FileCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface TestResult {
  parameter: string;
  date: string;
  value: number;
  unit: string;
  referenceRange: string;
  status: 'Normal' | 'Abnormal' | 'Critical';
}

interface PatientTest {
  id: string;
  testName: string;
  category: string;
  results: TestResult[];
  doctorReviewed: boolean;
  lastReportDate: string;
}

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  email?: string;
  phone?: string;
  tests: PatientTest[];
}

const reportTemplates = ['Standard Report', 'Detailed Report', 'Summary Only', 'Trend Analysis'];

// Share method types
type ShareMethod = 'email' | 'whatsapp' | 'sms' | 'copy';

export default function LabReportsPage() {
  const { hasPermission } = usePermissions();
  const facilityId = useFacilityId();
  
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedTest, setSelectedTest] = useState<PatientTest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('Standard Report');
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  
  // Modal states
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [shareMethod, setShareMethod] = useState<ShareMethod>('email');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Facility name for sharing
  const { data: facilityInfo } = useQuery({
    queryKey: ['facility-info'],
    queryFn: () => facilitiesService.getPublicInfo(),
    staleTime: Infinity,
  });
  const hospitalNameForShare = facilityInfo?.name || 'Glide HIMS';

  // Fetch patients with lab results
  const { data: patientsData, isLoading: loadingPatients } = useQuery({
    queryKey: ['lab-report-patients', facilityId],
    queryFn: async (): Promise<Patient[]> => {
      try {
        // Get completed lab orders to find patients with results
        const orders = await labService.orders.list({ 
          facilityId, 
          status: 'completed' 
        });
        
        // Group by patient and build patient test records
        const patientMap = new Map<string, Patient>();
        
        for (const order of orders) {
          if (!order.patient) continue;
          
          const patientId = order.patient.id;
          if (!patientMap.has(patientId)) {
            const patientData = order.patient as any;
            let age = 0;
            if (patientData.dateOfBirth) {
              const dob = new Date(patientData.dateOfBirth);
              const today = new Date();
              age = today.getFullYear() - dob.getFullYear();
              const monthDiff = today.getMonth() - dob.getMonth();
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
            }
            patientMap.set(patientId, {
              id: order.patient.mrn || patientId,
              name: order.patient.fullName || 'Unknown',
              age,
              gender: patientData.gender || 'Unknown',
              email: patientData.email,
              phone: patientData.phone,
              tests: [],
            });
          }
          
          const patient = patientMap.get(patientId)!;
          
          // Add tests from this order
          for (const test of order.tests || []) {
            const params = (test.result as any)?.parameters || [];
            if (params.length === 0) continue;
            
            const testName = test.testName || test.name || '';
            const existingTest = patient.tests.find(t => t.testName === testName);
            
            const testResults: TestResult[] = params.map((p: any) => {
              const flag = p.abnormalFlag;
              let status: 'Normal' | 'Abnormal' | 'Critical' = 'Normal';
              if (flag === 'critical_high' || flag === 'critical_low' || flag === 'critical') status = 'Critical';
              else if (flag === 'high' || flag === 'low' || flag === 'abnormal') status = 'Abnormal';
              
              return {
                parameter: p.parameter || 'Result',
                date: order.completedAt || order.createdAt,
                value: parseFloat(p.value) || parseFloat(p.numericValue) || 0,
                unit: p.unit || '',
                referenceRange: p.referenceRange || (p.referenceMin && p.referenceMax ? `${p.referenceMin}-${p.referenceMax}` : ''),
                status,
              };
            });
            
            if (existingTest) {
              existingTest.results.push(...testResults);
            } else {
              patient.tests.push({
                id: test.id,
                testName,
                category: test.category || 'General',
                results: testResults,
                doctorReviewed: params.some((p: any) => p.status === 'validated' || p.status === 'released'),
                lastReportDate: order.completedAt || order.createdAt,
              });
            }
          }
        }
        
        if (patientMap.size > 0) {
          return Array.from(patientMap.values());
        }
      } catch (error) {
        throw error;
      }
      
      return [];
    },
  });

  const patients = patientsData || [];

  if (!hasPermission('lab.read')) {
    return <AccessDenied />;
  }

  const filteredPatients = useMemo(() => {
    return patients.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [patients, searchTerm]);

  const toggleTestExpand = (testId: string) => {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  const statusColors = {
    Normal: 'bg-green-100 text-green-700',
    Abnormal: 'bg-orange-100 text-orange-700',
    Critical: 'bg-red-100 text-red-700',
  };

  // Calculate stats
  const patientCount = patients.length;
  const pendingReviewCount = patients.reduce(
    (count, p) => count + p.tests.filter(t => !t.doctorReviewed).length, 
    0
  );

  // Generate report content
  const generateReportContent = (): string => {
    if (!selectedPatient) return '';
    
    let content = `LAB REPORT\n${'='.repeat(50)}\n\n`;
    content += `Patient: ${selectedPatient.name}\n`;
    content += `MRN: ${selectedPatient.id}\n`;
    content += `Age/Gender: ${selectedPatient.age} years / ${selectedPatient.gender}\n`;
    content += `Report Date: ${new Date().toLocaleDateString()}\n`;
    content += `Template: ${selectedTemplate}\n\n`;
    content += `${'='.repeat(50)}\nTEST RESULTS\n${'='.repeat(50)}\n\n`;
    
    for (const test of selectedPatient.tests) {
      content += `${test.testName} (${test.category})\n`;
      content += `-`.repeat(40) + '\n';
      
      for (const result of test.results) {
        const flag = result.status !== 'Normal' ? ` [${result.status}]` : '';
        content += `  ${result.parameter}: ${result.value} ${result.unit}  (Ref: ${result.referenceRange})${flag}\n`;
      }
      content += '\n';
    }
    
    content += `${'='.repeat(50)}\n`;
    content += `Generated by HIMS Lab System\n`;
    
    return content;
  };

  // Handle print — opens a dedicated print window with full report
  const handlePrint = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient first');
      return;
    }
    
    let hospitalName = hospitalNameForShare;
    
    const testRows = selectedPatient.tests.map(test => {
      const paramRows = test.results.map(r => {
        const rowClass = r.status === 'Critical' ? 'background:#fef2f2;' : r.status === 'Abnormal' ? 'background:#fff7ed;' : '';
        const flagStyle = r.status === 'Critical' ? 'color:#dc2626;font-weight:bold;' : r.status === 'Abnormal' ? 'color:#ea580c;font-weight:bold;' : '';
        return `<tr style="${rowClass}"><td style="padding:4px 8px;">${r.parameter}</td><td style="padding:4px 8px;font-weight:500;${flagStyle}">${r.value}</td><td style="padding:4px 8px;color:#666;">${r.unit}</td><td style="padding:4px 8px;color:#666;">${r.referenceRange}</td><td style="padding:4px 8px;${flagStyle}">${r.status}</td></tr>`;
      }).join('');
      return `<h3 style="margin:16px 0 4px;font-size:14px;">${test.testName} <span style="color:#888;font-weight:normal;">(${test.category})</span></h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #ddd;">
        <thead><tr style="background:#f3f4f6;"><th style="padding:6px 8px;text-align:left;">Parameter</th><th style="padding:6px 8px;text-align:left;">Value</th><th style="padding:6px 8px;text-align:left;">Unit</th><th style="padding:6px 8px;text-align:left;">Reference</th><th style="padding:6px 8px;text-align:left;">Status</th></tr></thead>
        <tbody>${paramRows}</tbody></table>`;
    }).join('');
    
    const printHtml = `<!DOCTYPE html><html><head><title>Lab Report - ${selectedPatient.name}</title>
      <style>body{font-family:Arial,sans-serif;margin:20px;color:#333;}h1{font-size:18px;margin-bottom:2px;}h2{font-size:14px;color:#666;margin-top:0;}table{margin-bottom:8px;}td,th{border-bottom:1px solid #eee;}
      @media print{body{margin:10mm;}}</style></head><body>
      <h1>${hospitalName}</h1><h2>Laboratory Report</h2><hr/>
      <table style="font-size:13px;margin:8px 0;"><tr><td><strong>Patient:</strong> ${selectedPatient.name}</td><td style="padding-left:32px;"><strong>MRN:</strong> ${selectedPatient.id}</td></tr>
      <tr><td><strong>Age/Gender:</strong> ${selectedPatient.age} years / ${selectedPatient.gender}</td><td style="padding-left:32px;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</td></tr></table><hr/>
      ${testRows}
      <div style="margin-top:24px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:8px;">Report generated by ${hospitalName} — Glide HIMS</div>
      </body></html>`;
    
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(printHtml);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => printWin.print(), 300);
    }
  };

  // Handle PDF download using jsPDF + autoTable
  const handleDownload = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient first');
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const hospitalName = hospitalNameForShare;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 15;

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(hospitalName, pageWidth / 2, y, { align: 'center' });
      y += 7;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Laboratory Report', pageWidth / 2, y, { align: 'center' });
      y += 5;
      doc.setLineWidth(0.5);
      doc.line(14, y, pageWidth - 14, y);
      y += 6;

      // Patient info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Patient Information', 14, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      const patientFields = [
        ['Patient Name:', selectedPatient.name],
        ['MRN:', selectedPatient.id],
        ['Gender:', selectedPatient.gender],
        ['Report Date:', new Date().toLocaleDateString()],
      ];
      for (const [label, value] of patientFields) {
        doc.setFont('helvetica', 'bold');
        doc.text(label, 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(value, 50, y);
        y += 5;
      }
      y += 3;
      doc.line(14, y, pageWidth - 14, y);
      y += 6;

      // Per-test results
      for (const test of selectedPatient.tests) {
        if (y > 260) { doc.addPage(); y = 15; }
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Test: ${test.testName}`, 14, y);
        y += 5;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Category: ${test.category}   Date Collected: ${test.results[0]?.date ?? '—'}   Date Reported: ${test.lastReportDate}`, 14, y);
        y += 4;

        // Results table rows — one row per parameter
        const tableRows = test.results.map((r) => [
          r.parameter,
          String(r.value),
          r.unit,
          r.referenceRange,
          r.status === 'Normal' ? '' : r.status,
        ]);

        autoTable(doc, {
          startY: y,
          head: [['Parameter', 'Value', 'Unit', 'Reference Range', 'Flag']],
          body: tableRows,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [99, 60, 180], textColor: 255 },
          didParseCell: (data) => {
            // Bold abnormal/critical flag cells
            if (data.column.index === 4 && data.cell.raw && data.cell.raw !== '') {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = data.cell.raw === 'Critical' ? [220, 38, 38] : [234, 88, 12];
            }
            // Bold value cell if abnormal
            if (data.column.index === 1 && data.row.index >= 0) {
              const flag = tableRows[data.row.index]?.[4];
              if (flag && flag !== '') {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = flag === 'Critical' ? [220, 38, 38] : [234, 88, 12];
              }
            }
          },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // Footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120);
        doc.text('Report generated by Glide HIMS', 14, doc.internal.pageSize.getHeight() - 8);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
        doc.setTextColor(0);
      }

      doc.save(`Lab_Report_${selectedPatient.id}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF report downloaded successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate PDF report');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Open share modal
  const handleOpenShare = (method: ShareMethod) => {
    if (!selectedPatient) {
      toast.error('Please select a patient first');
      return;
    }
    setShareMethod(method);
    setRecipientEmail(selectedPatient.email || '');
    setRecipientPhone(selectedPatient.phone || '');
    setShareMessage(`Lab results for ${selectedPatient.name} are ready.`);
    setShowShareModal(true);
  };

  // Handle share submission
  const handleShare = async () => {
    if (!selectedPatient) return;
    
    try {
      switch (shareMethod) {
        case 'email':
          if (!recipientEmail) {
            toast.error('Please enter an email address');
            return;
          }
          toast.info('Email feature requires SMTP configuration. Contact your administrator to enable email delivery.');
          break;
          
        case 'whatsapp':
          if (!recipientPhone) {
            toast.error('Please enter a phone number');
            return;
          }
          // Build notification message (no actual values for privacy)
          const testNames = selectedPatient.tests.map(t => t.testName).join(', ');
          const whatsappMsg = `*Lab Results Ready — ${selectedPatient.name}*\nMRN: ${selectedPatient.id}\nDate: ${new Date().toLocaleDateString()}\n\nTests completed: ${testNames}\n\nPlease visit the facility to collect your results.\n\n${shareMessage ? shareMessage + '\n' : ''}— ${hospitalNameForShare}`;
          const whatsappUrl = `https://wa.me/${recipientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMsg)}`;
          window.open(whatsappUrl, '_blank');
          toast.success('Opening WhatsApp...');
          break;
          
        case 'sms':
          if (!recipientPhone) {
            toast.error('Please enter a phone number');
            return;
          }
          // Open SMS app
          const smsUrl = `sms:${recipientPhone}?body=${encodeURIComponent(
            `Lab results for ${selectedPatient.name} are ready. Please visit the facility or log in to view.`
          )}`;
          window.location.href = smsUrl;
          toast.success('Opening SMS app...');
          break;
          
        case 'copy':
          const content = generateReportContent();
          await navigator.clipboard.writeText(content);
          toast.success('Report copied to clipboard');
          break;
      }
      
      setShowShareModal(false);
    } catch (error) {
      toast.error('Failed to share report');
    }
  };

  // Handle preview
  const handlePreview = () => {
    if (!selectedPatient) {
      toast.error('Please select a patient first');
      return;
    }
    setShowPreviewModal(true);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <FileText className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lab Reports</h1>
            <p className="text-sm text-gray-500">Generate and view patient test reports</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-violet-50 border border-violet-200 rounded-lg text-center">
            <p className="text-xl font-bold text-violet-600">{patientCount}</p>
            <p className="text-xs text-violet-500">Patients</p>
          </div>
          <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-center">
            <p className="text-xl font-bold text-amber-600">{pendingReviewCount}</p>
            <p className="text-xs text-amber-500">Pending Review</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        <div className="w-72 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-gray-100">
            {loadingPatients && (
              <div className="p-8 text-center text-gray-500">
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-violet-400 animate-spin" />
                <p>Loading patients...</p>
              </div>
            )}
            {!loadingPatients && filteredPatients.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No patients found</p>
              </div>
            )}
            {filteredPatients.map((patient) => (
              <div
                key={patient.id}
                onClick={() => { setSelectedPatient(patient); setSelectedTest(null); }}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedPatient?.id === patient.id ? 'bg-violet-50 border-l-4 border-violet-500' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{patient.name}</p>
                    <p className="text-sm text-gray-500">{patient.id} • {patient.age}y {patient.gender}</p>
                    <p className="text-xs text-gray-400">{patient.tests.length} tests on file</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          {selectedPatient ? (
            <>
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedPatient.name}</h2>
                    <p className="text-sm text-gray-500">
                      {selectedPatient.id} • {selectedPatient.age} years • {selectedPatient.gender}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                    >
                      {reportTemplates.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Test History</h3>
                <div className="space-y-3">
                  {selectedPatient.tests.map((test) => (
                    <div key={test.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div
                        onClick={() => { toggleTestExpand(test.id); setSelectedTest(test); }}
                        className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium text-gray-900">{test.testName}</p>
                            <p className="text-sm text-gray-500">{test.category} • {test.results.length} parameters</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              {test.results.some(r => r.status === 'Critical') ? (
                                <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Critical</span>
                              ) : test.results.some(r => r.status === 'Abnormal') ? (
                                <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700">Abnormal</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Normal</span>
                              )}
                            </div>
                          </div>
                          {test.doctorReviewed ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <Clock className="w-5 h-5 text-amber-500" />
                          )}
                          {expandedTests.has(test.id) ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                      {expandedTests.has(test.id) && (
                        <div className="p-4 border-t border-gray-200">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-gray-700">Parameters</p>
                            <p className="text-xs text-gray-400">Date: {test.lastReportDate ? new Date(test.lastReportDate).toLocaleDateString() : '—'}</p>
                          </div>

                          <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium text-gray-600">Parameter</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600">Value</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600">Unit</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600">Reference</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {test.results.map((result, idx) => (
                                <tr key={idx} className={result.status === 'Critical' ? 'bg-red-50' : result.status === 'Abnormal' ? 'bg-orange-50' : ''}>
                                  <td className="px-3 py-2 font-medium">{result.parameter}</td>
                                  <td className="px-3 py-2 font-medium">{result.value}</td>
                                  <td className="px-3 py-2 text-gray-500">{result.unit}</td>
                                  <td className="px-3 py-2 text-gray-500">{result.referenceRange}</td>
                                  <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded text-xs ${statusColors[result.status]}`}>
                                      {result.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Eye className="w-4 h-4" />
                    Template: {selectedTemplate}
                  </div>
                  <button
                    onClick={handlePreview}
                    className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1"
                  >
                    <FileCheck className="w-4 h-4" />
                    Preview
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2"
                    title="Print Report"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={() => handleOpenShare('email')}
                    className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2"
                    title="Send via Email"
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                  <button
                    onClick={() => handleOpenShare('whatsapp')}
                    className="px-3 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 flex items-center gap-2"
                    title="Share via WhatsApp"
                  >
                    <MessageSquare className="w-4 h-4" />
                    WhatsApp
                  </button>
                  <button
                    onClick={() => handleOpenShare('sms')}
                    className="px-3 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 flex items-center gap-2"
                    title="Send SMS Notification"
                  >
                    <Phone className="w-4 h-4" />
                    SMS
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={isGeneratingPdf}
                    className="px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    {isGeneratingPdf ? 'Generating...' : 'Download'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-2" />
                <p>Select a patient to view reports</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-violet-600" />
                <h3 className="font-semibold text-gray-900">
                  Share Report via {shareMethod === 'email' ? 'Email' : shareMethod === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                </h3>
              </div>
              <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Patient:</span> {selectedPatient.name}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">MRN:</span> {selectedPatient.id}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Tests:</span> {selectedPatient.tests.length} test(s)
                </p>
              </div>
              
              {shareMethod === 'email' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="patient@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+256700000000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message (optional)
                </label>
                <textarea
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  {shareMethod === 'email' 
                    ? 'A secure link to view the report will be sent to this email address.'
                    : shareMethod === 'whatsapp'
                    ? 'A notification will be sent via WhatsApp. No actual test values will be shared — patient must collect results at the facility.'
                    : 'An SMS notification will be sent. No actual test values will be shared.'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-violet-600" />
                <h3 className="font-semibold text-gray-900">Report Preview</h3>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <div className="bg-gray-50 rounded-lg p-6 font-mono text-sm whitespace-pre-wrap">
                {generateReportContent()}
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => handleOpenShare('copy')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
              <button
                onClick={() => { setShowPreviewModal(false); handleDownload(); }}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}