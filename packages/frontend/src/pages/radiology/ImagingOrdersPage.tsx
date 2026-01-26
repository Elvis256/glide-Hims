import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Calendar,
  User,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  ClipboardList,
  Syringe,
  History,
  Plus,
  ChevronRight,
  XCircle,
} from 'lucide-react';

type ConsentStatus = 'Obtained' | 'Pending' | 'Not Required';
type OrderStatus = 'Pending' | 'Scheduled' | 'Completed' | 'Cancelled';

interface ImagingOrder {
  id: string;
  patientName: string;
  patientId: string;
  studyType: string;
  modality: string;
  clinicalIndication: string;
  contrastRequired: boolean;
  contrastType?: string;
  orderingPhysician: string;
  orderDate: string;
  scheduledDate?: string;
  scheduledTime?: string;
  status: OrderStatus;
  consentStatus: ConsentStatus;
  preparationInstructions: string[];
  priorStudies: { date: string; study: string }[];
  urgency: string;
}

const mockOrders: ImagingOrder[] = [
  {
    id: 'ORD-2024-001',
    patientName: 'James Muthoni',
    patientId: 'P-20456',
    studyType: 'CT Abdomen/Pelvis',
    modality: 'CT',
    clinicalIndication: 'Abdominal pain, rule out appendicitis',
    contrastRequired: true,
    contrastType: 'IV Contrast (Iohexol)',
    orderingPhysician: 'Dr. Sarah Wanjiku',
    orderDate: '2024-01-15',
    scheduledDate: '2024-01-16',
    scheduledTime: '10:00 AM',
    status: 'Scheduled',
    consentStatus: 'Obtained',
    preparationInstructions: [
      'NPO for 4 hours before exam',
      'Drink 1L water 1 hour before',
      'Check creatinine levels',
    ],
    priorStudies: [
      { date: '2023-06-10', study: 'Abdominal X-Ray' },
      { date: '2022-12-05', study: 'CT Abdomen' },
    ],
    urgency: 'Urgent',
  },
  {
    id: 'ORD-2024-002',
    patientName: 'Lucy Achieng',
    patientId: 'P-20567',
    studyType: 'MRI Brain',
    modality: 'MRI',
    clinicalIndication: 'Chronic headaches, neurological evaluation',
    contrastRequired: false,
    orderingPhysician: 'Dr. Michael Oduya',
    orderDate: '2024-01-15',
    status: 'Pending',
    consentStatus: 'Pending',
    preparationInstructions: [
      'Remove all metal objects',
      'MRI safety screening required',
      'Arrive 30 minutes early',
    ],
    priorStudies: [],
    urgency: 'Routine',
  },
  {
    id: 'ORD-2024-003',
    patientName: 'Daniel Kiprop',
    patientId: 'P-20678',
    studyType: 'Chest X-Ray',
    modality: 'X-Ray',
    clinicalIndication: 'Persistent cough, rule out pneumonia',
    contrastRequired: false,
    orderingPhysician: 'Dr. Anne Mutua',
    orderDate: '2024-01-14',
    scheduledDate: '2024-01-15',
    scheduledTime: '02:30 PM',
    status: 'Completed',
    consentStatus: 'Not Required',
    preparationInstructions: ['No special preparation required'],
    priorStudies: [{ date: '2023-11-20', study: 'Chest X-Ray' }],
    urgency: 'Routine',
  },
  {
    id: 'ORD-2024-004',
    patientName: 'Faith Wanjala',
    patientId: 'P-20789',
    studyType: 'Pelvic Ultrasound',
    modality: 'Ultrasound',
    clinicalIndication: 'Pelvic pain, menstrual irregularities',
    contrastRequired: false,
    orderingPhysician: 'Dr. Elizabeth Akinyi',
    orderDate: '2024-01-15',
    status: 'Pending',
    consentStatus: 'Obtained',
    preparationInstructions: ['Full bladder required', 'Drink 32oz water 1 hour before'],
    priorStudies: [],
    urgency: 'Routine',
  },
  {
    id: 'ORD-2024-005',
    patientName: 'Robert Omondi',
    patientId: 'P-20890',
    studyType: 'CT Angiography',
    modality: 'CT',
    clinicalIndication: 'Suspected pulmonary embolism',
    contrastRequired: true,
    contrastType: 'IV Contrast (Iopamidol)',
    orderingPhysician: 'Dr. James Mwangi',
    orderDate: '2024-01-15',
    scheduledDate: '2024-01-15',
    scheduledTime: '11:30 AM',
    status: 'Scheduled',
    consentStatus: 'Obtained',
    preparationInstructions: [
      'NPO for 4 hours',
      'Verify allergy history',
      'Check renal function',
      'Start IV access',
    ],
    priorStudies: [{ date: '2024-01-14', study: 'Chest X-Ray' }],
    urgency: 'STAT',
  },
];

export default function ImagingOrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'All'>('All');
  const [selectedOrder, setSelectedOrder] = useState<ImagingOrder | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const filteredOrders = useMemo(() => {
    return mockOrders.filter((order) => {
      const matchesSearch =
        order.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.studyType.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'All' || order.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, selectedStatus]);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
    }
  };

  const getConsentIcon = (status: ConsentStatus) => {
    switch (status) {
      case 'Obtained':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'Pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'Not Required':
        return <XCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getConsentColor = (status: ConsentStatus) => {
    switch (status) {
      case 'Obtained':
        return 'text-green-700 bg-green-50';
      case 'Pending':
        return 'text-yellow-700 bg-yellow-50';
      case 'Not Required':
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Imaging Orders</h1>
          <p className="text-gray-600">View and manage radiology orders</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          New Order
        </button>
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
              onChange={(e) => setSelectedStatus(e.target.value as OrderStatus | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Orders List */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-auto h-full">
            <div className="divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedOrder?.id === order.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{order.patientName}</h3>
                          <span className="text-sm text-gray-500">{order.patientId}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-700 mt-1">{order.studyType}</p>
                        <p className="text-sm text-gray-500 mt-1">{order.clinicalIndication}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                          {order.contrastRequired && (
                            <span className="flex items-center gap-1 text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                              <Syringe className="w-3 h-3" />
                              Contrast
                            </span>
                          )}
                          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${getConsentColor(order.consentStatus)}`}>
                            {getConsentIcon(order.consentStatus)}
                            {order.consentStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">{order.orderDate}</p>
                      {order.scheduledDate && (
                        <p className="text-sm font-medium text-blue-600 mt-1">
                          {order.scheduledDate} {order.scheduledTime}
                        </p>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-400 mt-2 ml-auto" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Details Panel */}
        {selectedOrder ? (
          <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-gray-900">Order Details</h2>
              <p className="text-sm text-gray-500">{selectedOrder.id}</p>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {/* Patient Info */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Patient Information</h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{selectedOrder.patientName}</p>
                    <p className="text-sm text-gray-500">{selectedOrder.patientId}</p>
                  </div>
                </div>
              </div>

              {/* Study Info */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Study Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Study Type</p>
                    <p className="font-medium text-gray-900">{selectedOrder.studyType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Clinical Indication</p>
                    <p className="text-gray-900">{selectedOrder.clinicalIndication}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Ordering Physician</p>
                    <p className="text-gray-900">{selectedOrder.orderingPhysician}</p>
                  </div>
                </div>
              </div>

              {/* Contrast Info */}
              {selectedOrder.contrastRequired && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Contrast Information</h3>
                  <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                    <Syringe className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="font-medium text-purple-900">Contrast Required</p>
                      <p className="text-sm text-purple-700">{selectedOrder.contrastType}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Preparation Instructions */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Preparation Instructions</h3>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <ul className="space-y-2">
                    {selectedOrder.preparationInstructions.map((instruction, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-yellow-800">
                        <ClipboardList className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {instruction}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Prior Studies */}
              {selectedOrder.priorStudies.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Prior Studies</h3>
                  <div className="space-y-2">
                    {selectedOrder.priorStudies.map((study, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <History className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{study.study}</p>
                          <p className="text-xs text-gray-500">{study.date}</p>
                        </div>
                        <button className="ml-auto p-1 hover:bg-gray-200 rounded">
                          <Eye className="w-4 h-4 text-blue-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Consent Status */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Consent Status</h3>
                <div className={`flex items-center gap-2 p-3 rounded-lg ${getConsentColor(selectedOrder.consentStatus)}`}>
                  {getConsentIcon(selectedOrder.consentStatus)}
                  <span className="font-medium">{selectedOrder.consentStatus}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-2">
                {selectedOrder.status === 'Pending' && (
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule
                  </button>
                )}
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                  <FileText className="w-4 h-4" />
                  View Order
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Select an order to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
