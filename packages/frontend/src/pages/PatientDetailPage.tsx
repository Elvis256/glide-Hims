import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  User, Phone, Mail, MapPin, Calendar, Heart, AlertCircle, 
  FileText, Activity, CreditCard, ArrowLeft, Edit, Clock, 
  Building2, Users, Printer, MessageSquare, Star, Shield,
  ChevronDown, ChevronUp, Filter, Download, Upload, Plus,
  Stethoscope, Receipt, FolderOpen, StickyNote, Eye,
  Briefcase, Globe, BookUser, IdCard, Droplets, X, Loader2, Send, Trash2
} from 'lucide-react';
import { patientsService, type Patient, type PatientDocument, type DocumentCategory, type PatientNote } from '../services/patients';
import { billingService, type Invoice, type Payment } from '../services/billing';
import { encountersService, type Encounter } from '../services/encounters';
import { facilitiesService } from '../services';
import { usePermissions } from '../components/PermissionGate';

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
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(amount);
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
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');
  const [sendingSMS, setSendingSMS] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<string>('identification');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Permissions
  const canEdit = hasPermission('patients.update');
  const canViewBilling = hasPermission('billing.read');
  const canIssueToken = hasPermission('queue.create');
  const canWriteNotes = hasPermission('patients.update');
  const canUploadDocs = hasPermission('patients.update');
  const canSendSMS = hasPermission('patients.read'); // Basic permission for SMS
  const canStartVisit = hasPermission('encounters.create'); // Only clinical staff can start visits

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

  // Fetch facility for hospital name (using public endpoint - no auth required)
  const { data: facilityInfo } = useQuery({
    queryKey: ['facility-public-info'],
    queryFn: () => facilitiesService.getPublicInfo(),
    staleTime: 300000, // 5 minutes
  });
  const hospitalName = facilityInfo?.name || 'Hospital';

  // Fetch document categories available to user
  const { data: documentCategories } = useQuery({
    queryKey: ['document-categories'],
    queryFn: () => patientsService.getDocumentCategories(),
    staleTime: 300000,
  });

  // Fetch patient documents
  const { data: documents = [], refetch: refetchDocuments } = useQuery({
    queryKey: ['patient-documents', id],
    queryFn: () => patientsService.getDocuments(id!),
    enabled: !!id && activeTab === 'documents',
  });

  // Fetch patient notes
  const { data: notesData, refetch: refetchNotes } = useQuery({
    queryKey: ['patient-notes', id],
    queryFn: () => patientsService.getNotes(id!),
    enabled: !!id,
  });
  const notes = notesData || [];

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, category, description }: { file: File; category: DocumentCategory; description?: string }) => {
      return patientsService.uploadDocument(id!, file, { category, description });
    },
    onSuccess: () => {
      toast.success('Document uploaded successfully');
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadType('other');
      refetchDocuments();
    },
    onError: () => {
      toast.error('Failed to upload document');
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => patientsService.deleteDocument(documentId),
    onSuccess: () => {
      toast.success('Document deleted');
      refetchDocuments();
    },
    onError: () => {
      toast.error('Failed to delete document');
    },
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: (dto: { type: 'clinical' | 'administrative'; content: string }) => 
      patientsService.createNote(id!, dto),
    onSuccess: () => {
      toast.success('Note added successfully');
      setNewNote({ type: 'administrative', content: '' });
      setShowNoteForm(false);
      refetchNotes();
    },
    onError: () => {
      toast.error('Failed to add note');
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => patientsService.deleteNote(noteId),
    onSuccess: () => {
      toast.success('Note deleted');
      refetchNotes();
    },
    onError: () => {
      toast.error('Failed to delete note');
    },
  });

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
    if (!patient) return;
    
    console.log('[PatientDetail] Printing card with hospitalName:', hospitalName);
    
    // Create a printable patient card
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print the card');
      return;
    }
    
    // Use loaded hospital name or fallback
    const hospital = hospitalName || 'Hospital';
    
    const cardHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Patient Card - ${patient.fullName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .card { border: 2px solid #333; border-radius: 10px; padding: 20px; max-width: 400px; margin: auto; }
          .header { text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 15px; }
          .header h1 { margin: 0; font-size: 18px; color: #2563eb; font-weight: bold; }
          .header h2 { margin: 5px 0 0; font-size: 14px; color: #333; }
          .header p { margin: 5px 0 0; color: #666; font-size: 11px; }
          .photo { width: 80px; height: 80px; background: #dbeafe; border-radius: 50%; margin: 10px auto; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #2563eb; font-weight: bold; }
          .name { font-size: 20px; font-weight: bold; text-align: center; margin: 10px 0; }
          .mrn { text-align: center; font-size: 14px; color: #666; margin-bottom: 15px; background: #f3f4f6; padding: 5px 10px; border-radius: 5px; display: inline-block; }
          .mrn-container { text-align: center; }
          .details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; }
          .detail { font-size: 12px; }
          .detail-label { color: #666; font-size: 10px; text-transform: uppercase; }
          .detail-value { font-weight: 500; margin-top: 2px; }
          .qr { text-align: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid #ccc; }
          .qr-placeholder { width: 80px; height: 80px; background: #f0f0f0; margin: auto; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; }
          .footer { text-align: center; margin-top: 10px; font-size: 9px; color: #999; }
          @media print { body { margin: 0; } .card { border: 1px solid #000; } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>${hospital.toUpperCase()}</h1>
            <h2>PATIENT IDENTIFICATION CARD</h2>
            <p>Valid for identification purposes only</p>
          </div>
          <div class="photo">${getInitials(patient.fullName)}</div>
          <div class="name">${patient.fullName}</div>
          <div class="mrn-container"><span class="mrn">MRN: ${patient.mrn}</span></div>
          <div class="details">
            <div class="detail">
              <div class="detail-label">Date of Birth</div>
              <div class="detail-value">${patient.dateOfBirth ? formatDate(patient.dateOfBirth) : 'N/A'}</div>
            </div>
            <div class="detail">
              <div class="detail-label">Gender</div>
              <div class="detail-value">${patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : 'N/A'}</div>
            </div>
            <div class="detail">
              <div class="detail-label">Blood Group</div>
              <div class="detail-value">${(patient as any).bloodGroup || 'N/A'}</div>
            </div>
            <div class="detail">
              <div class="detail-label">Phone</div>
              <div class="detail-value">${patient.phone || 'N/A'}</div>
            </div>
          </div>
          <div class="qr">
            <div class="qr-placeholder">QR Code</div>
            <p style="font-size: 10px; color: #999; margin-top: 5px;">Scan for full details</p>
          </div>
          <div class="footer">This card is property of ${hospital}. If found, please return to the facility.</div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;
    
    printWindow.document.write(cardHtml);
    printWindow.document.close();
    toast.success('Opening print dialog...');
  };

  const handleSendSMS = () => {
    if (!patient?.phone) {
      toast.error('No phone number available for this patient');
      return;
    }
    if (!canSendSMS) {
      toast.error('You do not have permission to send SMS');
      return;
    }
    setSmsMessage('');
    setShowSMSModal(true);
  };

  const handleSendSMSSubmit = async () => {
    if (!smsMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }
    setSendingSMS(true);
    try {
      // TODO: Implement actual SMS sending via API
      // await smsService.send({ phone: patient.phone, message: smsMessage });
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      toast.success(`SMS sent to ${patient?.phone}`);
      setShowSMSModal(false);
      setSmsMessage('');
    } catch (err) {
      toast.error('Failed to send SMS');
    } finally {
      setSendingSMS(false);
    }
  };

  const handleUploadDocument = () => {
    if (!canUploadDocs) {
      toast.error('You do not have permission to upload documents');
      return;
    }
    setUploadFile(null);
    setUploadType('other');
    setShowUploadModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setUploadFile(file);
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }
    uploadMutation.mutate({ 
      file: uploadFile, 
      category: uploadType as DocumentCategory 
    });
  };

  const handleViewDocument = async (doc: PatientDocument) => {
    try {
      const blob = await patientsService.downloadDocumentBlob(doc.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Clean up after a delay
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error('Failed to view document');
    }
  };

  const handleDownloadDocument = async (doc: PatientDocument) => {
    try {
      const blob = await patientsService.downloadDocumentBlob(doc.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.originalFilename || doc.documentName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download document');
    }
  };

  const handleDeleteDocument = (doc: PatientDocument) => {
    if (confirm(`Delete "${doc.documentName}"?`)) {
      deleteMutation.mutate(doc.id);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.content.trim()) {
      toast.error('Note content is required');
      return;
    }
    createNoteMutation.mutate(newNote);
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
                  {canStartVisit ? (
                    <button
                      onClick={() => navigate(`/encounters/new?patientId=${id}`)}
                      className="mt-3 text-blue-600 hover:underline text-sm"
                    >
                      Start a new visit
                    </button>
                  ) : canIssueToken ? (
                    <button
                      onClick={() => navigate(`/opd/token?patientId=${id}`)}
                      className="mt-3 text-blue-600 hover:underline text-sm"
                    >
                      Queue patient for consultation
                    </button>
                  ) : null}
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
                                invoice.status === 'partially_paid' ? 'bg-yellow-100 text-yellow-700' :
                                invoice.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                invoice.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {invoice.status === 'partially_paid' ? 'Partial' :
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
                {canUploadDocs && (
                  <button 
                    onClick={handleUploadDocument}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Document
                  </button>
                )}
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No documents uploaded</p>
                  {canUploadDocs && (
                    <button 
                      onClick={handleUploadDocument}
                      className="mt-3 text-blue-600 hover:underline text-sm"
                    >
                      Upload first document
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <FileText className="w-8 h-8 text-blue-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 truncate">{doc.documentName}</div>
                          <div className="text-sm text-gray-500 capitalize">
                            {doc.category.replace(/_/g, ' ')} • {doc.fileSize ? (doc.fileSize / 1024).toFixed(1) : '?'} KB
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {formatDate(doc.createdAt)}
                            {doc.uploader && <span> by {doc.uploader.fullName || doc.uploader.username}</span>}
                          </div>
                          {doc.description && (
                            <div className="text-xs text-gray-500 mt-1 truncate">{doc.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2 flex-wrap">
                        <button 
                          onClick={() => handleViewDocument(doc)}
                          className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
                        <button 
                          onClick={() => handleDownloadDocument(doc)}
                          className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> Download
                        </button>
                        <button 
                          onClick={() => handleDeleteDocument(doc)}
                          className="text-red-600 hover:underline text-sm flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{formatDateTime(note.createdAt)}</span>
                          {canWriteNotes && (
                            <button
                              onClick={() => {
                                if (confirm('Delete this note?')) {
                                  deleteNoteMutation.mutate(note.id);
                                }
                              }}
                              className="text-red-500 hover:text-red-700"
                              title="Delete note"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-700 text-sm whitespace-pre-wrap">{note.content}</p>
                      <div className="mt-2 text-xs text-gray-400">
                        By: {note.createdBy?.fullName || note.createdBy?.username || 'Unknown'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SMS Modal */}
      {showSMSModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Send SMS</h2>
              <button onClick={() => setShowSMSModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient</label>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <Phone className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{patient?.phone}</span>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={4}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your message..."
                maxLength={160}
              />
              <div className="text-xs text-gray-500 text-right mt-1">{smsMessage.length}/160 characters</div>
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowSMSModal(false)} 
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSendSMSSubmit}
                disabled={sendingSMS || !smsMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {sendingSMS ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send SMS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Upload Document</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Document Category</label>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                {documentCategories?.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                )) || (
                  <>
                    <option value="identification">Identification</option>
                    <option value="insurance_card">Insurance Card</option>
                    <option value="consent">Consent</option>
                    <option value="clinical">Clinical</option>
                    <option value="lab_report">Lab Report</option>
                    <option value="financial">Financial</option>
                    <option value="other">Other</option>
                  </>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Categories are based on your role. Documents will be visible to staff with appropriate permissions.
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-8 h-8 text-blue-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{uploadFile.name}</p>
                      <p className="text-sm text-gray-500">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">Click to select file</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, DOC (max 10MB)</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowUploadModal(false)} 
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleUploadSubmit}
                disabled={uploadMutation.isPending || !uploadFile}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
