import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { Patient } from '../types';
import {
  Search,
  FileText,
  Upload,
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
} from 'lucide-react';

interface PatientDocument {
  id: string;
  patientId: string;
  name: string;
  type: 'lab_report' | 'prescription' | 'imaging' | 'insurance' | 'consent' | 'other';
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  url: string;
}

const documentTypes = [
  { value: 'lab_report', label: 'Lab Report', icon: FileSpreadsheet },
  { value: 'prescription', label: 'Prescription', icon: FileText },
  { value: 'imaging', label: 'Imaging/X-Ray', icon: Image },
  { value: 'insurance', label: 'Insurance Document', icon: File },
  { value: 'consent', label: 'Consent Form', icon: FileText },
  { value: 'other', label: 'Other', icon: Folder },
];

export default function PatientDocumentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  // Search patients
  const { data: patients, isLoading: searchLoading } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim()) return [];
      const response = await api.get(`/patients?search=${searchTerm}`);
      return response.data?.data as Patient[] || response.data as Patient[];
    },
    enabled: searchTerm.length >= 2 && !selectedPatient,
  });

  // Fetch patient documents
  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ['patient-documents', selectedPatient?.id],
    queryFn: async () => {
      // Mock data - replace with actual API call
      return [] as PatientDocument[];
    },
    enabled: !!selectedPatient,
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocumentIcon = (type: string) => {
    const docType = documentTypes.find((t) => t.value === type);
    return docType?.icon || File;
  };

  const filteredDocuments = documents?.filter(
    (doc) => filterType === 'all' || doc.type === filterType
  );

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Patient Documents</h1>
          <p className="text-gray-500 text-sm">Manage patient files and medical records</p>
        </div>
        {selectedPatient && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
                      onClick={() => { setSelectedPatient(patient); setSearchTerm(''); }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
                    >
                      <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                        <UserCircle className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{patient.fullName}</p>
                        <p className="text-xs text-gray-500">{patient.mrn}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchTerm.length >= 2 ? (
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
            {/* Selected Patient Header */}
            <div className="card p-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedPatient.fullName}</h2>
                  <p className="text-xs text-gray-500">{selectedPatient.mrn} • {selectedPatient.gender}</p>
                </div>
              </div>
              <button onClick={() => setSelectedPatient(null)} className="text-sm text-blue-600 hover:underline">
                Change
              </button>
            </div>

            {/* Document Filters */}
            <div className="flex flex-wrap gap-1.5 flex-shrink-0">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  filterType === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {documentTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setFilterType(type.value)}
                  className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${
                    filterType === type.value ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <type.icon className="w-3 h-3" />
                  {type.label}
                </button>
              ))}
            </div>

            {/* Documents List */}
            <div className="card p-4 flex-1 min-h-0 flex flex-col">
              {docsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : !filteredDocuments?.length ? (
                <div className="text-center py-8 flex-1 flex flex-col items-center justify-center">
                  <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 mb-3 text-sm">No documents found</p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="btn-primary text-sm inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Upload First Document
                  </button>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2">
                  {filteredDocuments.map((doc) => {
                    const DocIcon = getDocumentIcon(doc.type);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gray-100 rounded flex items-center justify-center">
                            <DocIcon className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{doc.name}</p>
                            <p className="text-xs text-gray-500">
                              {doc.type.replace('_', ' ')} • {formatFileSize(doc.fileSize)} • {new Date(doc.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 text-gray-400 hover:text-blue-600" title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-400 hover:text-blue-600" title="Download">
                            <Download className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-400 hover:text-red-600" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-3 border-b">
              <h2 className="font-semibold">Upload Document</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
                <select className="input text-sm py-1.5">
                  {documentTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" className="input text-sm py-1.5" placeholder="Document name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">File *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Click to upload</p>
                  <p className="text-xs text-gray-400">PDF, JPG, PNG up to 10MB</p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowUploadModal(false)} className="btn-secondary flex-1 text-sm">
                  Cancel
                </button>
                <button className="btn-primary flex-1 text-sm">Upload</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
