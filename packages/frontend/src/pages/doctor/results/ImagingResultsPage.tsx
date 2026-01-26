import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Image,
  User,
  Calendar,
  FileText,
  AlertTriangle,
  X,
  ChevronDown,
  MessageSquare,
  Check,
  Monitor,
  Maximize2,
  ZoomIn,
  RotateCw,
  Download,
  ExternalLink,
  Stethoscope,
  Loader2,
} from 'lucide-react';
import { patientsService, type Patient as ApiPatient } from '../../../services/patients';
import { radiologyService, type RadiologyOrder, type RadiologyResult } from '../../../services/radiology';

interface ImagingStudy {
  id: string;
  modality: 'CT' | 'MRI' | 'X-Ray' | 'Ultrasound' | 'PET' | 'Mammogram';
  bodyPart: string;
  date: string;
  time: string;
  radiologist: string;
  status: 'Pending' | 'Preliminary' | 'Final';
  hasCriticalFindings: boolean;
  thumbnailPlaceholder: string;
  findings: string;
  impression: string;
  technique: string;
  comparison: string;
  acknowledged: boolean;
  clinicalComment?: string;
}

interface Patient {
  id: string;
  name: string;
  mrn: string;
  dob: string;
  studies: ImagingStudy[];
}

// Transform API modality to display modality
const mapModality = (modality: RadiologyOrder['modality']): ImagingStudy['modality'] => {
  const map: Record<RadiologyOrder['modality'], ImagingStudy['modality']> = {
    ct: 'CT',
    mri: 'MRI',
    xray: 'X-Ray',
    ultrasound: 'Ultrasound',
    mammogram: 'Mammogram',
    fluoroscopy: 'X-Ray',
  };
  return map[modality] || 'X-Ray';
};

// Transform API status to display status
const mapStatus = (order: RadiologyOrder, result?: RadiologyResult): ImagingStudy['status'] => {
  if (!result) return 'Pending';
  if (result.status === 'finalized') return 'Final';
  return 'Preliminary';
};

// Get thumbnail placeholder from modality
const getThumbnailPlaceholder = (modality: RadiologyOrder['modality']): string => {
  const map: Record<RadiologyOrder['modality'], string> = {
    ct: 'CT',
    mri: 'MR',
    xray: 'XR',
    ultrasound: 'US',
    mammogram: 'MG',
    fluoroscopy: 'FL',
  };
  return map[modality] || 'IM';
};

// Transform API patient to local Patient interface
const transformPatient = (
  apiPatient: ApiPatient,
  orders: RadiologyOrder[],
  results: RadiologyResult[]
): Patient => {
  const resultsByOrderId = new Map(results.map((r) => [r.orderId, r]));

  const studies: ImagingStudy[] = orders
    .filter((order) => order.status === 'completed' || order.status === 'reported')
    .map((order) => {
      const result = resultsByOrderId.get(order.id);
      const orderDate = new Date(order.completedAt || order.createdAt);

      return {
        id: order.id,
        modality: mapModality(order.modality),
        bodyPart: order.bodyPart,
        date: orderDate.toISOString().split('T')[0],
        time: orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        radiologist: result?.radiologist?.fullName || 'Pending Review',
        status: mapStatus(order, result),
        hasCriticalFindings: order.priority === 'stat',
        thumbnailPlaceholder: getThumbnailPlaceholder(order.modality),
        findings: result?.findings || 'Findings pending...',
        impression: result?.impression || 'Impression pending...',
        technique: `${order.examType} - ${order.bodyPart}`,
        comparison: 'None available',
        acknowledged: result?.status === 'finalized',
        clinicalComment: order.clinicalHistory,
      };
    });

  return {
    id: apiPatient.id,
    name: apiPatient.fullName,
    mrn: apiPatient.mrn,
    dob: apiPatient.dateOfBirth,
    studies,
  };
};

export default function ImagingResultsPage() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedStudy, setSelectedStudy] = useState<ImagingStudy | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [clinicalComment, setClinicalComment] = useState('');
  const [acknowledgedStudies, setAcknowledgedStudies] = useState<Set<string>>(new Set());

  // Fetch patients
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-imaging'],
    queryFn: () => patientsService.search({ limit: 50 }),
  });

  const patients = patientsData?.data || [];

  // Set initial patient when data loads
  const effectivePatientId = selectedPatientId || patients[0]?.id;

  // Fetch radiology orders for selected patient
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['radiology-orders', effectivePatientId],
    queryFn: () => radiologyService.orders.list(),
    enabled: !!effectivePatientId,
    select: (orders) => orders.filter((o) => o.patientId === effectivePatientId),
  });

  // Fetch radiology results for selected patient
  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ['radiology-results', effectivePatientId],
    queryFn: () => radiologyService.results.getByPatient(effectivePatientId!),
    enabled: !!effectivePatientId,
  });

  // Transform data
  const transformedPatients = useMemo(() => {
    return patients.map((p) => {
      const patientOrders = (ordersData || []).filter((o) => o.patientId === p.id);
      const patientResults = (resultsData || []).filter((r) =>
        patientOrders.some((o) => o.id === r.orderId)
      );
      return transformPatient(p, patientOrders, patientResults);
    });
  }, [patients, ordersData, resultsData]);

  const selectedPatient = useMemo(
    () => transformedPatients.find((p) => p.id === effectivePatientId) || transformedPatients[0],
    [effectivePatientId, transformedPatients]
  );

  const isLoading = patientsLoading || ordersLoading || resultsLoading;

  const getModalityColor = (modality: string) => {
    switch (modality) {
      case 'CT':
        return 'bg-blue-100 text-blue-700';
      case 'MRI':
        return 'bg-purple-100 text-purple-700';
      case 'X-Ray':
        return 'bg-gray-100 text-gray-700';
      case 'Ultrasound':
        return 'bg-teal-100 text-teal-700';
      case 'PET':
        return 'bg-orange-100 text-orange-700';
      case 'Mammogram':
        return 'bg-pink-100 text-pink-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Final':
        return 'bg-green-100 text-green-700';
      case 'Preliminary':
        return 'bg-yellow-100 text-yellow-700';
      case 'Pending':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const openReport = (study: ImagingStudy) => {
    setSelectedStudy(study);
    setShowReportModal(true);
    setClinicalComment(study.clinicalComment || '');
  };

  const acknowledgeStudy = (studyId: string) => {
    setAcknowledgedStudies((prev) => {
      const next = new Set(prev);
      next.add(studyId);
      return next;
    });
    setShowReportModal(false);
  };

  const isAcknowledged = (study: ImagingStudy) => study.acknowledged || acknowledgedStudies.has(study.id);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Image className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Imaging Results</h1>
              <p className="text-sm text-gray-500">Review radiology studies and reports</p>
            </div>
          </div>

          {/* Patient Selector */}
          <div className="relative">
            {patientsLoading ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg">
                <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                <span className="text-gray-500">Loading patients...</span>
              </div>
            ) : selectedPatient ? (
              <button
                onClick={() => setPatientDropdownOpen(!patientDropdownOpen)}
                className="flex items-center gap-3 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
              >
                <User className="h-5 w-5 text-gray-500" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{selectedPatient.name}</p>
                  <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                </div>
                <ChevronDown className="h-5 w-5 text-gray-400" />
              </button>
            ) : null}

            {patientDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-20">
                {transformedPatients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => {
                      setSelectedPatientId(patient.id);
                      setPatientDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${
                      patient.id === effectivePatientId ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <User className="h-5 w-5 text-gray-400" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{patient.name}</p>
                      <p className="text-xs text-gray-500">{patient.mrn}</p>
                    </div>
                    {patient.studies.some((s) => s.hasCriticalFindings && !s.acknowledged) && (
                      <AlertTriangle className="h-4 w-4 text-red-500 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mb-3" />
            <p>Loading imaging studies...</p>
          </div>
        ) : selectedPatient ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {selectedPatient.studies.map((study) => (
            <div
              key={study.id}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                study.hasCriticalFindings && !isAcknowledged(study) ? 'ring-2 ring-red-400' : ''
              }`}
            >
              {/* Thumbnail Placeholder */}
              <div className="relative h-48 bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                  <Monitor className="h-16 w-16 text-gray-600 mx-auto mb-2" />
                  <span className="text-2xl font-bold text-gray-500">{study.thumbnailPlaceholder}</span>
                  <p className="text-sm text-gray-500 mt-1">{study.bodyPart}</p>
                </div>

                {/* Critical Badge */}
                {study.hasCriticalFindings && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 bg-red-600 text-white text-xs font-medium rounded">
                    <AlertTriangle className="h-3 w-3" />
                    Critical
                  </div>
                )}

                {/* Status Badge */}
                <div className={`absolute top-3 right-3 px-2 py-1 text-xs font-medium rounded ${getStatusColor(study.status)}`}>
                  {study.status}
                </div>

                {/* View Image Button */}
                <button className="absolute bottom-3 right-3 flex items-center gap-1 px-3 py-1.5 bg-white/90 hover:bg-white text-gray-900 text-sm font-medium rounded-lg transition-colors">
                  <Maximize2 className="h-4 w-4" />
                  View in PACS
                </button>
              </div>

              {/* Study Info */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getModalityColor(study.modality)}`}>
                    {study.modality}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{study.bodyPart}</span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {study.date} at {study.time}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Stethoscope className="h-4 w-4" />
                    <span>{study.radiologist}</span>
                  </div>
                </div>

                {/* Findings Summary */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Impression</h4>
                  <p className="text-sm text-gray-700 line-clamp-3">{study.impression}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => openReport(study)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <FileText className="h-4 w-4" />
                    View Report
                  </button>
                  {isAcknowledged(study) ? (
                    <div className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg">
                      <Check className="h-4 w-4" />
                      <span className="text-sm font-medium">Ack</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => acknowledgeStudy(study.id)}
                      className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      <Check className="h-4 w-4" />
                      <span className="text-sm font-medium">Ack</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          </div>
        ) : null}

        {!isLoading && selectedPatient?.studies.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Image className="h-12 w-12 text-gray-300 mb-3" />
            <p>No imaging studies available</p>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {showReportModal && selectedStudy && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-sm font-medium rounded ${getModalityColor(selectedStudy.modality)}`}>
                  {selectedStudy.modality}
                </span>
                <h2 className="text-lg font-semibold text-gray-900">{selectedStudy.bodyPart}</h2>
                {selectedStudy.hasCriticalFindings && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-sm font-medium rounded">
                    <AlertTriangle className="h-4 w-4" />
                    Critical Findings
                  </span>
                )}
              </div>
              <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Patient</p>
                  <p className="font-medium text-gray-900">{selectedPatient.name}</p>
                  <p className="text-sm text-gray-500">{selectedPatient.mrn}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Study Date</p>
                  <p className="font-medium text-gray-900">{selectedStudy.date}</p>
                  <p className="text-sm text-gray-500">{selectedStudy.time}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Radiologist</p>
                  <p className="font-medium text-gray-900">{selectedStudy.radiologist}</p>
                  <p className="text-sm text-gray-500">Status: {selectedStudy.status}</p>
                </div>
              </div>

              {/* Image Viewer Placeholder */}
              <div className="bg-gray-900 rounded-lg h-48 mb-6 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <Monitor className="h-12 w-12 mx-auto mb-2" />
                  <p className="text-sm">PACS Image Viewer</p>
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <button className="p-2 bg-gray-800 rounded hover:bg-gray-700">
                      <ZoomIn className="h-5 w-5" />
                    </button>
                    <button className="p-2 bg-gray-800 rounded hover:bg-gray-700">
                      <RotateCw className="h-5 w-5" />
                    </button>
                    <button className="p-2 bg-gray-800 rounded hover:bg-gray-700">
                      <Maximize2 className="h-5 w-5" />
                    </button>
                    <button className="p-2 bg-gray-800 rounded hover:bg-gray-700">
                      <Download className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Report Sections */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Technique</h3>
                  <p className="text-gray-600">{selectedStudy.technique}</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Comparison</h3>
                  <p className="text-gray-600">{selectedStudy.comparison}</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Findings</h3>
                  <p className="text-gray-600 whitespace-pre-line">{selectedStudy.findings}</p>
                </div>

                <div
                  className={`p-4 rounded-lg ${selectedStudy.hasCriticalFindings ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}
                >
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Impression</h3>
                  <p className={`whitespace-pre-line ${selectedStudy.hasCriticalFindings ? 'text-red-700' : 'text-gray-600'}`}>
                    {selectedStudy.impression}
                  </p>
                </div>

                {/* Clinical Comment */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    <MessageSquare className="h-4 w-4 inline mr-1" />
                    Clinical Comment
                  </h3>
                  <textarea
                    value={clinicalComment}
                    onChange={(e) => setClinicalComment(e.target.value)}
                    placeholder="Add your clinical comment..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
                <ExternalLink className="h-4 w-4" />
                Open in PACS
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => acknowledgeStudy(selectedStudy.id)}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Check className="h-4 w-4" />
                  Acknowledge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
