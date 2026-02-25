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
  X,
  Activity,
  ShieldCheck,
  CircleAlert,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
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

// Recalculate flag from value and reference range string (safety net for bad stored data)
const recalculateFlag = (value: number | string, referenceRange: string, storedFlag: 'Normal' | 'High' | 'Low' | 'Critical'): 'Normal' | 'High' | 'Low' | 'Critical' => {
  if (storedFlag !== 'Normal') return storedFlag; // Trust non-Normal flags
  const numVal = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numVal) || !referenceRange) return storedFlag;
  const match = referenceRange.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
  if (!match) return storedFlag;
  const min = parseFloat(match[1]);
  const max = parseFloat(match[2]);
  if (numVal < min * 0.5 || numVal > max * 2) return 'Critical';
  if (numVal < min) return 'Low';
  if (numVal > max) return 'High';
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
        parameters = result.parameters.map((param: any, idx: number) => {
          const rawResult = param.numericValue ?? (isNaN(Number(param.value)) ? param.value : Number(param.value));
          const refRange = param.referenceRange || '';
          const rawFlag = transformFlag(param.abnormalFlag || param.flag);
          return {
            id: `${test.id}-${idx}`,
            name: param.parameter || param.name || `Parameter ${idx + 1}`,
            result: rawResult,
            units: param.unit || '',
            referenceRange: refRange,
            flag: recalculateFlag(rawResult, refRange, rawFlag),
            acknowledged: !!(result.verifiedAt || result.validatedAt),
          };
        });
      } else {
        // Single result
        const rawResult = result.numericValue ?? result.value;
        const refRange = result.referenceRange || (result.referenceMin && result.referenceMax ? `${result.referenceMin}-${result.referenceMax}` : '');
        const rawFlag = transformFlag(result.flag || result.abnormalFlag);
        parameters = [{
          id: test.id,
          name: result.parameter || test.testName,
          result: rawResult,
          units: result.unit || '',
          referenceRange: refRange,
          flag: recalculateFlag(rawResult, refRange, rawFlag),
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
  const [trendParam, setTrendParam] = useState<{
    paramName: string;
    unit: string;
    referenceRange: string;
    testCode: string;
  } | null>(null);

  // Get patientId from URL if provided
  const urlPatientId = searchParams.get('patientId');

  // Get hospital info from user's facility
  const hospitalInfo = useMemo(() => ({
    name: user?.facility?.name || 'Hospital',
    address: user?.facility?.location || '',
    contact: user?.facility?.contact?.phone || '',
    email: user?.facility?.contact?.email || '',
    department: 'Laboratory',
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
    enabled: !!selectedPatientId && (showComparison || !!trendParam),
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

  // Build trend data points for the selected parameter from historical orders
  const trendData = useMemo(() => {
    if (!trendParam || previousOrdersData.length === 0) return [];
    const points: { date: string; value: number; flag: string }[] = [];
    for (const order of previousOrdersData) {
      for (const test of order.tests) {
        if (test.testCode === trendParam.testCode) {
          const param = test.parameters.find((p) => p.name === trendParam.paramName);
          if (param && typeof param.result === 'number') {
            points.push({ date: order.orderDate, value: param.result, flag: param.flag });
          }
        }
      }
    }
    return points.sort((a, b) => a.date.localeCompare(b.date));
  }, [trendParam, previousOrdersData]);

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
      // Auto-expand completed tests within those orders
      const testsToExpand: string[] = [];
      orders.slice(0, 2).forEach(order => {
        order.tests.forEach(test => {
          if (test.status === 'Complete') testsToExpand.push(test.id);
        });
      });
      if (testsToExpand.length > 0) {
        setExpandedTests(new Set(testsToExpand));
      }
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
            .flag-high, .flag-low { color: #ea580c; font-weight: bold; }
            .flag-critical { color: #dc2626; font-weight: bold; background: #fef2f2; }
            .row-critical { background: #fef2f2; }
            .row-abnormal { background: #fff7ed; }
            .print-date { text-align: right; color: #666; font-size: 12px; }
            .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 15px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; }
            .summary-box .critical { color: #dc2626; font-weight: bold; }
            .summary-box .abnormal { color: #ea580c; font-weight: bold; }
            .summary-box .normal { color: #16a34a; }
            .test-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 10px; }
            .badge-critical { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
            .badge-abnormal { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; }
            .badge-normal { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
          </style>
        </head>
        <body>
          <div class="hospital-header">
            <div class="hospital-name">${hospitalInfo.name}</div>
            <div class="hospital-address">${hospitalInfo.address}</div>
            <div class="hospital-contact">${[hospitalInfo.contact, hospitalInfo.email].filter(Boolean).join(' | ')}</div>
            <div class="hospital-contact" style="font-weight:bold; margin-top:4px;">Department: ${hospitalInfo.department}</div>
          </div>
          
          <div class="report-title">LABORATORY RESULTS</div>
          
          <div class="header">
            <div class="patient-info">
              <div class="patient-name">${selectedPatient.name}</div>
              <div class="mrn">MRN: ${selectedPatient.mrn}</div>
            </div>
            <div class="print-date">Printed: ${new Date().toLocaleString()}</div>
          </div>

          <div class="summary-box">
            <strong>Summary:</strong> 
            ${orders.reduce((a, o) => a + o.tests.length, 0)} tests ordered | 
            ${orders.reduce((a, o) => a + o.tests.filter(t => t.status === 'Complete').length, 0)} completed
            ${orders.some(o => o.tests.some(t => t.hasCritical)) ? ` | <span class="critical">⚠ Critical values detected</span>` : ''}
            ${orders.some(o => o.tests.some(t => t.hasAbnormal)) ? ` | <span class="abnormal">Abnormal values present</span>` : ''}
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
                  <div class="test-name">
                    ${test.testName} (${test.testCode})
                    ${test.hasCritical ? '<span class="test-badge badge-critical">CRITICAL</span>' : 
                      test.hasAbnormal ? '<span class="test-badge badge-abnormal">ABNORMAL</span>' : 
                      test.status === 'Complete' ? '<span class="test-badge badge-normal">NORMAL</span>' : ''}
                  </div>
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
                          <tr class="${p.flag === 'Critical' ? 'row-critical' : (p.flag === 'High' || p.flag === 'Low') ? 'row-abnormal' : ''}">
                            <td>${p.name}</td>
                            <td><strong>${formatResult(p.result)}</strong></td>
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
      // Department
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(67, 56, 202);
      doc.text(`Department: ${hospitalInfo.department}`, pageWidth / 2, yPos + 2, { align: 'center' });
      yPos += 8;
      
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

      // Results Summary Box
      const totalTests = orders.reduce((acc, o) => acc + o.tests.length, 0);
      const completedTests = orders.reduce((acc, o) => acc + o.tests.filter(t => t.status === 'Complete').length, 0);
      const criticalTests = orders.reduce((acc, o) => acc + o.tests.filter(t => t.hasCritical).length, 0);
      const abnormalTests = orders.reduce((acc, o) => acc + o.tests.filter(t => t.hasAbnormal && !t.hasCritical).length, 0);
      const normalTests = completedTests - criticalTests - abnormalTests;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, yPos, pageWidth - 28, 18, 2, 2, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      const summaryY = yPos + 7;
      doc.text(`SUMMARY:`, 18, summaryY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${totalTests} tests ordered  |  ${completedTests} completed`, 45, summaryY);
      if (criticalTests > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text(`${criticalTests} CRITICAL`, 120, summaryY);
      }
      if (abnormalTests > 0) {
        doc.setTextColor(234, 88, 12);
        doc.text(`${abnormalTests} Abnormal`, criticalTests > 0 ? 155 : 120, summaryY);
      }
      if (normalTests > 0) {
        doc.setTextColor(22, 163, 74);
        doc.text(`${normalTests} Normal`, (criticalTests > 0 ? 155 : 120) + (abnormalTests > 0 ? 35 : 0), summaryY);
      }
      yPos += 24;
      doc.setTextColor(0, 0, 0);
      
      // Process each order
      for (const order of orders) {
        // Check if we need a new page
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        
        // Order header with background
        doc.setFillColor(249, 250, 251);
        doc.setDrawColor(229, 231, 235);
        doc.roundedRect(14, yPos - 2, pageWidth - 28, 14, 1, 1, 'FD');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text(`Order Date: ${order.orderDate}`, 18, yPos + 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(`Ordered by: ${order.orderedBy}`, pageWidth - 18, yPos + 6, { align: 'right' });
        yPos += 16;
        
        // Process each test
        for (const test of order.tests) {
          if (yPos > 240) {
            doc.addPage();
            yPos = 20;
          }
          
          // Test name with status indicator
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(17, 24, 39);
          doc.text(`${test.testName}`, 16, yPos);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(107, 114, 128);
          doc.text(`(${test.testCode})`, 16 + doc.getTextWidth(test.testName + ' ') * 1.25, yPos);
          
          // Status badge next to test name
          if (test.hasCritical) {
            doc.setTextColor(220, 38, 38);
            doc.text('● CRITICAL', pageWidth - 18, yPos, { align: 'right' });
          } else if (test.hasAbnormal) {
            doc.setTextColor(234, 88, 12);
            doc.text('● ABNORMAL', pageWidth - 18, yPos, { align: 'right' });
          } else if (test.status === 'Complete') {
            doc.setTextColor(22, 163, 74);
            doc.text('● NORMAL', pageWidth - 18, yPos, { align: 'right' });
          }
          yPos += 5;
          
          if (test.status === 'Pending') {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(156, 163, 175);
            doc.text('Results pending...', 18, yPos);
            yPos += 8;
          } else if (test.parameters.length > 0) {
            // Create table for parameters
            const tableData = test.parameters.map(p => [
              p.name,
              formatResult(p.result),
              p.units,
              p.referenceRange,
              p.flag,
            ]);
            
            autoTable(doc, {
              startY: yPos,
              head: [['Parameter', 'Result', 'Unit', 'Reference', 'Flag']],
              body: tableData,
              margin: { left: 14, right: 14 },
              styles: { fontSize: 8, cellPadding: 2.5 },
              headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 7 },
              bodyStyles: { textColor: 50 },
              alternateRowStyles: { fillColor: [249, 250, 251] },
              columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 55 },
                1: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
                2: { cellWidth: 25 },
                3: { cellWidth: 35 },
                4: { halign: 'center', cellWidth: 25 },
              },
              didParseCell: (data) => {
                if (data.section === 'body') {
                  const flag = tableData[data.row.index]?.[4];
                  // Color-code flag column
                  if (data.column.index === 4) {
                    if (flag === 'Critical') {
                      data.cell.styles.textColor = [220, 38, 38];
                      data.cell.styles.fontStyle = 'bold';
                    } else if (flag === 'High' || flag === 'Low') {
                      data.cell.styles.textColor = [234, 88, 12];
                    } else {
                      data.cell.styles.textColor = [22, 163, 74];
                    }
                  }
                  // Color-code result column for abnormal values
                  if (data.column.index === 1) {
                    if (flag === 'Critical') {
                      data.cell.styles.textColor = [220, 38, 38];
                    } else if (flag === 'High' || flag === 'Low') {
                      data.cell.styles.textColor = [234, 88, 12];
                    }
                  }
                  // Highlight row background for critical/abnormal
                  if (flag === 'Critical') {
                    data.cell.styles.fillColor = [254, 242, 242];
                  } else if (flag === 'High' || flag === 'Low') {
                    data.cell.styles.fillColor = [255, 247, 237];
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

  const parseReferenceRange = (range: string): { min: number; max: number } | null => {
    const match = range.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
    if (match) return { min: parseFloat(match[1]), max: parseFloat(match[2]) };
    return null;
  };

  // Format numeric results - trim trailing zeros (4.9000 → 4.9)
  const formatResult = (value: number | string): string => {
    if (typeof value === 'number') {
      // Remove unnecessary trailing zeros
      return parseFloat(value.toFixed(4)).toString();
    }
    // Try to parse string as number to clean it up
    const num = parseFloat(String(value));
    if (!isNaN(num) && String(value).match(/^\d+\.?\d*$/)) {
      return parseFloat(num.toFixed(4)).toString();
    }
    return String(value);
  };

  // Visual reference range bar component
  const ReferenceRangeBar = ({ value, referenceRange, flag }: { value: number | string; referenceRange: string; flag: string }) => {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    const parsed = parseReferenceRange(referenceRange);
    if (!parsed || isNaN(numValue)) return null;

    const { min, max } = parsed;
    const rangeSpan = max - min;
    // Show 30% padding on each side of the range
    const viewMin = min - rangeSpan * 0.3;
    const viewMax = max + rangeSpan * 0.3;
    const viewSpan = viewMax - viewMin;

    const clampedValue = Math.max(viewMin, Math.min(viewMax, numValue));
    const position = ((clampedValue - viewMin) / viewSpan) * 100;
    const rangeStart = ((min - viewMin) / viewSpan) * 100;
    const rangeWidth = ((max - min) / viewSpan) * 100;

    const dotColor = flag === 'Critical' ? '#dc2626' : flag === 'High' || flag === 'Low' ? '#ea580c' : '#16a34a';

    return (
      <div className="w-24 h-3 relative mt-0.5" title={`Value: ${formatResult(value)} | Range: ${referenceRange}`}>
        {/* Background */}
        <div className="absolute inset-0 rounded-full bg-gray-100" />
        {/* Normal range zone */}
        <div
          className="absolute top-0 bottom-0 rounded-full bg-green-100 border border-green-200"
          style={{ left: `${rangeStart}%`, width: `${rangeWidth}%` }}
        />
        {/* Value dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm"
          style={{ left: `${position}%`, transform: `translate(-50%, -50%)`, backgroundColor: dotColor }}
        />
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
                {selectedPatient.orders.map((order) => {
                  const hasCritical = order.tests.some(t => t.hasCritical);
                  const hasAbnormal = order.tests.some(t => t.hasAbnormal);
                  const completeTests = order.tests.filter(t => t.status === 'Complete').length;
                  return (
                    <button
                      key={order.id}
                      onClick={() => {
                        toggleOrder(order.id);
                        // Auto-expand completed tests when opening an order
                        if (!expandedOrders.has(order.id)) {
                          const newExpanded = new Set(expandedTests);
                          order.tests.forEach(t => { if (t.status === 'Complete') newExpanded.add(t.id); });
                          setExpandedTests(newExpanded);
                        }
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        expandedOrders.has(order.id)
                          ? 'bg-indigo-50 border-indigo-200'
                          : hasCritical
                            ? 'bg-white border-red-200 hover:bg-red-50/30'
                            : hasAbnormal
                              ? 'bg-white border-orange-200 hover:bg-orange-50/30'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{order.orderDate}</span>
                        </div>
                        {expandedOrders.has(order.id) ? (
                          <ChevronDown className="h-4 w-4 text-indigo-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-xs text-gray-500">{completeTests}/{order.tests.length} tests complete</p>
                        <div className="flex gap-1">
                          {hasCritical && (
                            <span className="w-2 h-2 rounded-full bg-red-500" title="Has critical results" />
                          )}
                          {hasAbnormal && !hasCritical && (
                            <span className="w-2 h-2 rounded-full bg-orange-500" title="Has abnormal results" />
                          )}
                          {!hasAbnormal && !hasCritical && completeTests === order.tests.length && (
                            <span className="w-2 h-2 rounded-full bg-green-500" title="All normal" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
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
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-gray-900">Order Date: {order.orderDate}</h3>
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                              {order.tests.length} test{order.tests.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">Ordered by: {order.orderedBy}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Result summary badges */}
                          {order.tests.some(t => t.hasCritical) && (
                            <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-lg border border-red-200">
                              <CircleAlert className="h-3 w-3" />
                              Critical
                            </span>
                          )}
                          {order.tests.some(t => t.hasAbnormal && !t.hasCritical) && (
                            <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-lg border border-orange-200">
                              <AlertTriangle className="h-3 w-3" />
                              Abnormal
                            </span>
                          )}
                          {order.tests.every(t => !t.hasAbnormal && !t.hasCritical && t.status === 'Complete') && (
                            <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-lg border border-green-200">
                              <CheckCircle2 className="h-3 w-3" />
                              All Normal
                            </span>
                          )}
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
                                    <th className="text-center py-2 font-medium">Range</th>
                                    <th className="text-center py-2 font-medium">Flag</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {test.parameters.map((param) => {
                                    const prevResult = getPreviousResult(test.testCode, param.name);
                                    const change = prevResult ? calculateChange(param.result, prevResult.value) : null;
                                    
                                    return (
                                      <tr
                                        key={param.id}
                                        className={`cursor-pointer transition-colors hover:bg-indigo-50/60 ${param.flag === 'Critical' ? 'bg-red-50' : param.flag !== 'Normal' ? 'bg-orange-50/30' : ''}`}
                                        onClick={() => setTrendParam({ paramName: param.name, unit: param.units, referenceRange: param.referenceRange, testCode: test.testCode })}
                                        title="Click to view trend chart"
                                      >
                                        <td className="py-2 text-sm font-medium text-gray-900">
                                          <span className="flex items-center gap-1 group">
                                            {param.name}
                                            <TrendingUp className="h-3 w-3 text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                          </span>
                                        </td>
                                        <td className={`py-2 text-right text-lg font-semibold ${getResultColor(param.flag)}`}>
                                          {formatResult(param.result)}
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
                                                <span className="text-sm text-gray-600">{formatResult(prevResult.value)}</span>
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
                                          <ReferenceRangeBar value={param.result} referenceRange={param.referenceRange} flag={param.flag} />
                                        </td>
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
                              <div className="mt-4 flex items-center justify-between">
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Normal
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="inline-block w-2 h-2 rounded-full bg-orange-500" /> Abnormal
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Critical
                                  </span>
                                </div>
                                <button
                                  onClick={() => toggleAcknowledge(test.id)}
                                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all font-medium ${
                                    acknowledgedTests.has(test.id)
                                      ? 'bg-green-600 text-white shadow-sm hover:bg-green-700'
                                      : 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                                  }`}
                                >
                                  {acknowledgedTests.has(test.id) ? (
                                    <>
                                      <CheckCheck className="h-4 w-4" />
                                      <span>Reviewed</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheck className="h-4 w-4" />
                                      <span>Mark as Reviewed</span>
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

      {/* Trend Chart Slide-out Panel */}
      {trendParam && (
        <div className="fixed inset-y-0 right-0 w-[500px] bg-white shadow-2xl border-l z-50 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Panel header */}
          <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{trendParam.paramName}</h2>
              <p className="text-sm text-gray-500">
                Historical trend
                {trendParam.unit && <> &middot; <span className="font-medium">{trendParam.unit}</span></>}
                {trendParam.referenceRange && <> &middot; ref: {trendParam.referenceRange}</>}
              </p>
            </div>
            <button
              onClick={() => setTrendParam(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close trend panel"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-auto p-6">
            {historyLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                <span className="ml-3 text-gray-500">Loading history…</span>
              </div>
            ) : trendData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <TrendingUp className="h-10 w-10 mb-2" />
                <p className="text-sm">No historical data available for this parameter</p>
              </div>
            ) : (
              <>
                {/* Chart */}
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(d: string) =>
                        new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      }
                    />
                    <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} width={45} />
                    <Tooltip
                      formatter={(value: number) => [`${value} ${trendParam.unit}`, trendParam.paramName]}
                      labelFormatter={(label: string) =>
                        new Date(label).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      }
                    />
                    {/* Reference range shaded zone */}
                    {parseReferenceRange(trendParam.referenceRange) && (() => {
                      const range = parseReferenceRange(trendParam.referenceRange)!;
                      return <ReferenceArea y1={range.min} y2={range.max} fill="#bbf7d0" fillOpacity={0.45} />;
                    })()}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={(dotProps: any) => {
                        const { cx, cy, payload } = dotProps;
                        const abnormal = payload.flag !== 'Normal';
                        return (
                          <circle
                            key={`dot-${cx}-${cy}`}
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill={abnormal ? '#ef4444' : '#6366f1'}
                            stroke="white"
                            strokeWidth={2}
                          />
                        );
                      }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div className="flex items-center gap-6 mt-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-green-200 border border-green-400" />
                    Reference range{trendParam.referenceRange ? `: ${trendParam.referenceRange} ${trendParam.unit}` : ''}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
                    Abnormal value
                  </div>
                </div>

                {/* Data table */}
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">All Values</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b">
                        <th className="text-left py-1.5 font-medium">Date</th>
                        <th className="text-right py-1.5 font-medium">Value</th>
                        <th className="text-center py-1.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[...trendData].reverse().map((point, i) => (
                        <tr key={i} className={point.flag !== 'Normal' ? 'bg-red-50/50' : ''}>
                          <td className="py-1.5 text-gray-600">
                            {new Date(point.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td className={`py-1.5 text-right font-semibold ${point.flag !== 'Normal' ? 'text-red-600' : 'text-gray-900'}`}>
                            {point.value} {trendParam.unit}
                          </td>
                          <td className="py-1.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${getFlagColor(point.flag)}`}>
                              {point.flag}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
