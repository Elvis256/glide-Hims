import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import {
  Search,
  Filter,
  User,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  Mic,
  Save,
  Send,
  Image,
  ChevronDown,
  AlertCircle,
  PenTool,
  X,
  Loader2,
} from 'lucide-react';
import { radiologyService, type RadiologyOrder } from '../../services';
import { useFacilityId } from '../../lib/facility';

type ReportStatus = 'Pending' | 'In Progress' | 'Completed' | 'Signed';

interface Study {
  id: string;
  patientName: string;
  patientId: string;
  studyType: string;
  modality: string;
  studyDate: string;
  acquisitionTime: string;
  referringPhysician: string;
  status: ReportStatus;
  priority: string;
  criticalFinding: boolean;
  images: number;
  assignedRadiologist?: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  sections: { title: string; content: string }[];
}



const reportTemplates: ReportTemplate[] = [
  {
    id: 'TPL-001',
    name: 'Chest X-Ray Normal',
    sections: [
      { title: 'Technique', content: 'PA and lateral views of the chest were obtained.' },
      { title: 'Findings', content: 'Heart size is normal. Lungs are clear bilaterally. No pleural effusion or pneumothorax. Mediastinal contours are unremarkable. Bony thorax is intact.' },
      { title: 'Impression', content: 'Normal chest radiograph.' },
    ],
  },
  {
    id: 'TPL-002',
    name: 'CT Abdomen',
    sections: [
      { title: 'Technique', content: 'CT of the abdomen and pelvis with IV contrast.' },
      { title: 'Findings', content: '' },
      { title: 'Impression', content: '' },
      { title: 'Recommendations', content: '' },
    ],
  },
];

export default function RadiologyResultsPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | 'All'>('All');
  const [selectedStudy, setSelectedStudy] = useState<Study | null>(null);
  const [showCriticalAlert, setShowCriticalAlert] = useState(false);
  const [reportContent, setReportContent] = useState({
    findings: '',
    impression: '',
    recommendations: '',
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isDictating, setIsDictating] = useState(false);

  if (!hasPermission('radiology.results')) {
    return <AccessDenied />;
  }

  // Helper to extract modality string from modality object or string
  const getModalityString = (modality?: { modalityType?: string; name?: string } | string): string => {
    if (!modality) return 'X-Ray';
    if (typeof modality === 'string') return modality;
    return modality.modalityType || modality.name || 'X-Ray';
  };

  // Fetch radiology orders from API
  const { data: apiOrders, isLoading } = useQuery({
    queryKey: ['radiology-orders', 'results', facilityId],
    queryFn: () => radiologyService.orders.list(facilityId, { status: 'completed' }),
    staleTime: 20000,
  });

  // Transform API orders to study format
  const studies: Study[] = useMemo(() => {
    const orders: RadiologyOrder[] = apiOrders || [];
    if (orders.length === 0) return [];
    return orders.map((order: RadiologyOrder) => ({
      id: order.id,
      patientName: order.patient?.fullName || 'Unknown',
      patientId: order.patientId,
      studyType: order.examType || 'Imaging Study',
      modality: getModalityString(order.modality),
      studyDate: order.orderedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
      acquisitionTime: order.scheduledAt ? new Date(order.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      referringPhysician: order.doctor?.fullName || 'Dr. Unknown',
      status: (order.status === 'completed' || order.status === 'reported' ? 'Completed' : 
               order.status === 'in_progress' ? 'In Progress' : 'Pending') as ReportStatus,
      priority: order.priority?.toUpperCase() === 'STAT' ? 'STAT' : 
                order.priority === 'urgent' ? 'Urgent' : 'Routine',
      criticalFinding: order.priority === 'stat',
      images: 1,
      assignedRadiologist: order.assignedTo,
    }));
  }, [apiOrders]);

  // Sign report mutation
  const signReportMutation = useMutation({
    mutationFn: (data: { orderId: string; findings: string; impression: string; recommendations: string }) =>
      radiologyService.results.create({
        imagingOrderId: data.orderId,
        findings: data.findings,
        impression: data.impression,
        recommendations: data.recommendations,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology-orders'] });
      setSelectedStudy(null);
      setReportContent({ findings: '', impression: '', recommendations: '' });
    },
  });

  const filteredStudies = useMemo(() => {
    return studies.filter((study) => {
      const matchesSearch =
        study.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        study.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        study.studyType.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'All' || study.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, selectedStatus, studies]);

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'Signed':
        return 'bg-purple-100 text-purple-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'STAT':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Urgent':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = reportTemplates.find((t) => t.id === templateId);
    if (template) {
      const findings = template.sections.find((s) => s.title === 'Findings')?.content || '';
      const impression = template.sections.find((s) => s.title === 'Impression')?.content || '';
      const recommendations = template.sections.find((s) => s.title === 'Recommendations')?.content || '';
      setReportContent({ findings, impression, recommendations });
    }
    setSelectedTemplate(templateId);
  };

  const pendingCount = studies.filter((s) => s.status === 'Pending').length;
  const criticalCount = studies.filter((s) => s.criticalFinding).length;

  const handleSignReport = () => {
    if (!selectedStudy) return;
    signReportMutation.mutate({
      orderId: selectedStudy.id,
      findings: reportContent.findings,
      impression: reportContent.impression,
      recommendations: reportContent.recommendations,
    });
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Radiology Results</h1>
          <p className="text-gray-600">Report and sign imaging studies</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Clock className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">{pendingCount} Pending Reports</span>
          </div>
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">{criticalCount} Critical Findings</span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name, ID, or study type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ReportStatus | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Signed">Signed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Studies List */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-900">Studies</h2>
          </div>
          <div className="flex-1 overflow-auto">
            <div className="divide-y divide-gray-200">
              {filteredStudies.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No studies found</p>
                </div>
              )}
              {filteredStudies.map((study) => (
                <div
                  key={study.id}
                  className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedStudy?.id === study.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                  onClick={() => setSelectedStudy(study)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 text-sm">{study.patientName}</h3>
                        {study.criticalFinding && (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{study.patientId}</p>
                      <p className="text-sm text-gray-700 mt-1">{study.studyType}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(study.status)}`}>
                          {study.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(study.priority)}`}>
                          {study.priority}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{study.acquisitionTime}</p>
                      <p className="text-xs text-gray-400">{study.images} images</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Image Viewer Placeholder */}
        <div className="flex-1 bg-black rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-3 bg-gray-900 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image className="w-5 h-5 text-gray-400" />
              <span className="text-white font-medium">PACS Viewer</span>
            </div>
            {selectedStudy && (
              <div className="flex items-center gap-4 text-gray-300 text-sm">
                <span>{selectedStudy.patientName}</span>
                <span>{selectedStudy.studyType}</span>
                <span>{selectedStudy.images} images</span>
              </div>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center">
            {selectedStudy ? (
              <div className="text-center">
                <Image className="w-24 h-24 mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400 text-lg">PACS Integration Placeholder</p>
                <p className="text-gray-500 text-sm mt-2">Medical images would be displayed here</p>
                <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto">
                  <Eye className="w-4 h-4" />
                  Open in PACS Viewer
                </button>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <Image className="w-16 h-16 mx-auto mb-3 text-gray-600" />
                <p>Select a study to view images</p>
              </div>
            )}
          </div>
        </div>

        {/* Report Panel */}
        <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Report</h2>
            {selectedStudy && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsDictating(!isDictating)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDictating ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {selectedStudy ? (
            <>
              <div className="flex-1 overflow-auto p-4">
                {/* Template Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Report Template</label>
                  <div className="relative">
                    <select
                      value={selectedTemplate}
                      onChange={(e) => handleTemplateSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none"
                    >
                      <option value="">Select a template...</option>
                      {reportTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Critical Finding Alert */}
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showCriticalAlert}
                      onChange={(e) => setShowCriticalAlert(e.target.checked)}
                      className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700">Critical Finding Alert</span>
                  </label>
                  {showCriticalAlert && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">
                        Critical finding will be communicated immediately to the referring physician.
                      </p>
                    </div>
                  )}
                </div>

                {/* Findings */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Findings</label>
                  <textarea
                    value={reportContent.findings}
                    onChange={(e) => setReportContent({ ...reportContent, findings: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Enter detailed findings..."
                  />
                </div>

                {/* Impression */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Impression</label>
                  <textarea
                    value={reportContent.impression}
                    onChange={(e) => setReportContent({ ...reportContent, impression: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Enter impression..."
                  />
                </div>

                {/* Recommendations */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Recommendations</label>
                  <textarea
                    value={reportContent.recommendations}
                    onChange={(e) => setReportContent({ ...reportContent, recommendations: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Enter recommendations..."
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                    <Save className="w-4 h-4" />
                    Save Draft
                  </button>
                  <button 
                    onClick={handleSignReport}
                    disabled={signReportMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {signReportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
                    Sign Report
                  </button>
                </div>
                {showCriticalAlert && (
                  <button 
                    onClick={handleSignReport}
                    className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    Sign & Alert Physician
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Select a study to create report</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}