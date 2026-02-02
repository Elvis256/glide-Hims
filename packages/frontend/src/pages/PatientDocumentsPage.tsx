import { useState, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../services/api';
import type { Patient } from '../types';
import { usePermissions } from '../components/PermissionGate';
import {
  Search,
  FileText,
  FileUp,
  Download,
  Eye,
  Trash2,
  Loader2,
  UserCircle,
  File,
  Image,
  FileSpreadsheet,
  Folder,
  Plus,
  X,
  Calendar,
  Printer,
  Share2,
  Edit,
  LayoutGrid,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  CheckSquare,
  Square,
  Filter,
  SortAsc,
  SortDesc,
  CreditCard,
  FileCheck,
  FileImage,
  ClipboardList,
  ExternalLink,
  Check,
  Link,
  Copy,
} from 'lucide-react';

// Document category types
type DocumentCategory = 
  | 'all'
  | 'id_documents'
  | 'insurance_cards'
  | 'medical_reports'
  | 'lab_results'
  | 'radiology_images'
  | 'consent_forms'
  | 'other';

type SortField = 'uploadedAt' | 'name' | 'category' | 'fileSize';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

interface PatientDocument {
  id: string;
  patientId: string;
  name: string;
  title: string;
  description?: string;
  category: DocumentCategory;
  fileType: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByName: string;
  url: string;
  thumbnailUrl?: string;
}

// Document category configuration
const documentCategories: Array<{
  value: DocumentCategory;
  label: string;
  icon: typeof File;
  color: string;
}> = [
  { value: 'all', label: 'All Documents', icon: Folder, color: 'bg-gray-100 text-gray-700' },
  { value: 'id_documents', label: 'ID Documents', icon: CreditCard, color: 'bg-blue-100 text-blue-700' },
  { value: 'insurance_cards', label: 'Insurance Cards', icon: FileCheck, color: 'bg-green-100 text-green-700' },
  { value: 'medical_reports', label: 'Medical Reports', icon: FileText, color: 'bg-purple-100 text-purple-700' },
  { value: 'lab_results', label: 'Lab Results', icon: FileSpreadsheet, color: 'bg-yellow-100 text-yellow-700' },
  { value: 'radiology_images', label: 'Radiology Images', icon: FileImage, color: 'bg-pink-100 text-pink-700' },
  { value: 'consent_forms', label: 'Consent Forms', icon: ClipboardList, color: 'bg-orange-100 text-orange-700' },
  { value: 'other', label: 'Other', icon: File, color: 'bg-gray-100 text-gray-600' },
];

// Supported file formats
const SUPPORTED_FORMATS = ['application/pdf', 'image/jpeg', 'image/png', 'application/dicom'];
const SUPPORTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.dcm'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Upload file interface
interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export default function PatientDocumentsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState<DocumentCategory>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<SortField>('uploadedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [documentSearchTerm, setDocumentSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [uploadedByFilter, setUploadedByFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Selection state for bulk actions
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  
  // Upload state
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('other');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  // Preview state
  const [previewDoc, setPreviewDoc] = useState<PatientDocument | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewRotation, setPreviewRotation] = useState(0);
  
  // Edit metadata state
  const [editingDoc, setEditingDoc] = useState<PatientDocument | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentCategory>('other');
  
  // Share modal state
  const [shareDoc, setShareDoc] = useState<PatientDocument | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [shareLinkExpiry, setShareLinkExpiry] = useState('24h');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  // Permissions
  const canDelete = hasPermission('patients.delete');
  const canUpdate = hasPermission('patients.update');

  // Search patients
  const { data: patients, isLoading: searchLoading } = useQuery({
    queryKey: ['patients-search', patientSearchTerm],
    queryFn: async () => {
      if (!patientSearchTerm.trim()) return [];
      const response = await api.get(`/patients?search=${patientSearchTerm}`);
      return response.data?.data as Patient[] || response.data as Patient[];
    },
    enabled: patientSearchTerm.length >= 2 && !selectedPatient,
  });

  // Fetch patient documents
  const { data: documentsData, isLoading: docsLoading, refetch: refetchDocs } = useQuery({
    queryKey: ['patient-documents', selectedPatient?.id],
    queryFn: async () => {
      const response = await api.get(`/patients/${selectedPatient?.id}/documents`);
      return response.data?.data as PatientDocument[] || response.data as PatientDocument[] || [];
    },
    enabled: !!selectedPatient,
  });

  const documents = documentsData || [];

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await api.post(`/patients/${selectedPatient?.id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadFiles((prev) =>
            prev.map((f) => ({ ...f, progress: percentCompleted, status: 'uploading' }))
          );
        },
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Document(s) uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['patient-documents', selectedPatient?.id] });
      resetUploadModal();
    },
    onError: (error: Error) => {
      toast.error(`Upload failed: ${error.message}`);
      setUploadFiles((prev) => prev.map((f) => ({ ...f, status: 'error', error: error.message })));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      await api.delete(`/patients/${selectedPatient?.id}/documents/${docId}`);
    },
    onSuccess: () => {
      toast.success('Document deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['patient-documents', selectedPatient?.id] });
    },
    onError: (error: Error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (docIds: string[]) => {
      await api.post(`/patients/${selectedPatient?.id}/documents/bulk-delete`, { ids: docIds });
    },
    onSuccess: () => {
      toast.success(`${selectedDocIds.size} document(s) deleted successfully`);
      setSelectedDocIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['patient-documents', selectedPatient?.id] });
    },
    onError: (error: Error) => {
      toast.error(`Bulk delete failed: ${error.message}`);
    },
  });

  // Update metadata mutation
  const updateMetadataMutation = useMutation({
    mutationFn: async ({ docId, data }: { docId: string; data: { title: string; description: string; category: DocumentCategory } }) => {
      const response = await api.patch(`/patients/${selectedPatient?.id}/documents/${docId}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Document updated successfully');
      setEditingDoc(null);
      queryClient.invalidateQueries({ queryKey: ['patient-documents', selectedPatient?.id] });
    },
    onError: (error: Error) => {
      toast.error(`Update failed: ${error.message}`);
    },
  });

  // Helpers
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getCategoryInfo = (category: DocumentCategory) => {
    return documentCategories.find((c) => c.value === category) || documentCategories[documentCategories.length - 1];
  };

  const isImageFile = (mimeType: string) => mimeType.startsWith('image/');
  const isPdfFile = (mimeType: string) => mimeType === 'application/pdf';

  const getFileIcon = (doc: PatientDocument) => {
    if (isImageFile(doc.mimeType)) return Image;
    if (isPdfFile(doc.mimeType)) return FileText;
    const catInfo = getCategoryInfo(doc.category);
    return catInfo.icon;
  };

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let filtered = [...documents];

    // Filter by category
    if (activeCategory !== 'all') {
      filtered = filtered.filter((doc) => doc.category === activeCategory);
    }

    // Filter by search term
    if (documentSearchTerm) {
      const search = documentSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.name.toLowerCase().includes(search) ||
          doc.title.toLowerCase().includes(search) ||
          (doc.description?.toLowerCase().includes(search))
      );
    }

    // Filter by date range
    if (dateRange.from) {
      filtered = filtered.filter((doc) => new Date(doc.uploadedAt) >= new Date(dateRange.from));
    }
    if (dateRange.to) {
      filtered = filtered.filter((doc) => new Date(doc.uploadedAt) <= new Date(dateRange.to));
    }

    // Filter by uploaded by
    if (uploadedByFilter) {
      filtered = filtered.filter((doc) =>
        doc.uploadedByName.toLowerCase().includes(uploadedByFilter.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'fileSize':
          comparison = a.fileSize - b.fileSize;
          break;
        case 'uploadedAt':
        default:
          comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [documents, activeCategory, documentSearchTerm, dateRange, uploadedByFilter, sortField, sortOrder]);

  // Get unique uploaders for filter
  const uniqueUploaders = useMemo(() => {
    const uploaders = new Set(documents.map((doc) => doc.uploadedByName));
    return Array.from(uploaders);
  }, [documents]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFilesSelected(files);
  }, []);

  const handleFilesSelected = (files: File[]) => {
    const validFiles: UploadFile[] = [];
    
    files.forEach((file) => {
      // Validate file type
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        toast.error(`${file.name}: Unsupported format. Use PDF, JPG, PNG, or DICOM.`);
        return;
      }
      
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File too large. Maximum size is 50MB.`);
        return;
      }
      
      validFiles.push({ file, progress: 0, status: 'pending' });
    });

    setUploadFiles((prev) => [...prev, ...validFiles]);
  };

  const removeUploadFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const resetUploadModal = () => {
    setShowUploadModal(false);
    setUploadFiles([]);
    setUploadCategory('other');
    setUploadTitle('');
    setUploadDescription('');
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    const formData = new FormData();
    uploadFiles.forEach((uf, index) => {
      formData.append('files', uf.file);
    });
    formData.append('category', uploadCategory);
    formData.append('title', uploadTitle || uploadFiles[0].file.name);
    formData.append('description', uploadDescription);

    uploadMutation.mutate(formData);
  };

  // Selection handlers
  const toggleSelectDoc = (docId: string) => {
    setSelectedDocIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.size === filteredDocuments.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(filteredDocuments.map((d) => d.id)));
    }
  };

  // Document actions
  const handleView = (doc: PatientDocument) => {
    const index = filteredDocuments.findIndex((d) => d.id === doc.id);
    setPreviewIndex(index);
    setPreviewDoc(doc);
    setPreviewZoom(100);
    setPreviewRotation(0);
  };

  const handleDownload = async (doc: PatientDocument) => {
    try {
      const response = await api.get(`/patients/${selectedPatient?.id}/documents/${doc.id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch {
      toast.error('Download failed');
    }
  };

  const handlePrint = (doc: PatientDocument) => {
    const printWindow = window.open(doc.url, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    }
  };

  const handleShare = async (doc: PatientDocument) => {
    setShareDoc(doc);
    setShareLink('');
  };

  const generateShareLink = async () => {
    if (!shareDoc) return;
    setIsGeneratingLink(true);
    try {
      const response = await api.post(`/patients/${selectedPatient?.id}/documents/${shareDoc.id}/share`, {
        expiry: shareLinkExpiry,
      });
      setShareLink(response.data.url || `${window.location.origin}/shared-doc/${response.data.token}`);
      toast.success('Share link generated');
    } catch {
      toast.error('Failed to generate share link');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success('Link copied to clipboard');
  };

  const handleDelete = (doc: PatientDocument) => {
    if (confirm(`Are you sure you want to delete "${doc.name}"?`)) {
      deleteMutation.mutate(doc.id);
    }
  };

  const handleBulkDelete = () => {
    if (selectedDocIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedDocIds.size} document(s)?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedDocIds));
    }
  };

  const handleBulkDownload = async () => {
    if (selectedDocIds.size === 0) return;
    try {
      const response = await api.post(
        `/patients/${selectedPatient?.id}/documents/bulk-download`,
        { ids: Array.from(selectedDocIds) },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedPatient?.fullName}_documents.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch {
      toast.error('Bulk download failed');
    }
  };

  const handleEditMetadata = (doc: PatientDocument) => {
    setEditingDoc(doc);
    setEditTitle(doc.title);
    setEditDescription(doc.description || '');
    setEditCategory(doc.category);
  };

  const saveMetadata = () => {
    if (!editingDoc) return;
    updateMetadataMutation.mutate({
      docId: editingDoc.id,
      data: { title: editTitle, description: editDescription, category: editCategory },
    });
  };

  // Preview navigation
  const navigatePreview = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? previewIndex - 1 : previewIndex + 1;
    if (newIndex >= 0 && newIndex < filteredDocuments.length) {
      setPreviewIndex(newIndex);
      setPreviewDoc(filteredDocuments[newIndex]);
      setPreviewZoom(100);
      setPreviewRotation(0);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Patient Documents</h1>
          <p className="text-gray-500 text-sm">Manage patient files and medical records</p>
        </div>
        {selectedPatient && (
          <div className="flex items-center gap-2">
            {selectedDocIds.size > 0 && (
              <>
                <button
                  onClick={handleBulkDownload}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download ({selectedDocIds.size})
                </button>
                {canDelete && (
                  <button
                    onClick={handleBulkDelete}
                    className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-2 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete ({selectedDocIds.size})
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <FileUp className="w-4 h-4" />
              Upload
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {!selectedPatient ? (
          /* Patient Selection */
          <div className="card p-4 max-w-xl h-full flex flex-col">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Select Patient</h2>
            <div className="relative mb-3 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by MRN, name, or phone..."
                value={patientSearchTerm}
                onChange={(e) => setPatientSearchTerm(e.target.value)}
                className="input pl-9 py-2 text-sm"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {searchLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : patients && patients.length > 0 ? (
                <div className="border rounded divide-y">
                  {patients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => { setSelectedPatient(patient); setPatientSearchTerm(''); }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
                    >
                      <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                        <UserCircle className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{patient.fullName}</p>
                        <p className="text-xs text-gray-500">{patient.mrn} • {patient.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : patientSearchTerm.length >= 2 ? (
                <div className="text-center py-8 text-gray-500">
                  <UserCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No patients found</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Search className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Enter at least 2 characters to search</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Patient Documents View */
          <div className="h-full flex flex-col gap-4">
            {/* Selected Patient Info Bar */}
            <div className="card p-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedPatient.fullName}</h2>
                  <p className="text-xs text-gray-500">
                    {selectedPatient.mrn} • {selectedPatient.gender} • {selectedPatient.phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedPatient(null); setSelectedDocIds(new Set()); }}
                className="text-sm text-blue-600 hover:underline"
              >
                Change Patient
              </button>
            </div>

            {/* Document Category Tabs */}
            <div className="flex flex-wrap gap-1.5 flex-shrink-0">
              {documentCategories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setActiveCategory(cat.value)}
                  className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    activeCategory === cat.value
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <cat.icon className="w-3.5 h-3.5" />
                  {cat.label}
                  {cat.value !== 'all' && (
                    <span className="text-[10px] bg-white/50 px-1 rounded">
                      {documents.filter((d) => d.category === cat.value).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search, Filter, and View Controls */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={documentSearchTerm}
                  onChange={(e) => setDocumentSearchTerm(e.target.value)}
                  className="input pl-9 py-2 text-sm"
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`btn-secondary flex items-center gap-2 text-sm ${showFilters ? 'bg-blue-50 border-blue-200' : ''}`}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>

              <div className="flex items-center border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  title="List View"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>

              <select
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-') as [SortField, SortOrder];
                  setSortField(field);
                  setSortOrder(order);
                }}
                className="input py-2 text-sm w-auto"
              >
                <option value="uploadedAt-desc">Newest First</option>
                <option value="uploadedAt-asc">Oldest First</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="category-asc">Category A-Z</option>
                <option value="fileSize-desc">Largest First</option>
                <option value="fileSize-asc">Smallest First</option>
              </select>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
              <div className="card p-3 flex items-end gap-4 flex-shrink-0">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date From</label>
                  <input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                    className="input py-1.5 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date To</label>
                  <input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                    className="input py-1.5 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Uploaded By</label>
                  <select
                    value={uploadedByFilter}
                    onChange={(e) => setUploadedByFilter(e.target.value)}
                    className="input py-1.5 text-sm"
                  >
                    <option value="">All Users</option>
                    {uniqueUploaders.map((uploader) => (
                      <option key={uploader} value={uploader}>{uploader}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    setDateRange({ from: '', to: '' });
                    setUploadedByFilter('');
                  }}
                  className="btn-secondary text-sm py-1.5"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Documents Display */}
            <div className="card flex-1 min-h-0 flex flex-col overflow-hidden">
              {docsLoading ? (
                <div className="flex justify-center items-center py-12 flex-1">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : filteredDocuments.length === 0 ? (
                /* Empty State */
                <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                  <Folder className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No documents yet</h3>
                  <p className="text-gray-500 mb-4 text-sm">
                    {documents.length === 0
                      ? 'Upload the first document for this patient'
                      : 'No documents match your search criteria'}
                  </p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="btn-primary text-sm inline-flex items-center gap-2"
                  >
                    <FileUp className="w-4 h-4" />
                    Upload First Document
                  </button>
                </div>
              ) : viewMode === 'list' ? (
                /* List View */
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left w-10">
                          <button onClick={toggleSelectAll} className="p-1 hover:bg-gray-200 rounded">
                            {selectedDocIds.size === filteredDocuments.length && filteredDocuments.length > 0 ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">
                          <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-gray-900">
                            Document
                            {sortField === 'name' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">
                          <button onClick={() => handleSort('category')} className="flex items-center gap-1 hover:text-gray-900">
                            Category
                            {sortField === 'category' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Uploaded By</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">
                          <button onClick={() => handleSort('uploadedAt')} className="flex items-center gap-1 hover:text-gray-900">
                            Date
                            {sortField === 'uploadedAt' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">
                          <button onClick={() => handleSort('fileSize')} className="flex items-center gap-1 hover:text-gray-900">
                            Size
                            {sortField === 'fileSize' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredDocuments.map((doc) => {
                        const DocIcon = getFileIcon(doc);
                        const catInfo = getCategoryInfo(doc.category);
                        const isSelected = selectedDocIds.has(doc.id);

                        return (
                          <tr key={doc.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                            <td className="px-3 py-2">
                              <button onClick={() => toggleSelectDoc(doc.id)} className="p-1 hover:bg-gray-200 rounded">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                                  <DocIcon className="w-5 h-5 text-gray-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-900 truncate">{doc.title || doc.name}</p>
                                  <p className="text-xs text-gray-500 truncate">{doc.name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${catInfo.color}`}>
                                <catInfo.icon className="w-3 h-3" />
                                {catInfo.label}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{doc.uploadedByName}</td>
                            <td className="px-3 py-2 text-gray-600">{formatDate(doc.uploadedAt)}</td>
                            <td className="px-3 py-2 text-gray-600">{formatFileSize(doc.fileSize)}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => handleView(doc)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100" title="View">
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDownload(doc)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100" title="Download">
                                  <Download className="w-4 h-4" />
                                </button>
                                <button onClick={() => handlePrint(doc)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100" title="Print">
                                  <Printer className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleShare(doc)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100" title="Share">
                                  <Share2 className="w-4 h-4" />
                                </button>
                                {canUpdate && (
                                  <button onClick={() => handleEditMetadata(doc)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100" title="Edit">
                                    <Edit className="w-4 h-4" />
                                  </button>
                                )}
                                {canDelete && (
                                  <button onClick={() => handleDelete(doc)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100" title="Delete">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Grid View */
                <div className="flex-1 overflow-auto p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredDocuments.map((doc) => {
                      const DocIcon = getFileIcon(doc);
                      const catInfo = getCategoryInfo(doc.category);
                      const isSelected = selectedDocIds.has(doc.id);

                      return (
                        <div
                          key={doc.id}
                          className={`group relative border rounded-lg overflow-hidden hover:shadow-md transition-shadow ${
                            isSelected ? 'ring-2 ring-blue-500' : ''
                          }`}
                        >
                          {/* Selection checkbox */}
                          <button
                            onClick={() => toggleSelectDoc(doc.id)}
                            className="absolute top-2 left-2 z-10 p-1 bg-white rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-400" />
                            )}
                          </button>

                          {/* Thumbnail / Preview */}
                          <div
                            className="aspect-square bg-gray-100 flex items-center justify-center cursor-pointer"
                            onClick={() => handleView(doc)}
                          >
                            {doc.thumbnailUrl && isImageFile(doc.mimeType) ? (
                              <img
                                src={doc.thumbnailUrl}
                                alt={doc.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <DocIcon className="w-12 h-12 text-gray-400" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-2">
                            <p className="font-medium text-sm text-gray-900 truncate" title={doc.title || doc.name}>
                              {doc.title || doc.name}
                            </p>
                            <p className="text-xs text-gray-500">{formatDate(doc.uploadedAt)}</p>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium mt-1 ${catInfo.color}`}>
                              <catInfo.icon className="w-2.5 h-2.5" />
                              {catInfo.label}
                            </span>
                          </div>

                          {/* Quick Actions */}
                          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleDownload(doc)}
                              className="p-1.5 bg-white rounded shadow-sm text-gray-600 hover:text-blue-600"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(doc)}
                                className="p-1.5 bg-white rounded shadow-sm text-gray-600 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <h2 className="font-semibold text-lg">Upload Documents</h2>
              <button onClick={resetUploadModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
              >
                <FileUp className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                <p className="text-sm font-medium text-gray-700">
                  {isDragging ? 'Drop files here' : 'Drag and drop files here'}
                </p>
                <p className="text-xs text-gray-500 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">Supported: PDF, JPG, PNG, DICOM (max 50MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.dcm"
                  onChange={(e) => handleFilesSelected(Array.from(e.target.files || []))}
                  className="hidden"
                />
              </div>

              {/* Selected Files */}
              {uploadFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Selected Files ({uploadFiles.length})</p>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {uploadFiles.map((uf, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{uf.file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(uf.file.size)}</p>
                          {uf.status === 'uploading' && (
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                              <div
                                className="bg-blue-600 h-1.5 rounded-full transition-all"
                                style={{ width: `${uf.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                        {uf.status === 'pending' && (
                          <button
                            onClick={() => removeUploadFile(index)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {uf.status === 'success' && <Check className="w-4 h-4 text-green-600" />}
                        {uf.status === 'uploading' && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                  className="input text-sm"
                >
                  {documentCategories.filter((c) => c.value !== 'all').map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Document title (optional)"
                  className="input text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Add notes or description (optional)"
                  rows={2}
                  className="input text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t flex-shrink-0">
              <button onClick={resetUploadModal} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploadFiles.length === 0 || uploadMutation.isPending}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FileUp className="w-4 h-4" />
                    Upload {uploadFiles.length > 0 ? `(${uploadFiles.length})` : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
          {/* Preview Header */}
          <div className="flex items-center justify-between p-4 bg-black/50 text-white">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <p className="font-medium">{previewDoc.title || previewDoc.name}</p>
                <p className="text-sm text-gray-400">
                  {previewIndex + 1} of {filteredDocuments.length} • {formatFileSize(previewDoc.fileSize)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <button
                onClick={() => setPreviewZoom(Math.max(25, previewZoom - 25))}
                className="p-2 hover:bg-white/10 rounded-lg"
                title="Zoom Out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-sm w-12 text-center">{previewZoom}%</span>
              <button
                onClick={() => setPreviewZoom(Math.min(300, previewZoom + 25))}
                className="p-2 hover:bg-white/10 rounded-lg"
                title="Zoom In"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPreviewRotation((previewRotation + 90) % 360)}
                className="p-2 hover:bg-white/10 rounded-lg"
                title="Rotate"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-white/20 mx-2" />
              <button
                onClick={() => handleDownload(previewDoc)}
                className="p-2 hover:bg-white/10 rounded-lg"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={() => handlePrint(previewDoc)}
                className="p-2 hover:bg-white/10 rounded-lg"
                title="Print"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button
                onClick={() => window.open(previewDoc.url, '_blank')}
                className="p-2 hover:bg-white/10 rounded-lg"
                title="Open in New Tab"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Preview Content */}
          <div className="flex-1 flex items-center justify-center overflow-auto p-4">
            {isImageFile(previewDoc.mimeType) ? (
              <img
                src={previewDoc.url}
                alt={previewDoc.name}
                className="max-w-full max-h-full object-contain transition-transform"
                style={{
                  transform: `scale(${previewZoom / 100}) rotate(${previewRotation}deg)`,
                }}
              />
            ) : isPdfFile(previewDoc.mimeType) ? (
              <iframe
                src={previewDoc.url}
                className="w-full h-full bg-white rounded-lg"
                style={{
                  transform: `scale(${previewZoom / 100})`,
                  transformOrigin: 'center center',
                }}
                title={previewDoc.name}
              />
            ) : (
              <div className="text-center text-white">
                <File className="w-24 h-24 mx-auto mb-4 text-gray-400" />
                <p className="text-lg mb-2">Preview not available</p>
                <p className="text-sm text-gray-400 mb-4">{previewDoc.fileType}</p>
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="btn-primary"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download to View
                </button>
              </div>
            )}
          </div>

          {/* Navigation Arrows */}
          {filteredDocuments.length > 1 && (
            <>
              <button
                onClick={() => navigatePreview('prev')}
                disabled={previewIndex === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => navigatePreview('next')}
                disabled={previewIndex === filteredDocuments.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Edit Document</h2>
              <button onClick={() => setEditingDoc(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as DocumentCategory)}
                  className="input text-sm"
                >
                  {documentCategories.filter((c) => c.value !== 'all').map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="input text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t">
              <button onClick={() => setEditingDoc(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={saveMetadata}
                disabled={updateMetadataMutation.isPending}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {updateMetadataMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Share Document</h2>
              <button onClick={() => { setShareDoc(null); setShareLink(''); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <File className="w-8 h-8 text-gray-400" />
                <div>
                  <p className="font-medium text-sm">{shareDoc.title || shareDoc.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(shareDoc.fileSize)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link Expiry</label>
                <select
                  value={shareLinkExpiry}
                  onChange={(e) => setShareLinkExpiry(e.target.value)}
                  className="input text-sm"
                >
                  <option value="1h">1 Hour</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                </select>
              </div>

              {!shareLink ? (
                <button
                  onClick={generateShareLink}
                  disabled={isGeneratingLink}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isGeneratingLink ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Link className="w-4 h-4" />
                      Generate Share Link
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Share Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareLink}
                      readOnly
                      className="input text-sm flex-1 bg-gray-50"
                    />
                    <button onClick={copyShareLink} className="btn-secondary">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">This link will expire in {shareLinkExpiry}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <button
                onClick={() => { setShareDoc(null); setShareLink(''); }}
                className="btn-secondary w-full"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
