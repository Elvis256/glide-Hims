import { useState, useMemo, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  Plus,
  Edit,
  Eye,
  Phone,
  Building2,
  Filter,
  Download,
  Upload,
  MoreVertical,
  UserCircle,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Loading } from '../../../components/Loading';
import { hrService, type Employee, type CreateEmployeeDto } from '../../../services/hr';
import { facilitiesService, rolesService } from '../../../services';

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('StaffDirectoryPage Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center">
          <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{this.state.error?.message || 'An unexpected error occurred'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const fallbackStaff: Employee[] = [];

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle }> = {
  active: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  'on-leave': { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  resigned: { color: 'bg-red-100 text-red-800', icon: XCircle },
  terminated: { color: 'bg-red-100 text-red-800', icon: XCircle },
};

function StaffDirectoryPageContent() {
  console.log('[StaffDirectory] Component rendering...');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Employee | null>(null);
  const [formError, setFormError] = useState('');
  const [staffDocuments, setStaffDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    documentType: 'national_id',
    documentName: '',
    licenseNumber: '',
    issuingAuthority: '',
    expiryDate: '',
  });
  const [editForm, setEditForm] = useState({
    jobTitle: '',
    departmentId: '',
    staffCategory: '',
    employmentType: 'permanent',
    basicSalary: 0,
    hireDate: '',
    gender: '',
    dateOfBirth: '',
  });
  const [newStaff, setNewStaff] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    departmentId: '',
    jobTitle: '',
    staffCategory: '',
    dateOfBirth: '',
    gender: 'male' as 'male' | 'female' | 'other',
    employmentType: 'permanent' as string,
    basicSalary: 0,
    roleId: '',
  });

  const queryClient = useQueryClient();

  // Fetch facilities - with fallback to empty array
  const { data: facilities = [], isLoading: facilitiesLoading, error: facilitiesError } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      console.log('[StaffDirectory] Fetching facilities...');
      try {
        const result = await facilitiesService.list();
        console.log('[StaffDirectory] Facilities result:', result);
        return result || [];
      } catch (err) {
        console.error('[StaffDirectory] Failed to fetch facilities:', err);
        return []; // Return empty array on error instead of throwing
      }
    },
    staleTime: 60000,
    retry: 1,
  });
  const defaultFacilityId = facilities?.[0]?.id;
  console.log('[StaffDirectory] defaultFacilityId:', defaultFacilityId, 'facilitiesLoading:', facilitiesLoading);

  // Fetch departments
  const { data: departmentsList } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      try {
        return await facilitiesService.departments.listAll();
      } catch (err) {
        console.error('Failed to fetch departments:', err);
        return [];
      }
    },
    staleTime: 60000,
  });

  // Fetch roles for staff assignment
  const { data: rolesList } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      try {
        return await rolesService.getAll();
      } catch (err) {
        console.error('Failed to fetch roles:', err);
        return [];
      }
    },
    staleTime: 60000,
  });

  // Fetch staff from API (users with HR fields)
  const { data: employeesData, isLoading, error } = useQuery({
    queryKey: ['staff', statusFilter === 'all' ? undefined : statusFilter],
    queryFn: async () => {
      try {
        const response = await hrService.employees.list({ 
          status: statusFilter === 'all' ? undefined : statusFilter 
        });
        // Handle both array and { data: [] } response formats
        if (Array.isArray(response)) {
          return response;
        }
        if (response && typeof response === 'object' && 'data' in response) {
          return (response as { data: Employee[] }).data;
        }
        return [];
      } catch (err) {
        console.error('Failed to fetch staff:', err);
        return [];
      }
    },
    staleTime: 30000,
    retry: 1,
  });

  const staff: Employee[] = Array.isArray(employeesData) ? employeesData : [];
  const totalStaff = staff.length;
  
  const departments = useMemo(() => {
    const deptNames = staff.map((s: Employee) => {
      if (typeof s.department === 'string') return s.department;
      return s.department?.name;
    }).filter(Boolean);
    return [...new Set(deptNames)] as string[];
  }, [staff]);

  const filteredStaff = useMemo(() => {
    return staff.filter((emp: Employee) => {
      const matchesSearch =
        emp.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
      const empDept = typeof emp.department === 'string' ? emp.department : emp.department?.name;
      const matchesDepartment = departmentFilter === 'all' || empDept === departmentFilter;
      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [staff, searchTerm, statusFilter, departmentFilter]);

  const stats = useMemo(() => ({
    total: staff.length,
    active: staff.filter((s: Employee) => s.status === 'active').length,
    onLeave: staff.filter((s: Employee) => s.status === 'on-leave' || s.status === 'on_leave').length,
    resigned: staff.filter((s: Employee) => s.status === 'resigned' || s.status === 'terminated' || s.status === 'inactive').length,
  }), [staff]);

  // Create staff mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      fullName: string;
      email: string;
      phone?: string;
      username?: string;
      password?: string;
      facilityId: string;
      departmentId?: string;
      jobTitle?: string;
      staffCategory?: string;
      employmentType?: string;
      dateOfBirth?: string;
      gender?: string;
      basicSalary?: number;
      roleId?: string;
    }) => {
      return hrService.staff.create(data);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setShowAddModal(false);
      setNewStaff({
        fullName: '',
        email: '',
        phone: '',
        username: '',
        password: '',
        departmentId: '',
        jobTitle: '',
        staffCategory: '',
        dateOfBirth: '',
        gender: 'male',
        employmentType: 'permanent',
        basicSalary: 0,
        roleId: '',
      });
      setFormError('');
      // Show temporary password if generated
      if (result.temporaryPassword) {
        alert(`Staff created! Temporary password: ${result.temporaryPassword}`);
      }
    },
    onError: (err: Error) => {
      setFormError(err.message || 'Failed to create staff member');
    },
  });

  const handleAddStaff = () => {
    if (!newStaff.fullName || !newStaff.email) {
      setFormError('Full name and email are required');
      return;
    }
    if (!defaultFacilityId) {
      setFormError('No facility configured');
      return;
    }
    createMutation.mutate({
      facilityId: defaultFacilityId,
      fullName: newStaff.fullName,
      email: newStaff.email,
      phone: newStaff.phone || undefined,
      username: newStaff.username || undefined,
      password: newStaff.password || undefined,
      departmentId: newStaff.departmentId || undefined,
      jobTitle: newStaff.jobTitle || undefined,
      staffCategory: newStaff.staffCategory || undefined,
      employmentType: newStaff.employmentType || 'permanent',
      dateOfBirth: newStaff.dateOfBirth || undefined,
      gender: newStaff.gender || undefined,
      basicSalary: newStaff.basicSalary || 0,
      roleId: newStaff.roleId || undefined,
    });
  };

  const handleViewStaff = (emp: Employee) => {
    setSelectedStaff(emp);
    setShowViewModal(true);
  };

  const handleEditStaff = (emp: Employee) => {
    setSelectedStaff(emp);
    setEditForm({
      jobTitle: emp.jobTitle || '',
      departmentId: emp.departmentId || '',
      staffCategory: emp.staffCategory || '',
      employmentType: emp.employmentType || 'permanent',
      basicSalary: emp.basicSalary || 0,
      hireDate: emp.hireDate || '',
      gender: emp.gender || '',
      dateOfBirth: emp.dateOfBirth || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedStaff) return;
    try {
      await hrService.staff.update(selectedStaff.id, {
        jobTitle: editForm.jobTitle,
        departmentId: editForm.departmentId || undefined,
        staffCategory: editForm.staffCategory,
        employmentType: editForm.employmentType,
        basicSalary: editForm.basicSalary,
        hireDate: editForm.hireDate || undefined,
        gender: editForm.gender as 'male' | 'female' | 'other',
        dateOfBirth: editForm.dateOfBirth || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setShowEditModal(false);
      setSelectedStaff(null);
    } catch (err) {
      setFormError((err as Error).message || 'Failed to update staff');
    }
  };

  const handleViewDocs = async (emp: Employee) => {
    setSelectedStaff(emp);
    setShowDocsModal(true);
    // Load documents
    try {
      const docs = await hrService.documents.list(emp.id);
      setStaffDocuments(docs || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setStaffDocuments([]);
    }
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[Upload] File input changed', e.target.files);
    if (!e.target.files?.length || !selectedStaff) {
      console.log('[Upload] No files or no selected staff', { files: e.target.files, selectedStaff });
      return;
    }
    const file = e.target.files[0];
    console.log('[Upload] Uploading file:', file.name, 'for user:', selectedStaff.id);
    
    setUploading(true);
    try {
      const result = await hrService.documents.upload(selectedStaff.id, file, {
        documentType: uploadForm.documentType,
        documentName: uploadForm.documentName || file.name,
        licenseNumber: uploadForm.licenseNumber || undefined,
        issuingAuthority: uploadForm.issuingAuthority || undefined,
        expiryDate: uploadForm.expiryDate || undefined,
      });
      console.log('[Upload] Success:', result);
      // Refresh documents list
      const docs = await hrService.documents.list(selectedStaff.id);
      setStaffDocuments(docs || []);
      setUploadForm({ documentType: 'national_id', documentName: '', licenseNumber: '', issuingAuthority: '', expiryDate: '' });
      // Clear the file input
      e.target.value = '';
    } catch (err) {
      console.error('Failed to upload document:', err);
      setFormError('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!selectedStaff || !confirm('Delete this document?')) return;
    try {
      await hrService.documents.delete(docId);
      const docs = await hrService.documents.list(selectedStaff.id);
      setStaffDocuments(docs || []);
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const handleViewDocument = async (docId: string) => {
    try {
      const blob = await hrService.documents.download(docId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Failed to view document:', err);
      setFormError('Failed to view document');
    }
  };

  const getDocumentStatus = (docType: string) => {
    const doc = staffDocuments.find(d => d.documentType === docType);
    if (!doc) return { status: 'not_uploaded', doc: null };
    return { status: doc.status, doc };
  };

  const handleExport = () => {
    if (!employeesData?.length) return;
    const headers = ['Employee ID', 'Full Name', 'Email', 'Phone', 'Department', 'Designation', 'Status', 'Hire Date'];
    const rows = employeesData.map((s: Employee) => [
      s.employeeNumber || '',
      s.fullName || '',
      s.email || '',
      s.phoneNumber || '',
      departments.find(d => d.id === s.departmentId)?.name || 'Unassigned',
      s.jobTitle || 'Not Assigned',
      s.status || s.staffCategory || 'active',
      s.hireDate ? new Date(s.hireDate).toLocaleDateString() : '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staff-directory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'full_name*',
      'email*',
      'phone_number',
      'username',
      'password',
      'department_code',
      'job_title',
      'staff_category',
      'employment_type',
      'date_of_birth',
      'gender',
      'hire_date',
      'basic_salary',
      'national_id',
      'address',
      'emergency_contact_name',
      'emergency_contact_phone',
      'bank_name',
      'bank_account_number',
    ];
    const example = [
      'John Doe',
      'john.doe@example.com',
      '+256700000000',
      'johndoe',
      'Password123!',
      'IT',
      'Software Developer',
      'it_support',
      'full_time',
      '1990-01-15',
      'male',
      '2024-01-01',
      '5000000',
      'CM12345678ABCD',
      '123 Main Street, Kampala',
      'Jane Doe',
      '+256700000001',
      'Stanbic Bank',
      '9030012345678',
    ];
    const notes = [
      '# STAFF IMPORT TEMPLATE',
      '# Fields marked with * are required',
      '# ',
      '# staff_category options: doctor, nurse, consultant, specialist, lab_technician, pharmacist, radiologist,',
      '#   receptionist, cashier, administrator, hr_manager, store_keeper, accountant, it_support, other',
      '# employment_type options: full_time, part_time, contract, temporary, intern',
      '# gender options: male, female, other',
      '# date format: YYYY-MM-DD',
      '# department_code: Use department codes from the Departments page (e.g., IT, HR, OPD, LB)',
      '# ',
      '',
    ];
    const csv = [...notes, headers.join(','), example.map(c => `"${c}"`).join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<string[][]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportErrors([]);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n')
        .filter(l => l.trim() && !l.startsWith('#'))
        .map(l => l.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
      
      if (lines.length < 2) {
        setImportErrors(['CSV must have headers and at least one data row']);
        setImportPreview([]);
        return;
      }
      setImportPreview(lines.slice(0, 6)); // Show header + first 5 rows
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportSubmit = async () => {
    if (!importFile || importPreview.length < 2) return;
    setImporting(true);
    setImportErrors([]);
    
    const headers = importPreview[0].map(h => h.replace('*', '').trim());
    const rows = importPreview.slice(1);
    const errors: string[] = [];
    let successCount = 0;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const data: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if (row[idx]) data[h] = row[idx];
      });
      
      // Validate required fields
      if (!data.full_name || !data.email) {
        errors.push(`Row ${i + 2}: Missing required field (full_name or email)`);
        continue;
      }
      
      // Find department by code
      const dept = departments.find(d => d.code?.toLowerCase() === data.department_code?.toLowerCase());
      
      try {
        await createEmployee.mutateAsync({
          fullName: data.full_name,
          email: data.email,
          phoneNumber: data.phone_number || '',
          username: data.username || data.email.split('@')[0],
          password: data.password || 'TempPassword123!',
          departmentId: dept?.id,
          jobTitle: data.job_title,
          staffCategory: data.staff_category as any,
          employmentType: data.employment_type as any,
          dateOfBirth: data.date_of_birth ? new Date(data.date_of_birth) : undefined,
          gender: data.gender,
          hireDate: data.hire_date ? new Date(data.hire_date) : undefined,
          basicSalary: data.basic_salary ? parseFloat(data.basic_salary) : undefined,
          nationalId: data.national_id,
          address: data.address,
          emergencyContactName: data.emergency_contact_name,
          emergencyContactPhone: data.emergency_contact_phone,
          bankName: data.bank_name,
          bankAccountNumber: data.bank_account_number,
        } as any);
        successCount++;
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.response?.data?.message || err.message || 'Failed to create'}`);
      }
    }
    
    setImporting(false);
    setImportErrors(errors);
    
    if (successCount > 0) {
      alert(`Successfully imported ${successCount} staff members.${errors.length ? ` ${errors.length} failed.` : ''}`);
      if (errors.length === 0) {
        setShowImportModal(false);
        setImportFile(null);
        setImportPreview([]);
      }
    }
  };

  // Show loading state while facilities are loading
  if (facilitiesLoading) {
    return (
      <div className="h-[calc(100vh-120px)]">
        <Loading size="lg" text="Loading facilities..." fullScreen />
      </div>
    );
  }

  // Show error if facilities failed to load
  if (facilitiesError) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Facilities</h2>
        <p className="text-gray-600 mb-4">{(facilitiesError as Error).message || 'Unable to connect to API'}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Show message if no facility is configured
  if (!defaultFacilityId) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center">
        <AlertCircle className="h-16 w-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Facility Configured</h2>
        <p className="text-gray-600 mb-4">Please create a facility/branch first before adding staff.</p>
        <a href="/admin/site/branches" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Go to Branches
        </a>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-7 w-7 text-blue-600" />
              Staff Directory
            </h1>
            <p className="text-gray-600 mt-1">Manage all staff members and their profiles</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" />
              Import
            </button>
            <button 
              onClick={handleExport}
              disabled={!employeesData?.length}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Staff
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Total Staff</span>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Active</span>
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{stats.active}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">On Leave</span>
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-600">{stats.onLeave}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Resigned</span>
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{stats.resigned}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 bg-white rounded-lg border p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="on-leave">On Leave</option>
              <option value="resigned">Resigned</option>
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Employee</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Employee ID</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Department</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Designation</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Contact</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loading size="lg" text="Loading staff..." fullScreen className="min-h-[100px]" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <AlertCircle className="h-6 w-6 mx-auto text-red-500" />
                    <p className="text-sm text-red-600 mt-2">Failed to load staff</p>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No staff found.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((emp) => {
                const StatusIcon = statusConfig[emp.status]?.icon || CheckCircle;
                const statusColor = statusConfig[emp.status]?.color || 'bg-gray-100 text-gray-800';
                return (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <UserCircle className="h-6 w-6 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{emp.fullName}</p>
                          <p className="text-sm text-gray-500">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono">{emp.employeeNumber || emp.employeeCode}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">{typeof emp.department === 'string' ? emp.department : emp.department?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{emp.jobTitle || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{emp.phone || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                        <StatusIcon className="h-3 w-3" />
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleViewStaff(emp)}
                          className="p-1 hover:bg-gray-100 rounded" 
                          title="View"
                        >
                          <Eye className="h-4 w-4 text-blue-500 hover:text-blue-700" />
                        </button>
                        <button 
                          onClick={() => handleEditStaff(emp)}
                          className="p-1 hover:bg-gray-100 rounded" 
                          title="Edit"
                        >
                          <Edit className="h-4 w-4 text-green-500 hover:text-green-700" />
                        </button>
                        <button 
                          onClick={() => handleViewDocs(emp)}
                          className="p-1 hover:bg-gray-100 rounded" 
                          title="Documents"
                        >
                          <FileText className="h-4 w-4 text-orange-500 hover:text-orange-700" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
        <div className="flex-shrink-0 border-t px-4 py-3 bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-600">Showing {filteredStaff.length} of {totalStaff} staff members</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border rounded hover:bg-gray-100 text-sm">Previous</button>
            <button className="px-3 py-1 border rounded bg-blue-600 text-white text-sm">1</button>
            <button className="px-3 py-1 border rounded hover:bg-gray-100 text-sm">2</button>
            <button className="px-3 py-1 border rounded hover:bg-gray-100 text-sm">Next</button>
          </div>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add New Staff Member</h2>
            <p className="text-sm text-gray-500 mb-4">Creates a user account with HR profile. Staff can login with their credentials.</p>
            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {/* Basic Account Info */}
              <div className="col-span-2 border-b pb-2 mb-2">
                <h3 className="font-semibold text-gray-700">Account Information</h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg px-3 py-2" 
                  placeholder="Full name"
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input 
                  type="email" 
                  className="w-full border rounded-lg px-3 py-2" 
                  placeholder="email@hospital.com"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg px-3 py-2" 
                  placeholder="Auto-generated from email if empty"
                  value={newStaff.username}
                  onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input 
                  type="password" 
                  className="w-full border rounded-lg px-3 py-2" 
                  placeholder="Auto-generated if empty"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input 
                  type="tel" 
                  className="w-full border rounded-lg px-3 py-2" 
                  placeholder="+256-700-000000"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select 
                  className="w-full border rounded-lg px-3 py-2"
                  value={newStaff.roleId}
                  onChange={(e) => setNewStaff({ ...newStaff, roleId: e.target.value })}
                >
                  <option value="">Select Role</option>
                  {rolesList?.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              
              {/* HR Info */}
              <div className="col-span-2 border-b pb-2 mb-2 mt-4">
                <h3 className="font-semibold text-gray-700">Employment Details</h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select 
                  className="w-full border rounded-lg px-3 py-2"
                  value={newStaff.departmentId}
                  onChange={(e) => setNewStaff({ ...newStaff, departmentId: e.target.value })}
                >
                  <option value="">Select Department</option>
                  {departmentsList?.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg px-3 py-2" 
                  placeholder="e.g. Doctor, Nurse, Receptionist"
                  value={newStaff.jobTitle}
                  onChange={(e) => setNewStaff({ ...newStaff, jobTitle: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Category</label>
                <select 
                  className="w-full border rounded-lg px-3 py-2"
                  value={newStaff.staffCategory}
                  onChange={(e) => setNewStaff({ ...newStaff, staffCategory: e.target.value })}
                >
                  <option value="">Select Category</option>
                  <option value="doctor">Doctor</option>
                  <option value="nurse">Nurse</option>
                  <option value="consultant">Consultant</option>
                  <option value="lab_technician">Lab Technician</option>
                  <option value="pharmacist">Pharmacist</option>
                  <option value="radiologist">Radiologist</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="cashier">Cashier</option>
                  <option value="administrator">Administrator</option>
                  <option value="store_keeper">Store Keeper</option>
                  <option value="accountant">Accountant</option>
                  <option value="it_support">IT Support</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                <select 
                  className="w-full border rounded-lg px-3 py-2"
                  value={newStaff.employmentType}
                  onChange={(e) => setNewStaff({ ...newStaff, employmentType: e.target.value })}
                >
                  <option value="permanent">Permanent</option>
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="temporary">Temporary</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select 
                  className="w-full border rounded-lg px-3 py-2"
                  value={newStaff.gender}
                  onChange={(e) => setNewStaff({ ...newStaff, gender: e.target.value as 'male' | 'female' | 'other' })}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input 
                  type="date" 
                  className="w-full border rounded-lg px-3 py-2"
                  value={newStaff.dateOfBirth}
                  onChange={(e) => setNewStaff({ ...newStaff, dateOfBirth: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary</label>
                <input 
                  type="number" 
                  className="w-full border rounded-lg px-3 py-2" 
                  placeholder="0"
                  value={newStaff.basicSalary}
                  onChange={(e) => setNewStaff({ ...newStaff, basicSalary: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => { setShowAddModal(false); setFormError(''); }} 
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddStaff}
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Staff Modal */}
      {showViewModal && selectedStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Staff Details</h2>
              <button onClick={() => { setShowViewModal(false); setSelectedStaff(null); }} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            
            <div className="flex items-center gap-4 mb-6 pb-6 border-b">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <UserCircle className="h-10 w-10 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{selectedStaff.fullName}</h3>
                <p className="text-gray-500">{selectedStaff.employeeNumber || selectedStaff.employeeCode}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Email</label>
                <p className="font-medium">{selectedStaff.email || '—'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Phone</label>
                <p className="font-medium">{selectedStaff.phone || '—'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Department</label>
                <p className="font-medium">{typeof selectedStaff.department === 'string' ? selectedStaff.department : selectedStaff.department?.name || '—'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Job Title</label>
                <p className="font-medium">{selectedStaff.jobTitle || '—'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Staff Category</label>
                <p className="font-medium">{selectedStaff.staffCategory || '—'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Employment Type</label>
                <p className="font-medium capitalize">{selectedStaff.employmentType || '—'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <p className="font-medium capitalize">{selectedStaff.status}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Gender</label>
                <p className="font-medium capitalize">{selectedStaff.gender || '—'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Date of Birth</label>
                <p className="font-medium">{selectedStaff.dateOfBirth || '—'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Hire Date</label>
                <p className="font-medium">{selectedStaff.hireDate || '—'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Basic Salary</label>
                <p className="font-medium">{selectedStaff.basicSalary ? `UGX ${selectedStaff.basicSalary.toLocaleString()}` : '—'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Annual Leave Balance</label>
                <p className="font-medium">{selectedStaff.annualLeaveBalance ?? '—'} days</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Sick Leave Balance</label>
                <p className="font-medium">{selectedStaff.sickLeaveBalance ?? '—'} days</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button 
                onClick={() => { setShowViewModal(false); handleEditStaff(selectedStaff); }} 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit Staff
              </button>
              <button 
                onClick={() => { setShowViewModal(false); setSelectedStaff(null); }} 
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {showEditModal && selectedStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Edit Staff: {selectedStaff.fullName}</h2>
              <button onClick={() => { setShowEditModal(false); setSelectedStaff(null); setFormError(''); }} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            
            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg px-3 py-2" 
                  placeholder="e.g. Doctor, Nurse"
                  value={editForm.jobTitle}
                  onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select 
                  className="w-full border rounded-lg px-3 py-2"
                  value={editForm.departmentId}
                  onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}
                >
                  <option value="">Select Department</option>
                  {departmentsList?.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Category</label>
                <select 
                  className="w-full border rounded-lg px-3 py-2"
                  value={editForm.staffCategory}
                  onChange={(e) => setEditForm({ ...editForm, staffCategory: e.target.value })}
                >
                  <option value="">Select Category</option>
                  <option value="clinical">Clinical</option>
                  <option value="nursing">Nursing</option>
                  <option value="administrative">Administrative</option>
                  <option value="support">Support</option>
                  <option value="technical">Technical</option>
                  <option value="management">Management</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                <select 
                  className="w-full border rounded-lg px-3 py-2"
                  value={editForm.employmentType}
                  onChange={(e) => setEditForm({ ...editForm, employmentType: e.target.value })}
                >
                  <option value="permanent">Permanent</option>
                  <option value="contract">Contract</option>
                  <option value="part-time">Part-time</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select 
                  className="w-full border rounded-lg px-3 py-2"
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input 
                  type="date" 
                  className="w-full border rounded-lg px-3 py-2"
                  value={editForm.dateOfBirth}
                  onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
                <input 
                  type="date" 
                  className="w-full border rounded-lg px-3 py-2"
                  value={editForm.hireDate}
                  onChange={(e) => setEditForm({ ...editForm, hireDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary (UGX)</label>
                <input 
                  type="number" 
                  className="w-full border rounded-lg px-3 py-2"
                  value={editForm.basicSalary}
                  onChange={(e) => setEditForm({ ...editForm, basicSalary: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button 
                onClick={() => { setShowEditModal(false); setSelectedStaff(null); setFormError(''); }} 
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {showDocsModal && selectedStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Documents: {selectedStaff.fullName}</h2>
              <button onClick={() => { setShowDocsModal(false); setSelectedStaff(null); setStaffDocuments([]); }} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            
            {/* Upload Form */}
            <div className="border rounded-lg p-4 mb-6 bg-gray-50">
              <h3 className="font-medium text-gray-700 mb-3">Upload New Document</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Document Type</label>
                  <select 
                    value={uploadForm.documentType}
                    onChange={(e) => setUploadForm({ ...uploadForm, documentType: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="national_id">National ID</option>
                    <option value="academic_certificate">Academic Certificate</option>
                    <option value="professional_license">Professional License</option>
                    <option value="employment_contract">Employment Contract</option>
                    <option value="medical_certificate">Medical Certificate</option>
                    <option value="police_clearance">Police Clearance</option>
                    <option value="reference_letter">Reference Letter</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Document Name</label>
                  <input 
                    type="text"
                    placeholder="e.g., National ID Copy"
                    value={uploadForm.documentName}
                    onChange={(e) => setUploadForm({ ...uploadForm, documentName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">License/Cert Number</label>
                  <input 
                    type="text"
                    placeholder="Optional"
                    value={uploadForm.licenseNumber}
                    onChange={(e) => setUploadForm({ ...uploadForm, licenseNumber: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Expiry Date</label>
                  <input 
                    type="date"
                    value={uploadForm.expiryDate}
                    onChange={(e) => setUploadForm({ ...uploadForm, expiryDate: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="file" 
                  id="doc-upload" 
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleUploadDocument}
                  className="hidden"
                />
                <label 
                  htmlFor="doc-upload" 
                  className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2 ${uploading ? 'opacity-50' : ''}`}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Uploading...' : 'Select & Upload File'}
                </label>
                <span className="text-sm text-gray-500">PDF, JPG, PNG, DOC (Max 10MB)</span>
              </div>
            </div>

            {/* Uploaded Documents */}
            {staffDocuments.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-3">Uploaded Documents ({staffDocuments.length})</h3>
                <div className="space-y-2">
                  {staffDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-gray-700">{doc.documentName}</p>
                          <p className="text-xs text-gray-500">{doc.documentType.replace('_', ' ')} • {new Date(doc.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          doc.status === 'verified' ? 'bg-green-100 text-green-700' :
                          doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          doc.status === 'expired' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {doc.status}
                        </span>
                        <button 
                          onClick={() => handleViewDocument(doc.id)}
                          className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Required Documents Checklist */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-700 mb-3">Required Documents Checklist</h3>
              {[
                { type: 'national_id', name: 'National ID', desc: 'Identity document' },
                { type: 'academic_certificate', name: 'Academic Certificates', desc: 'Education qualifications' },
                { type: 'professional_license', name: 'Professional License', desc: 'Medical/Professional registration' },
                { type: 'employment_contract', name: 'Employment Contract', desc: 'Signed employment agreement' },
              ].map((item) => {
                const { status, doc } = getDocumentStatus(item.type);
                return (
                  <div key={item.type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className={`h-5 w-5 ${status === 'verified' ? 'text-green-500' : status === 'pending' ? 'text-blue-500' : 'text-gray-400'}`} />
                      <div>
                        <p className="font-medium text-gray-700">{item.name}</p>
                        <p className="text-sm text-gray-500">{item.desc}</p>
                      </div>
                    </div>
                    <span className={`text-sm px-2 py-1 rounded ${
                      status === 'verified' ? 'bg-green-100 text-green-700' :
                      status === 'pending' ? 'bg-blue-100 text-blue-700' :
                      status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {status === 'not_uploaded' ? 'Not uploaded' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button 
                onClick={() => { setShowDocsModal(false); setSelectedStaff(null); setStaffDocuments([]); }} 
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Import Staff</h2>
              <button onClick={() => { setShowImportModal(false); setImportFile(null); setImportPreview([]); setImportErrors([]); }} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            {/* Download Template */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-blue-900">Download Import Template</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Use this template to prepare your staff data. Fields marked with * are required.
                  </p>
                  <button 
                    onClick={handleDownloadTemplate}
                    className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    <Download className="h-4 w-4 inline mr-1" />
                    Download Template
                  </button>
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-6">
              <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-2">
                {importFile ? importFile.name : 'Select a CSV file to import'}
              </p>
              <input 
                type="file" 
                id="import-file" 
                accept=".csv" 
                onChange={handleImportFileSelect} 
                className="hidden" 
              />
              <label 
                htmlFor="import-file"
                className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer"
              >
                Browse Files
              </label>
            </div>

            {/* Preview */}
            {importPreview.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-3">Preview ({importPreview.length - 1} records)</h3>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {importPreview[0].slice(0, 6).map((h, i) => (
                          <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                            {h.replace('*', '')}
                          </th>
                        ))}
                        {importPreview[0].length > 6 && (
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">...</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importPreview.slice(1, 6).map((row, i) => (
                        <tr key={i}>
                          {row.slice(0, 6).map((cell, j) => (
                            <td key={j} className="px-3 py-2 text-gray-700 truncate max-w-[150px]">
                              {cell}
                            </td>
                          ))}
                          {row.length > 6 && (
                            <td className="px-3 py-2 text-gray-500">...</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Errors */}
            {importErrors.length > 0 && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-medium text-red-800 mb-2">Import Errors</h3>
                <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                  {importErrors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button 
                onClick={() => { setShowImportModal(false); setImportFile(null); setImportPreview([]); setImportErrors([]); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleImportSubmit}
                disabled={importing || importPreview.length < 2}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                {importing ? 'Importing...' : 'Import Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap the component in an error boundary
export default function StaffDirectoryPageWithBoundary() {
  return (
    <ErrorBoundary>
      <StaffDirectoryPageContent />
    </ErrorBoundary>
  );
}
