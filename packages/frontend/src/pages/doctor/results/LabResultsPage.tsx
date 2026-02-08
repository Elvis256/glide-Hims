import { usePermissions } from '../../../components/PermissionGate';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FlaskConical,
  User,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Printer,
  Download,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Filter,
  ToggleLeft,
  ToggleRight,
  Loader2,
  History,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { patientsService } from '../../../services/patients';
import { labService, type LabOrder as ApiLabOrder } from '../../../services/lab';
import { useAuthStore } from '../../../store/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LabParameter {
  id: string;
  name: string;
  result: number | string;
  units: string;
  referenceRange: string;
  flag: 'Normal' | 'High' | 'Low' | 'Critical';
  previousResults?: { date: string; value: number }[];
  acknowledged: boolean;
}

interface LabTest {
  id: string;
  testName: string;
  testCode: string;
  status: 'Pending' | 'Complete';
  parameters: LabParameter[];
  hasAbnormal: boolean;
  hasCritical: boolean;
}

interface LabOrder {
  id: string;
  orderDate: string;
  orderedBy: string;
  status: 'Pending' | 'Complete' | 'Partial';
  tests: LabTest[];
}

interface Patient {
  id: string;
  name: string;
  mrn: string;
  pendingResults: number;
  orders: LabOrder[];
}

// Transform API flag to local format
const transformFlag = (flag?: string): 'Normal' | 'High' | 'Low' | 'Critical' => {
  if (!flag) return 'Normal';
  const lowerFlag = flag.toLowerCase();
  if (lowerFlag.includes('critical')) return 'Critical';
  if (lowerFlag === 'high' || lowerFlag === 'critical_high') return 'High';
  if (lowerFlag === 'low' || lowerFlag === 'critical_low') return 'Low';
  return 'Normal';
};

// Transform API status to local format
const transformStatus = (status: ApiLabOrder['status']): 'Pending' | 'Complete' | 'Partial' => {
  switch (status) {
    case 'completed':
    case 'verified':
    case 'released':
    case 'validated':
      return 'Complete';
    case 'processing':
    case 'in-progress':
      return 'Partial';
    default:
      return 'Pending';
  }
};

// Transform API lab orders to local format
const transformOrders = (orders: ApiLabOrder[]): LabOrder[] => {
  return orders.map((order) => ({
    id: order.id,
    orderDate: new Date(order.createdAt).toISOString().split('T')[0],
    orderedBy: order.doctor?.fullName || order.orderedBy || 'Unknown',
    status: transformStatus(order.status),
    tests: order.tests.map((test) => {
      const result = test.result;
      
      // If no result yet, show pending test
      if (!result) {
        return {
          id: test.id,
          testName: test.testName || test.name || 'Unknown Test',
          testCode: test.testCode || test.id,
          status: 'Pending' as const,
          parameters: [],
          hasAbnormal: false,
          hasCritical: false,
        };
      }
      
      // Build parameters array from result
      let parameters: LabParameter[] = [];
      
      if (result.parameters && result.parameters.length > 0) {
        parameters = result.parameters.map((param: any, idx: number) => ({
          id: `${test.id}-${idx}`,
          name: param.parameter || param.name || `Parameter ${idx + 1}`,
          result: param.numericValue ?? (isNaN(Number(param.value)) ? param.value : Number(param.value)),
          units: param.unit || '',
          referenceRange: param.referenceRange || '',
          flag: transformFlag(param.abnormalFlag || param.flag),
          acknowledged: !!(result.verifiedAt || result.validatedAt),
        }));
      } else {
        // Single result
        parameters = [{
          id: test.id,
          name: result.parameter || test.testName,
          result: result.numericValue ?? result.value,
          units: result.unit || '',
          referenceRange: result.referenceRange || (result.referenceMin && result.referenceMax ? `${result.referenceMin}-${result.referenceMax}` : ''),
          flag: transformFlag(result.flag || result.abnormalFlag),
          acknowledged: !!(result.verifiedAt || result.validatedAt),
        }];
      }
      
      const hasAbnormal = parameters.some(p => p.flag === 'High' || p.flag === 'Low');
      const hasCritical = parameters.some(p => p.flag === 'Critical');
      
      return {
        id: test.id,
        testName: test.testName || test.name || 'Unknown Test',
        testCode: test.testCode || test.id,
        status: 'Complete' as const,
        parameters,
        hasAbnormal,
        hasCritical,
      };
    }),
  }));
};

export default function LabResultsPage() {
  const { hasPermission } = usePermissions();
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [acknowledgedTests, setAcknowledgedTests] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);

  // Get patientId from URL if provided
  const urlPatientId = searchParams.get('patientId');

  // Get hospital info from user's facility
  const hospitalInfo = useMemo(() => ({
    name: user?.facility?.name || 'Hospital Name',
    address: user?.facility?.location || '',
    contact: user?.facility?.contact?.phone || '',
    email: user?.facility?.contact?.email || '',
  }), [user]);

  // Fetch patients
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients', 'lab-results'],
    queryFn: () => patientsService.search({ limit: 100 }),
  });

  // Fetch lab orders for selected patient
  const { data: labOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['lab-orders', selectedPatientId],
    queryFn: () => labService.orders.list({ patientId: selectedPatientId! }),
    enabled: !!selectedPatientId,
  });

  // Fetch historical lab orders for comparison
  const { data: historicalOrders, isLoading: historyLoading } = useQuery({
    queryKey: ['lab-orders-history', selectedPatientId],
    queryFn: () => labService.orders.getHistory(selectedPatientId!),
    enabled: !!selectedPatientId && showComparison,
  });

  // Transform API data to local format
  const patients: Patient[] = useMemo(() => {
    if (!patientsData?.data) return [];
    return patientsData.data.map((p) => ({
      id: p.id,
      name: p.fullName,
      mrn: p.mrn,
      pendingResults: 0, // Will be updated when orders are fetched
      orders: [],
    }));
  }, [patientsData]);

  // Select patient from URL param or auto-select first patient
  useEffect(() => {
    if (urlPatientId && patients.length > 0) {
      // Check if the URL patient exists in our list
      const patientExists = patients.some(p => p.id === urlPatientId);
      if (patientExists) {
        setSelectedPatientId(urlPatientId);
      } else {
        // Patient from URL not found, select first available
        setSelectedPatientId(patients[0].id);
      }
    } else if (patients.length > 0 && !selectedPatientId) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, urlPatientId, selectedPatientId]);

  // Transform lab orders to local format
  const orders = useMemo(() => {
    if (!labOrders) return [];
    return transformOrders(labOrders);
  }, [labOrders]);

  // Transform historical orders for comparison
  const previousOrdersData = useMemo(() => {
    if (!historicalOrders) return [];
    return transformOrders(historicalOrders);
  }, [historicalOrders]);

  // Get previous result for a parameter (for comparison feature)
  const getPreviousResult = useCallback((testCode: string, paramName: string): { value: number | string; date: string } | null => {
    if (!showComparison || previousOrdersData.length === 0) return null;
    
    for (const order of previousOrdersData) {
      for (const test of order.tests) {
        if (test.testCode === testCode) {
          const param = test.parameters.find(p => p.name === paramName);
          if (param) {
            return { value: param.result, date: order.orderDate };
          }
        }
      }
    }
    return null;
  }, [showComparison, previousOrdersData]);

  // Calculate change between current and previous result
  const calculateChange = useCallback((current: number | string, previous: number | string): { direction: 'up' | 'down' | 'same'; percentage: number } | null => {
    const currentNum = typeof current === 'number' ? current : parseFloat(String(current));
    const prevNum = typeof previous === 'number' ? previous : parseFloat(String(previous));
    
    if (isNaN(currentNum) || isNaN(prevNum) || prevNum === 0) return null;
    
    const change = ((currentNum - prevNum) / prevNum) * 100;
    return {
      direction: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'same',
      percentage: Math.abs(Math.round(change * 10) / 10),
    };
  }, []);

  // Expand first orders by default when they load
  useMemo(() => {
    if (orders.length > 0 && expandedOrders.size === 0) {
      setExpandedOrders(new Set(orders.slice(0, 2).map((o) => o.id)));
    }
  }, [orders]);

  const selectedPatient = useMemo(() => {
    const patient = patients.find((p) => p.id === selectedPatientId);
    if (!patient) return null;
    return {
      ...patient,
      orders,
      pendingResults: orders.reduce(
        (acc, order) => acc + order.tests.filter((t) => !t.acknowledged).length,
        0
      ),
    };
  }, [patients, selectedPatientId, orders]);

  const toggleOrder = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const toggleTest = (testId: string) => {
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

  const toggleAcknowledge = (testId: string) => {
    setAcknowledgedTests((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  const isTestExpanded = (testId: string) => expandedTests.has(testId);

  // Print lab results
  const handlePrint = () => {
    if (!selectedPatient || orders.length === 0) {
      toast.error('No results to print');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lab Results - ${selectedPatient.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .hospital-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
            .hospital-name { font-size: 22px; font-weight: bold; color: #1a365d; margin-bottom: 5px; }
            .hospital-address { font-size: 12px; color: #666; margin-bottom: 3px; }
            .hospital-contact { font-size: 12px; color: #666; }
            .report-title { font-size: 18px; font-weight: bold; text-align: center; margin: 15px 0; color: #4338ca; }
            .header { border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; }
            .patient-info { margin-bottom: 20px; }
            .patient-name { font-size: 20px; font-weight: bold; }
            .mrn { color: #666; }
            .order { margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; }
            .order-header { background: #f5f5f5; padding: 10px; margin: -15px -15px 15px; }
            .test { margin-bottom: 15px; }
            .test-name { font-weight: bold; font-size: 16px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
            .flag-normal { color: green; }
            .flag-high, .flag-low { color: orange; }
            .flag-critical { color: red; font-weight: bold; }
            .print-date { text-align: right; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="hospital-header">
            <div class="hospital-name">${hospitalInfo.name}</div>
            <div class="hospital-address">${hospitalInfo.address}</div>
            <div class="hospital-contact">${[hospitalInfo.contact, hospitalInfo.email].filter(Boolean).join(' | ')}</div>
          </div>
          
          <div class="report-title">LABORATORY RESULTS</div>
          
          <div class="header">
            <div class="patient-info">
              <div class="patient-name">${selectedPatient.name}</div>
              <div class="mrn">MRN: ${selectedPatient.mrn}</div>
            </div>
            <div class="print-date">Printed: ${new Date().toLocaleString()}</div>
          </div>
          
          ${orders.map(order => `
            <div class="order">
              <div class="order-header">
                <strong>Order Date:</strong> ${order.orderDate} | 
                <strong>Ordered by:</strong> ${order.orderedBy} |
                <strong>Status:</strong> ${order.status}
              </div>
              
              ${order.tests.map(test => `
                <div class="test">
                  <div class="test-name">${test.testName} (${test.testCode})</div>
                  ${test.status === 'Pending' ? '<p><em>Results pending...</em></p>' : `
                    <table>
                      <thead>
                        <tr>
                          <th>Parameter</th>
                          <th>Result</th>
                          <th>Unit</th>
                          <th>Reference</th>
                          <th>Flag</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${test.parameters.map(p => `
                          <tr>
                            <td>${p.name}</td>
                            <td><strong>${p.result}</strong></td>
                            <td>${p.units}</td>
                            <td>${p.referenceRange}</td>
                            <td class="flag-${p.flag.toLowerCase()}">${p.flag}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  `}
                </div>
              `).join('')}
            </div>
          `).join('')}
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Download as PDF using jsPDF
  const handleDownloadPDF = () => {
    if (!selectedPatient || orders.length === 0) {
      toast.error('No results to download');
      return;
    }
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 15;
      
      // Hospital Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 54, 93); // Dark blue
      doc.text(hospitalInfo.name, pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      if (hospitalInfo.address) {
        doc.text(hospitalInfo.address, pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
      }
      const contactLine = [hospitalInfo.contact, hospitalInfo.email].filter(Boolean).join(' | ');
      if (contactLine) {
        doc.text(contactLine, pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
      }
      yPos += 4;
      
      // Draw a line under hospital header
      doc.setDrawColor(67, 56, 202); // Indigo
      doc.setLineWidth(0.5);
      doc.line(14, yPos, pageWidth - 14, yPos);
      yPos += 8;
      
      // Report Title
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(67, 56, 202); // Indigo
      doc.text('LABORATORY RESULTS', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      
      // Patient info
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(selectedPatient.name, 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`MRN: ${selectedPatient.mrn}`, 14, yPos + 6);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, yPos, { align: 'right' });
      yPos += 18;
      
      // Draw a line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(14, yPos, pageWidth - 14, yPos);
      yPos += 10;
      
      // Reset text color
      doc.setTextColor(0, 0, 0);
      
      // Process each order
      for (const order of orders) {
        // Check if we need a new page
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        
        // Order header
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Order Date: ${order.orderDate}`, 14, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Ordered by: ${order.orderedBy} | Status: ${order.status}`, 14, yPos + 5);
        yPos += 12;
        
        // Process each test
        for (const test of order.tests) {
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }
          
          // Test name
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(`${test.testName} (${test.testCode})`, 14, yPos);
          yPos += 6;
          
          if (test.status === 'Pending') {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.text('Results pending...', 18, yPos);
            yPos += 8;
          } else if (test.parameters.length > 0) {
            // Create table for parameters
            const tableData = test.parameters.map(p => [
              p.name,
              String(p.result),
              p.units,
              p.referenceRange,
              p.flag,
            ]);
            
            autoTable(doc, {
              startY: yPos,
              head: [['Parameter', 'Result', 'Unit', 'Reference', 'Flag']],
              body: tableData,
              margin: { left: 14, right: 14 },
              styles: { fontSize: 8, cellPadding: 2 },
              headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
              bodyStyles: { textColor: 50 },
              columnStyles: {
                0: { fontStyle: 'bold' },
                1: { halign: 'right', fontStyle: 'bold' },
                4: { halign: 'center' },
              },
              didParseCell: (data) => {
                // Color-code flags
                if (data.column.index === 4 && data.section === 'body') {
                  const flag = data.cell.raw as string;
                  if (flag === 'Critical') {
                    data.cell.styles.textColor = [220, 38, 38];
                    data.cell.styles.fontStyle = 'bold';
                  } else if (flag === 'High' || flag === 'Low') {
                    data.cell.styles.textColor = [234, 88, 12];
                  } else {
                    data.cell.styles.textColor = [22, 163, 74];
                  }
                }
              },
            });
            
            yPos = (doc as any).lastAutoTable.finalY + 8;
          }
        }
        yPos += 5;
      }
      
      // Save the PDF
      const filename = `lab-results-${selectedPatient.mrn}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const getFlagColor = (flag: string) => {
    switch (flag) {
      case 'Critical':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'High':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'Low':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default:
        return 'bg-green-100 text-green-700 border-green-300';
    }
  };

  const getResultColor = (flag: string) => {
    switch (flag) {
      case 'Critical':
        return 'text-red-600 font-bold';
      case 'High':
        return 'text-orange-600 font-semibold';
      case 'Low':
        return 'text-yellow-600 font-semibold';
      default:
        return 'text-gray-900';
    }
  };

  const getTrendIcon = (previousResults?: { date: string; value: number }[], currentValue?: number | string) => {
    if (!previousResults || previousResults.length === 0 || typeof currentValue !== 'number') return null;
    const lastValue = previousResults[0].value;
    const diff = currentValue - lastValue;
    const percentChange = Math.abs((diff / lastValue) * 100).toFixed(1);

    if (diff > 0) {
      return (
        <div className="flex items-center gap-1 text-orange-500">
          <ArrowUpRight className="h-4 w-4" />
          <span className="text-xs">+{percentChange}%</span>
        </div>
      );
    } else if (diff < 0) {
      return (
        <div className="flex items-center gap-1 text-blue-500">
          <ArrowDownRight className="h-4 w-4" />
          <span className="text-xs">-{percentChange}%</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-gray-400">
        <Minus className="h-4 w-4" />
        <span className="text-xs">0%</span>
      </div>
    );
  };

  const renderSparkline = (previousResults: { date: string; value: number }[], currentValue: number) => {
    const allValues = [...previousResults.map((r) => r.value).reverse(), currentValue];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;
    const height = 24;
    const width = 60;
    const points = allValues.map((v, i) => {
      const x = (i / (allValues.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    });

    return (
      <svg width={width} height={height} className="inline-block ml-2">
        <polyline fill="none" stroke="#6366f1" strokeWidth="2" points={points.join(' ')} />
        <circle cx={width} cy={height - ((currentValue - min) / range) * height} r="3" fill="#6366f1" />
      </svg>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FlaskConical className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Lab Results</h1>
              <p className="text-sm text-gray-500">Review and acknowledge laboratory results</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Comparison Toggle */}
            <button
              onClick={() => setShowComparison(!showComparison)}
              disabled={historyLoading}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                showComparison ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-700'
              } ${historyLoading ? 'opacity-50 cursor-wait' : ''}`}
              title="Compare with previous results"
            >
              {historyLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : showComparison ? (
                <ToggleRight className="h-5 w-5" />
              ) : (
                <ToggleLeft className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">Compare Previous</span>
            </button>

            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button 
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Patient Selector Sidebar */}
        <div className="w-72 bg-white border-r flex-shrink-0 flex flex-col">
          <div className="p-4 border-b">
            <div className="relative">
              {patientsLoading ? (
                <div className="flex items-center justify-center px-4 py-3 bg-gray-50 border rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading patients...</span>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setPatientDropdownOpen(!patientDropdownOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border rounded-lg hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-gray-500" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{selectedPatient?.name || 'Select Patient'}</p>
                        <p className="text-xs text-gray-500">{selectedPatient?.mrn || ''}</p>
                      </div>
                    </div>
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  </button>

                  {patientDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-64 overflow-auto">
                      {patients.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">No patients found</div>
                      ) : (
                        patients.map((patient) => (
                          <button
                            key={patient.id}
                            onClick={() => {
                              setSelectedPatientId(patient.id);
                              setPatientDropdownOpen(false);
                              setExpandedOrders(new Set());
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 ${
                              patient.id === selectedPatientId ? 'bg-indigo-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <User className="h-5 w-5 text-gray-400" />
                              <div className="text-left">
                                <p className="font-medium text-gray-900">{patient.name}</p>
                                <p className="text-xs text-gray-500">{patient.mrn}</p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Orders List */}
          <div className="flex-1 overflow-auto p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Lab Orders</h3>
            {ordersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading orders...</span>
              </div>
            ) : !selectedPatient || selectedPatient.orders.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">No lab orders found</div>
            ) : (
              <div className="space-y-2">
                {selectedPatient.orders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => toggleOrder(order.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      expandedOrders.has(order.id)
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{order.orderDate}</span>
                      </div>
                      {expandedOrders.has(order.id) ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{order.tests.length} tests</p>
                    <div className="flex gap-1 mt-2">
                      {order.tests.some((t) => t.flag === 'Critical') && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">Critical</span>
                      )}
                      {order.tests.some((t) => t.flag === 'High' || t.flag === 'Low') && (
                        <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">Abnormal</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results Panel */}
        <div className="flex-1 overflow-auto p-6">
          {ordersLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Loader2 className="h-12 w-12 animate-spin text-gray-300 mb-3" />
              <p>Loading lab results...</p>
            </div>
          ) : !selectedPatient || selectedPatient.orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FlaskConical className="h-12 w-12 text-gray-300 mb-3" />
              <p>No results found</p>
            </div>
          ) : (
            <>
              {selectedPatient.orders
                .filter((order) => expandedOrders.has(order.id))
                .map((order) => (
                  <div key={order.id} className="bg-white rounded-xl border shadow-sm mb-6">
                    <div className="px-6 py-4 border-b bg-gray-50 rounded-t-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">Order Date: {order.orderDate}</h3>
                          <p className="text-sm text-gray-500">Ordered by: {order.orderedBy}</p>
                        </div>
                        <span
                          className={`px-3 py-1 text-sm font-medium rounded-full ${
                            order.status === 'Complete'
                              ? 'bg-green-100 text-green-700'
                              : order.status === 'Partial'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                    </div>

                    <div className="divide-y">
                      {order.tests.map((test) => (
                        <div key={test.id} className="border-b last:border-b-0">
                          {/* Test Header - Collapsible */}
                          <button
                            onClick={() => test.status !== 'Pending' && toggleTest(test.id)}
                            className={`w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                              test.hasCritical ? 'bg-red-50' : test.hasAbnormal ? 'bg-orange-50/50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {test.status !== 'Pending' && (
                                isTestExpanded(test.id) 
                                  ? <ChevronDown className="h-5 w-5 text-gray-400" />
                                  : <ChevronRight className="h-5 w-5 text-gray-400" />
                              )}
                              <h4 className="font-semibold text-gray-900">{test.testName}</h4>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{test.testCode}</span>
                              
                              {test.status === 'Pending' ? (
                                <span className="px-2 py-0.5 text-xs font-medium border rounded bg-gray-100 text-gray-600 border-gray-300 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </span>
                              ) : (
                                <>
                                  {test.hasCritical && (
                                    <span className="px-2 py-0.5 text-xs font-medium border rounded bg-red-100 text-red-700 border-red-300 flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" />
                                      Critical
                                    </span>
                                  )}
                                  {test.hasAbnormal && !test.hasCritical && (
                                    <span className="px-2 py-0.5 text-xs font-medium border rounded bg-orange-100 text-orange-700 border-orange-300">
                                      Abnormal
                                    </span>
                                  )}
                                  {!test.hasAbnormal && !test.hasCritical && (
                                    <span className="px-2 py-0.5 text-xs font-medium border rounded bg-green-100 text-green-700 border-green-300">
                                      Normal
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-3">
                              {test.status === 'Pending' ? (
                                <span className="text-gray-400 italic text-sm">Awaiting results...</span>
                              ) : (
                                <span className="text-sm text-gray-500">{test.parameters.length} parameters</span>
                              )}
                            </div>
                          </button>
                          
                          {/* Expanded Parameters */}
                          {test.status !== 'Pending' && isTestExpanded(test.id) && (
                            <div className="px-6 pb-4 bg-gray-50/50">
                              <table className="w-full">
                                <thead>
                                  <tr className="text-xs text-gray-500 uppercase border-b">
                                    <th className="text-left py-2 font-medium">Parameter</th>
                                    <th className="text-right py-2 font-medium">Result</th>
                                    {showComparison && (
                                      <th className="text-center py-2 font-medium">
                                        <div className="flex items-center justify-center gap-1">
                                          <History className="h-3 w-3" />
                                          Previous
                                        </div>
                                      </th>
                                    )}
                                    <th className="text-left py-2 pl-2 font-medium">Unit</th>
                                    <th className="text-left py-2 font-medium">Reference</th>
                                    <th className="text-center py-2 font-medium">Flag</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {test.parameters.map((param) => {
                                    const prevResult = getPreviousResult(test.testCode, param.name);
                                    const change = prevResult ? calculateChange(param.result, prevResult.value) : null;
                                    
                                    return (
                                      <tr key={param.id} className={param.flag === 'Critical' ? 'bg-red-50' : param.flag !== 'Normal' ? 'bg-orange-50/30' : ''}>
                                        <td className="py-2 text-sm font-medium text-gray-900">{param.name}</td>
                                        <td className={`py-2 text-right text-lg font-semibold ${getResultColor(param.flag)}`}>
                                          {param.result}
                                          {showComparison && change && (
                                            <div className={`text-xs font-normal flex items-center justify-end gap-0.5 ${
                                              change.direction === 'up' ? 'text-orange-500' : change.direction === 'down' ? 'text-blue-500' : 'text-gray-400'
                                            }`}>
                                              {change.direction === 'up' ? <ArrowUpRight className="h-3 w-3" /> : 
                                               change.direction === 'down' ? <ArrowDownRight className="h-3 w-3" /> : 
                                               <Minus className="h-3 w-3" />}
                                              {change.percentage}%
                                            </div>
                                          )}
                                        </td>
                                        {showComparison && (
                                          <td className="py-2 text-center">
                                            {prevResult ? (
                                              <div>
                                                <span className="text-sm text-gray-600">{prevResult.value}</span>
                                                <div className="text-xs text-gray-400">{prevResult.date}</div>
                                              </div>
                                            ) : (
                                              <span className="text-xs text-gray-400">—</span>
                                            )}
                                          </td>
                                        )}
                                        <td className="py-2 pl-2 text-sm text-gray-500">{param.units}</td>
                                        <td className="py-2 text-sm text-gray-500">{param.referenceRange}</td>
                                        <td className="py-2 text-center">
                                          <span className={`px-2 py-0.5 text-xs font-medium border rounded ${getFlagColor(param.flag)}`}>
                                            {param.flag}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              
                              {/* Acknowledge button for the test */}
                              <div className="mt-4 flex justify-end">
                                <button
                                  onClick={() => toggleAcknowledge(test.id)}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                    acknowledgedTests.has(test.id)
                                      ? 'bg-green-100 text-green-700 border border-green-300'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                                  }`}
                                >
                                  {acknowledgedTests.has(test.id) ? (
                                    <>
                                      <CheckCheck className="h-4 w-4" />
                                      <span className="text-sm font-medium">Reviewed</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check className="h-4 w-4" />
                                      <span className="text-sm font-medium">Mark as Reviewed</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {expandedOrders.size === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <FlaskConical className="h-12 w-12 text-gray-300 mb-3" />
                  <p>Select an order to view results</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
