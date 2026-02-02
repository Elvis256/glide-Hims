import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  User, Phone, Mail, MapPin, Calendar, Heart, AlertCircle, 
  FileText, Activity, CreditCard, ArrowLeft, Edit, Clock, 
  Building2, Users, Printer, MessageSquare, Star, Shield,
  ChevronDown, ChevronUp, Filter, Download, Upload, Plus,
  Stethoscope, Receipt, FolderOpen, StickyNote, Eye,
  Briefcase, Globe, BookUser, IdCard, Droplets
} from 'lucide-react';
import { patientsService, type Patient } from '../services/patients';
import { billingService, type Invoice, type Payment } from '../services/billing';
import { encountersService, type Encounter } from '../services/encounters';
import { usePermissions } from '../components/PermissionGate';

// Types
interface PatientNote {
  id: string;
  type: 'clinical' | 'administrative';
  content: string;
  createdBy: string;
  createdAt: string;
}

interface PatientDocument {
  id: string;
  name: string;
  type: 'id' | 'insurance_card' | 'consent' | 'lab_report' | 'other';
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  url?: string;
}

// Utility functions
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(amount);
};

const calculateAge = (dob: string) => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Tab types
type TabType = 'overview' | 'visits' | 'billing' | 'documents' | 'notes';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();

  // State
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
  const [visitFilters, setVisitFilters] = useState({ dateFrom: '', dateTo: '', department: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [newNote, setNewNote] = useState({ type: 'administrative' as 'clinical' | 'administrative', content: '' });
  const [showNoteForm, setShowNoteForm] = useState(false);

  // Permissions
  const canEdit = hasPermission('patients.update');
  const canViewBilling = hasPermission('billing.read');
  const canIssueToken = hasPermission('queue.create');
  const canWriteNotes = hasPermission('patients.update');

  // Queries
  const { data: patient, isLoading, error } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsService.getById(id!),
    enabled: !!id,
  });

  const { data: visitsData } = useQuery({
    queryKey: ['patient-visits', id, visitFilters],
    queryFn: () => encountersService.list({ 
      patientId: id,
      dateFrom: visitFilters.dateFrom || undefined,
      dateTo: visitFilters.dateTo || undefined,
      department: visitFilters.department || undefined,
      limit: 50
    }),
    enabled: !!id && activeTab === 'visits',
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['patient-invoices', id],
    queryFn: () => billingService.invoices.list({ patientId: id, limit: 50 }),
    enabled: !!id && activeTab === 'billing' && canViewBilling,
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['patient-payments', id],
    queryFn: () => billingService.payments.list(),
    enabled: !!id && activeTab === 'billing' && canViewBilling,
  });

  // Mock data for documents and notes (would be real API calls)
  const documents: PatientDocument[] = [];
  const notes: PatientNote[] = [];

  // Calculate billing summary
  const invoices = invoicesData?.data || [];
  const payments = paymentsData || [];
  const patientPayments = payments.filter((p: Payment) => 
    invoices.some((inv: Invoice) => inv.id === p.invoiceId)
  );
  
  const billingSummary = {
    totalBilled: invoices.reduce((sum: number, inv: Invoice) => sum + inv.totalAmount, 0),
    totalPaid: invoices.reduce((sum: number, inv: Invoice) => sum + inv.paidAmount, 0),
    outstanding: invoices.reduce((sum: number, inv: Invoice) => sum + inv.balance, 0),
  };

  // Handlers
  const handlePrintCard = () => {
    toast.success('Printing patient card...');
    window.print();
  };

  const handleSendSMS = () => {
    if (!patient?.phone) {
      toast.error('No phone number available');
      return;
    }
    toast.success(`SMS dialog opened for ${patient.phone}`);
    // Would open SMS modal
  };

  const handleAddNote = () => {
    if (!newNote.content.trim()) {
      toast.error('Note content is required');
      return;
    }
    toast.success('Note added successfully');
    setNewNote({ type: 'administrative', content: '' });
    setShowNoteForm(false);
    // Would call API to add note
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Error state
  if (error || !patient) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <AlertCircle className="w-5 h-5 inline mr-2" />
          Patient not found or an error occurred.
        </div>
        <button 
          onClick={() => navigate(-1)} 
          className="mt-4 text-blue-600 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  // Extended patient type with additional fields
  const extendedPatient = patient as Patient & {
    status?: string;
    isVip?: boolean;
    nationality?: string;
    religion?: string;
    occupation?: string;
    district?: string;
    village?: string;
    paymentType?: string;
    insuranceProvider?: string;
    insurancePolicyNumber?: string;
    insuranceValidUntil?: string;
  };

  // Tab definitions
  const tabs: { id: TabType; label: string; icon: React.ReactNode; permission?: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: <User className="w-4 h-4" /> },
    { id: 'visits', label: 'Visits', icon: <Activity className="w-4 h-4" /> },
    { id: 'billing', label: 'Billing', icon: <CreditCard className="w-4 h-4" />, permission: canViewBilling },
    { id: 'documents', label: 'Documents', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'notes', label: 'Notes', icon: <StickyNote className="w-4 h-4" /> },
  ];

  const visibleTabs = tabs.filter(tab => tab.permission !== false);
  const visits = visitsData?.data || [];

  return (
    <div className="p-6 space-y-6">
      {/* Back button and title */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient Profile</h1>
          <p className="text-gray-500">Comprehensive patient information</p>
        </div>
      </div>

      {/* Header Section - Patient Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-28 h-28 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              {getInitials(patient.fullName)}
            </div>
          </div>

          {/* Patient Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h2 className="text-2xl font-bold text-gray-900">{patient.fullName}</h2>
              
              {/* Status Badges */}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                extendedPatient.status === 'inactive' 
                  ? 'bg-gray-100 text-gray-700' 
                  : 'bg-green-100 text-green-700'
              }`}>
                {extendedPatient.status === 'inactive' ? 'Inactive' : 'Active'}
              </span>
              
              {extendedPatient.paymentType && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  extendedPatient.paymentType === 'insurance' 
                    ? 'bg-blue-100 text-blue-700'
                    : extendedPatient.paymentType === 'corporate'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  <Shield className="w-3 h-3 inline mr-1" />
                  {extendedPatient.paymentType === 'insurance' ? 'Insurance' : 
                   extendedPatient.paymentType === 'corporate' ? 'Corporate' :
                   extendedPatient.paymentType === 'membership' ? 'Member' : 'Cash'}
                </span>
              )}
              
              {extendedPatient.isVip && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
                  <Star className="w-3 h-3 inline mr-1" />
                  VIP
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-gray-600 mb-4">
              <span className="font-mono bg-gray-100 px-3 py-1 rounded text-sm font-medium">
                MRN: {patient.mrn}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {patient.dateOfBirth ? `${calculateAge(patient.dateOfBirth)} years` : 'N/A'}
              </span>
              <span className="capitalize flex items-center gap-1">
                <User className="w-4 h-4" />
                {patient.gender || 'N/A'}
              </span>
              {patient.bloodGroup && (
                <span className="flex items-center gap-1 text-red-600 font-medium">
                  <Droplets className="w-4 h-4" />
                  {patient.bloodGroup}
                </span>
              )}
              {patient.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  {patient.phone}
                </span>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <button
                  onClick={() => navigate(`/patients/${id}/edit`)}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <Edit className="w-4 h-4" />
                  Edit Profile
                </button>
              )}
              
              {canIssueToken && (
                <button
                  onClick={() => navigate(`/opd/token?patientId=${id}`)}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Clock className="w-4 h-4" />
                  Issue Token
                </button>
              )}
              
              <button
                onClick={handlePrintCard}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Printer className="w-4 h-4" />
                Print Card
              </button>
              
              <button
                onClick={handleSendSMS}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <MessageSquare className="w-4 h-4" />
                Send SMS
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabbed Interface */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <IdCard className="w-5 h-5 text-blue-600" />
                  Personal Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Full Name</span>
                    <span className="text-gray-900 font-medium">{patient.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date of Birth</span>
                    <span className="text-gray-900">
                      {patient.dateOfBirth ? `${formatDate(patient.dateOfBirth)} (${calculateAge(patient.dateOfBirth)} yrs)` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Gender</span>
                    <span className="text-gray-900 capitalize">{patient.gender || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Blood Group</span>
                    <span className="text-gray-900">{patient.bloodGroup || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">National ID</span>
                    <span className="text-gray-900">{patient.nationalId || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nationality</span>
                    <span className="text-gray-900">{extendedPatient.nationality || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Religion</span>
                    <span className="text-gray-900">{extendedPatient.religion || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Occupation</span>
                    <span className="text-gray-900">{extendedPatient.occupation || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-blue-600" />
                  Contact Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-gray-500">Phone</span>
                    <span className="text-gray-900">{patient.phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-gray-500">Email</span>
                    <span className="text-gray-900 text-right break-all">{patient.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-gray-500">Address</span>
                    <span className="text-gray-900 text-right">{patient.address || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">District</span>
                    <span className="text-gray-900">{extendedPatient.district || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Village</span>
                    <span className="text-gray-900">{extendedPatient.village || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Emergency/Next of Kin */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Emergency Contact / Next of Kin
                </h3>
                {patient.nextOfKin ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Name</span>
                      <span className="text-gray-900">{patient.nextOfKin.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Phone</span>
                      <span className="text-gray-900">{patient.nextOfKin.phone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Relationship</span>
                      <span className="text-gray-900 capitalize">{patient.nextOfKin.relationship || 'N/A'}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No emergency contact information</p>
                )}
              </div>

              {/* Insurance/Payment Information */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Insurance / Payment Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Coverage Type</span>
                    <span className="text-gray-900 capitalize">{extendedPatient.paymentType || 'Cash'}</span>
                  </div>
                  {extendedPatient.paymentType === 'insurance' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Provider</span>
                        <span className="text-gray-900">{extendedPatient.insuranceProvider || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Policy Number</span>
                        <span className="text-gray-900">{extendedPatient.insurancePolicyNumber || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Valid Until</span>
                        <span className="text-gray-900">
                          {extendedPatient.insuranceValidUntil ? formatDate(extendedPatient.insuranceValidUntil) : 'N/A'}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Registered On</span>
                    <span className="text-gray-900">{patient.createdAt ? formatDate(patient.createdAt) : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Visits Tab */}
          {activeTab === 'visits' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {showFilters && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                    <input
                      type="date"
                      value={visitFilters.dateFrom}
                      onChange={(e) => setVisitFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                    <input
                      type="date"
                      value={visitFilters.dateTo}
                      onChange={(e) => setVisitFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select
                      value={visitFilters.department}
                      onChange={(e) => setVisitFilters(prev => ({ ...prev, department: e.target.value }))}
                      className="input text-sm"
                    >
                      <option value="">All Departments</option>
                      <option value="general">General</option>
                      <option value="emergency">Emergency</option>
                      <option value="pediatrics">Pediatrics</option>
                      <option value="gynecology">Gynecology</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Visits Timeline */}
              {visits.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No visits found</p>
                  <button
                    onClick={() => navigate(`/encounters/new?patientId=${id}`)}
                    className="mt-3 text-blue-600 hover:underline text-sm"
                  >
                    Start a new visit
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {visits.map((visit: Encounter) => (
                    <div 
                      key={visit.id}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <div 
                        className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                        onClick={() => setExpandedVisit(expandedVisit === visit.id ? null : visit.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${
                            visit.status === 'completed' ? 'bg-green-500' :
                            visit.status === 'cancelled' ? 'bg-red-500' :
                            visit.status === 'in_consultation' ? 'bg-blue-500' :
                            'bg-yellow-500'
                          }`} />
                          <div>
                            <div className="font-medium text-gray-900">
                              {formatDate(visit.visitDate || visit.createdAt)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {visit.visitNumber} • {visit.type?.toUpperCase()} • {visit.department || 'General'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            visit.status === 'completed' ? 'bg-green-100 text-green-700' :
                            visit.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {visit.status?.replace('_', ' ')}
                          </span>
                          {expandedVisit === visit.id ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                      
                      {expandedVisit === visit.id && (
                        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-sm">
                            <div>
                              <span className="text-gray-500 block">Doctor</span>
                              <span className="text-gray-900">{visit.doctor?.fullName || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">Chief Complaint</span>
                              <span className="text-gray-900">{visit.chiefComplaint || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">Department</span>
                              <span className="text-gray-900">{visit.department || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">Visit Type</span>
                              <span className="text-gray-900 uppercase">{visit.type}</span>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <button
                              onClick={() => navigate(`/encounters/${visit.id}`)}
                              className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              View Full Details
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && canViewBilling && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-blue-600 font-medium">Total Billed</div>
                  <div className="text-2xl font-bold text-blue-900">{formatCurrency(billingSummary.totalBilled)}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm text-green-600 font-medium">Total Paid</div>
                  <div className="text-2xl font-bold text-green-900">{formatCurrency(billingSummary.totalPaid)}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="text-sm text-red-600 font-medium">Outstanding Balance</div>
                  <div className="text-2xl font-bold text-red-900">{formatCurrency(billingSummary.outstanding)}</div>
                </div>
              </div>

              {/* Invoices List */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Invoices</h4>
                {invoices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>No invoices found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Invoice #</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Type</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-600">Amount</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-600">Paid</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-600">Balance</th>
                          <th className="text-center py-3 px-4 font-medium text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {invoices.map((invoice: Invoice) => (
                          <tr key={invoice.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 font-mono text-blue-600">
                              <button 
                                onClick={() => navigate(`/billing/invoices/${invoice.id}`)}
                                className="hover:underline"
                              >
                                {invoice.invoiceNumber}
                              </button>
                            </td>
                            <td className="py-3 px-4">{formatDate(invoice.createdAt)}</td>
                            <td className="py-3 px-4 capitalize">{invoice.type}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(invoice.totalAmount)}</td>
                            <td className="py-3 px-4 text-right text-green-600">{formatCurrency(invoice.paidAmount)}</td>
                            <td className="py-3 px-4 text-right text-red-600">{formatCurrency(invoice.balance)}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                                invoice.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                invoice.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                invoice.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {invoice.status === 'partial' ? 'Partial' :
                                 invoice.status === 'paid' ? 'Paid' :
                                 invoice.status === 'pending' ? 'Pending' :
                                 invoice.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Payment History */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Payment History</h4>
                {patientPayments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No payments recorded</p>
                ) : (
                  <div className="space-y-2">
                    {patientPayments.slice(0, 10).map((payment: Payment) => (
                      <div key={payment.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div>
                          <div className="font-medium text-gray-900">{formatCurrency(payment.amount)}</div>
                          <div className="text-sm text-gray-500">
                            {payment.paymentMethod} • {formatDateTime(payment.createdAt)}
                          </div>
                        </div>
                        {payment.receiptNumber && (
                          <span className="text-sm text-gray-500 font-mono">{payment.receiptNumber}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-900">Patient Documents</h4>
                <button className="btn-primary flex items-center gap-2 text-sm">
                  <Upload className="w-4 h-4" />
                  Upload Document
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No documents uploaded</p>
                  <button className="mt-3 text-blue-600 hover:underline text-sm">
                    Upload first document
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <FileText className="w-8 h-8 text-blue-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 truncate">{doc.name}</div>
                          <div className="text-sm text-gray-500">{doc.type} • {(doc.fileSize / 1024).toFixed(1)} KB</div>
                          <div className="text-xs text-gray-400 mt-1">{formatDate(doc.uploadedAt)}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button className="text-blue-600 hover:underline text-sm flex items-center gap-1">
                          <Eye className="w-3 h-3" /> View
                        </button>
                        <button className="text-blue-600 hover:underline text-sm flex items-center gap-1">
                          <Download className="w-3 h-3" /> Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-900">Patient Notes</h4>
                {canWriteNotes && (
                  <button 
                    onClick={() => setShowNoteForm(true)}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Note
                  </button>
                )}
              </div>

              {/* Add Note Form */}
              {showNoteForm && canWriteNotes && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Note Type</label>
                    <select
                      value={newNote.type}
                      onChange={(e) => setNewNote(prev => ({ ...prev, type: e.target.value as 'clinical' | 'administrative' }))}
                      className="input text-sm"
                    >
                      <option value="administrative">Administrative</option>
                      <option value="clinical">Clinical</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                    <textarea
                      value={newNote.content}
                      onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                      rows={4}
                      className="input text-sm"
                      placeholder="Enter note content..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddNote} className="btn-primary text-sm">
                      Save Note
                    </button>
                    <button 
                      onClick={() => { setShowNoteForm(false); setNewNote({ type: 'administrative', content: '' }); }}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Notes List */}
              {notes.length === 0 ? (
                <div className="text-center py-12">
                  <StickyNote className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No notes recorded</p>
                  {canWriteNotes && (
                    <button 
                      onClick={() => setShowNoteForm(true)}
                      className="mt-3 text-blue-600 hover:underline text-sm"
                    >
                      Add first note
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          note.type === 'clinical' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {note.type}
                        </span>
                        <span className="text-xs text-gray-500">{formatDateTime(note.createdAt)}</span>
                      </div>
                      <p className="text-gray-700 text-sm whitespace-pre-wrap">{note.content}</p>
                      <div className="mt-2 text-xs text-gray-400">By: {note.createdBy}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
