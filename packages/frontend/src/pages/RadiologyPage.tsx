import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useFacilityId } from '../lib/facility';
import { useAuthStore } from '../store/auth';
import {
  Scan,
  Search,
  Clock,
  CheckCircle,
  AlertTriangle,
  User,
  RefreshCw,
  Play,
  FileText,
  X,
  Calendar,
  Activity,
} from 'lucide-react';

interface ImagingOrder {
  id: string;
  orderNumber: string;
  patientId: string;
  patient?: { id: string; mrn: string; firstName: string; lastName: string };
  modalityId: string;
  modality?: { name: string; modalityType: string };
  studyType: string;
  bodyPart?: string;
  clinicalHistory?: string;
  clinicalIndication?: string;
  priority: string;
  status: string;
  orderedById: string;
  orderedBy?: { firstName: string; lastName: string };
  orderedAt: string;
  scheduledAt?: string;
  performedAt?: string;
  performedBy?: { firstName: string; lastName: string };
}

interface DashboardStats {
  totalModalities: number;
  pendingOrders: number;
  todayOrders: number;
  completedPendingReport: number;
  reportedToday: number;
}

const statusColors: Record<string, string> = {
  ordered: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-orange-100 text-orange-800',
  reported: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const priorityColors: Record<string, string> = {
  routine: 'bg-gray-100 text-gray-800',
  urgent: 'bg-orange-100 text-orange-800',
  stat: 'bg-red-100 text-red-800',
};

function getTAT(orderedAt: string): { label: string; colorClass: string } {
  const diffMs = Date.now() - new Date(orderedAt).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const label =
    diffHours < 1 ? `${Math.round(diffHours * 60)}m` : `${diffHours.toFixed(1)}h`;
  const colorClass =
    diffHours < 2
      ? 'text-green-600 font-medium'
      : diffHours < 4
      ? 'text-orange-600 font-medium'
      : 'text-red-600 font-bold';
  return { label, colorClass };
}

export default function RadiologyPage() {
  const facilityId = useFacilityId();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'worklist' | 'orders' | 'pending-reports'>('worklist');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<ImagingOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ImagingOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalityFilter, setModalityFilter] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab, facilityId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const dashRes = await api.get(`/radiology/dashboard?facilityId=${facilityId}`);
      setDashboard(dashRes.data);

      let ordersRes;
      if (activeTab === 'worklist') {
        ordersRes = await api.get(`/radiology/worklist?facilityId=${facilityId}`);
      } else if (activeTab === 'pending-reports') {
        ordersRes = await api.get(`/radiology/pending-reports?facilityId=${facilityId}`);
      } else {
        ordersRes = await api.get(`/radiology/orders?facilityId=${facilityId}`);
      }
      setOrders(ordersRes.data || []);
    } catch (error) {
      console.error('Error loading radiology data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartImaging = async (orderId: string) => {
    try {
      await api.post(`/radiology/orders/${orderId}/start`);
      loadData();
    } catch (error) {
      console.error('Error starting imaging:', error);
    }
  };

  const handleCompleteImaging = async (orderId: string) => {
    setShowCompleteModal(true);
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchTerm && !modalityFilter) return true;
    const search = searchTerm.toLowerCase();
    const patientName = `${order.patient?.firstName || ''} ${order.patient?.lastName || ''}`.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      order.orderNumber.toLowerCase().includes(search) ||
      order.patient?.mrn?.toLowerCase().includes(search) ||
      patientName.includes(search) ||
      order.studyType.toLowerCase().includes(search);
    const matchesModality =
      !modalityFilter ||
      (order.modality?.modalityType || '').toLowerCase() === modalityFilter.toLowerCase() ||
      (order.modality?.name || '').toLowerCase().includes(modalityFilter.toLowerCase());
    return matchesSearch && matchesModality;
  });

  // Unique modality types for filter dropdown
  const modalityTypes = Array.from(
    new Set(orders.map((o) => o.modality?.modalityType).filter(Boolean))
  ) as string[];

  const tabs = [
    { id: 'worklist', label: 'Worklist', icon: Activity },
    { id: 'orders', label: 'All Orders', icon: FileText },
    { id: 'pending-reports', label: 'Pending Reports', icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Radiology</h1>
          <p className="text-gray-600">Imaging orders, worklist, and reports</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Scan className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-900">{dashboard.totalModalities}</p>
                <p className="text-sm text-blue-700">Modalities</p>
              </div>
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold text-yellow-900">{dashboard.pendingOrders}</p>
                <p className="text-sm text-yellow-700">Pending</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-purple-900">{dashboard.todayOrders}</p>
                <p className="text-sm text-purple-700">Today's Orders</p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold text-orange-900">{dashboard.completedPendingReport}</p>
                <p className="text-sm text-orange-700">Awaiting Report</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-900">{dashboard.reportedToday}</p>
                <p className="text-sm text-green-700">Reported Today</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by order #, MRN, patient name, or study..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {activeTab === 'worklist' && modalityTypes.length > 0 && (
          <select
            value={modalityFilter}
            onChange={(e) => setModalityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">All Modalities</option>
            {modalityTypes.map((m) => (
              <option key={m} value={m}>{m.toUpperCase()}</option>
            ))}
          </select>
        )}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Orders List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">
                {activeTab === 'worklist' ? 'Active Worklist' : activeTab === 'pending-reports' ? 'Pending Reports' : 'All Orders'}
              </h2>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Scan className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No imaging orders found</p>
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const tat = getTAT(order.orderedAt);
                  return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${
                      selectedOrder?.id === order.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{order.orderNumber}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[order.status] || 'bg-gray-100'}`}>
                            {order.status.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${priorityColors[order.priority] || 'bg-gray-100'}`}>
                            {order.priority.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                          <User className="w-4 h-4" />
                          <span>{order.patient?.firstName} {order.patient?.lastName}</span>
                          <span className="text-gray-400">•</span>
                          <span>{order.patient?.mrn}</span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1 font-medium">
                          {order.studyType}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <p className="text-xs text-gray-500">
                            {order.modality?.name} ({order.modality?.modalityType})
                          </p>
                          <span className="text-gray-300">•</span>
                          <span className={`text-xs flex items-center gap-0.5 ${tat.colorClass}`}>
                            <Clock className="w-3 h-3" /> {tat.label}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(order.orderedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Order Details Panel */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Order Details</h2>
            </div>
            {selectedOrder ? (
              <div className="p-4">
                {/* Patient Info */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedOrder.patient?.firstName} {selectedOrder.patient?.lastName}</p>
                      <p className="text-sm text-gray-500">
                        {selectedOrder.patient?.mrn} • {selectedOrder.orderNumber}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Study Info */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Study Type</span>
                    <span className="text-gray-900 font-medium">{selectedOrder.studyType}</span>
                  </div>
                  {selectedOrder.bodyPart && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Body Part</span>
                      <span className="text-gray-900">{selectedOrder.bodyPart}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Modality</span>
                    <span className="text-gray-900">{selectedOrder.modality?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[selectedOrder.status] || 'bg-gray-100'}`}>
                      {selectedOrder.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Priority</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${priorityColors[selectedOrder.priority] || 'bg-gray-100'}`}>
                      {selectedOrder.priority.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ordered By</span>
                    <span className="text-gray-900">
                      {selectedOrder.orderedBy?.firstName} {selectedOrder.orderedBy?.lastName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ordered At</span>
                    <span className="text-gray-900">{new Date(selectedOrder.orderedAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Clinical History */}
                {selectedOrder.clinicalHistory && (
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">Clinical History</h3>
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{selectedOrder.clinicalHistory}</p>
                  </div>
                )}

                {/* Clinical Indication */}
                {selectedOrder.clinicalIndication && (
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">Clinical Indication</h3>
                    <p className="text-sm text-gray-600 bg-blue-50 p-2 rounded">{selectedOrder.clinicalIndication}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  {(selectedOrder.status === 'ordered' || selectedOrder.status === 'scheduled') && (
                    <button
                      onClick={() => handleStartImaging(selectedOrder.id)}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Start Imaging
                    </button>
                  )}
                  {selectedOrder.status === 'in_progress' && (
                    <button
                      onClick={() => handleCompleteImaging(selectedOrder.id)}
                      className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Complete Imaging
                    </button>
                  )}
                  {selectedOrder.status === 'completed' && (
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Create Report
                    </button>
                  )}
                  {selectedOrder.status === 'reported' && (
                    <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                      <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                      <p className="text-green-800 font-medium">Report Completed</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Scan className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Select an order to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && selectedOrder && (
        <RadiologyReportModal
          order={selectedOrder}
          onClose={() => setShowReportModal(false)}
          onSuccess={() => {
            loadData();
            setShowReportModal(false);
            setSelectedOrder(null);
          }}
        />
      )}

      {/* Complete Imaging Modal */}
      {showCompleteModal && selectedOrder && (
        <CompleteImagingModal
          order={selectedOrder}
          userId={user?.id}
          onClose={() => setShowCompleteModal(false)}
          onSuccess={() => {
            loadData();
            setShowCompleteModal(false);
          }}
        />
      )}
    </div>
  );
}

// Complete Imaging Modal
function CompleteImagingModal({
  order,
  userId,
  onClose,
  onSuccess,
}: {
  order: ImagingOrder;
  userId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/radiology/orders/${order.id}/complete`, {
        findings: findings || undefined,
        impression: impression || undefined,
        technologistId: userId,
        performedAt: new Date(),
      });
      onSuccess();
    } catch (error) {
      console.error('Error completing imaging:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Complete Imaging — {order.orderNumber}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial Findings (optional)</label>
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Brief technologist findings..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Impression (optional)</label>
            <textarea
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Brief impression..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {submitting ? 'Completing...' : 'Mark as Complete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Radiology Report Modal
function RadiologyReportModal({
  order,
  onClose,
  onSuccess,
}: {
  order: ImagingOrder;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const DRAFT_KEY = `radiology-draft-${order.id}`;
  const CRITICAL_KEYWORDS = ['mass', 'fracture', 'hemorrhage', 'tumor', 'malignant', 'metastasis', 'abscess', 'embolism', 'rupture', 'infarct'];

  const savedDraft = (() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; }
  })();

  const [findings, setFindings] = useState<string>(savedDraft.findings || '');
  const [impression, setImpression] = useState<string>(savedDraft.impression || '');
  const [recommendations, setRecommendations] = useState<string>(savedDraft.recommendations || '');
  const [findingCategory, setFindingCategory] = useState<string>(savedDraft.findingCategory || 'normal');
  const [isCritical, setIsCritical] = useState<boolean>(savedDraft.isCritical || false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-save draft to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ findings, impression, recommendations, findingCategory, isCritical }));
    }, 800);
    return () => clearTimeout(timer);
  }, [findings, impression, recommendations, findingCategory, isCritical]);

  // Detect critical keywords
  const detectedCritical = CRITICAL_KEYWORDS.some(
    (kw) => findings.toLowerCase().includes(kw) || impression.toLowerCase().includes(kw)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/radiology/results', {
        imagingOrderId: order.id,
        findings,
        impression,
        recommendations,
        findingCategory,
        isCritical: isCritical || detectedCritical,
      });
      localStorage.removeItem(DRAFT_KEY);
      onSuccess();
    } catch (error) {
      console.error('Error submitting report:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold">Radiology Report</h2>
            <p className="text-sm text-gray-500">{order.orderNumber} - {order.patient?.firstName} {order.patient?.lastName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Critical Finding Alert */}
          {detectedCritical && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg p-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">
                Potential critical finding detected — urgent radiologist review required.
              </p>
            </div>
          )}

          {/* Auto-save indicator */}
          <p className="text-xs text-gray-400 text-right">Draft auto-saved</p>

          {/* Study Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <h3 className="font-medium text-gray-900 mb-2">Study</h3>
            <p className="text-sm text-gray-600">{order.studyType}</p>
            <p className="text-xs text-gray-500">{order.modality?.name}</p>
          </div>

          {/* Finding Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Finding Category *</label>
            <select
              value={findingCategory}
              onChange={(e) => setFindingCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="normal">Normal</option>
              <option value="abnormal">Abnormal</option>
              <option value="critical">Critical</option>
              <option value="indeterminate">Indeterminate</option>
            </select>
          </div>

          {/* Critical Flag */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isCritical"
              checked={isCritical}
              onChange={(e) => setIsCritical(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded"
            />
            <label htmlFor="isCritical" className="text-sm font-medium text-red-700">
              Critical Finding - Requires immediate notification
            </label>
          </div>

          {/* Findings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Findings *</label>
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the imaging findings in detail..."
              required
            />
          </div>

          {/* Impression */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Impression</label>
            <textarea
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Summary impression / diagnosis..."
            />
          </div>

          {/* Recommendations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recommendations</label>
            <textarea
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Follow-up recommendations..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !findings.trim()}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
