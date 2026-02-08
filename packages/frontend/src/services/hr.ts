import api from './api';
import type { Department } from './facilities';

// Employee / Staff (users with HR fields)
export interface Employee {
  id: string;
  facilityId?: string;
  employeeCode?: string;
  employeeNumber?: string;  // New field from merged user/employee
  userId?: string;
  firstName?: string;
  lastName?: string;
  otherNames?: string;
  fullName: string;
  dateOfBirth?: string;
  dateOfJoining?: string;
  gender?: 'male' | 'female' | 'other';
  maritalStatus?: string;
  nationalId?: string;
  nssfNumber?: string;
  tinNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  jobTitle?: string;
  departmentId?: string;
  department?: Department | string;  // Can be object or string
  staffCategory?: string;
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'intern' | 'permanent';
  hireDate?: string;
  terminationDate?: string;
  salaryGrade?: string;
  basicSalary?: number;
  allowances?: Record<string, number>;
  bankName?: string;
  bankAccountNumber?: string;
  annualLeaveBalance?: number;
  sickLeaveBalance?: number;
  status: 'active' | 'on-leave' | 'terminated' | 'resigned' | 'on_leave' | 'inactive';
  facility?: string;
  createdAt?: string;
}

// Attendance
export interface Attendance {
  id: string;
  employeeId: string;
  employee?: Employee;
  date: string;
  clockIn?: string;
  clockOut?: string;
  status: 'present' | 'absent' | 'late' | 'half-day' | 'leave';
  notes?: string;
}

// Leave Request
export interface LeaveRequest {
  id: string;
  employeeId: string;
  employee?: Employee;
  leaveType: 'annual' | 'sick' | 'maternity' | 'paternity' | 'compassionate' | 'unpaid' | 'study';
  startDate: string;
  endDate: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;
  approvalNotes?: string;
  createdAt: string;
}

// Payroll Run
export interface PayrollRun {
  id: string;
  facilityId: string;
  month: number;
  year: number;
  status: 'draft' | 'processing' | 'processed' | 'paid';
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  processedAt?: string;
  createdAt: string;
}

// Payslip
export interface Payslip {
  id: string;
  employeeId: string;
  employee?: Employee;
  payrollRunId: string;
  payrollRun?: PayrollRun;
  basicSalary: number;
  allowances: Record<string, number>;
  grossSalary: number;
  paye: number;
  nssfEmployee: number;
  nssfEmployer: number;
  otherDeductions: Record<string, number>;
  totalDeductions: number;
  netSalary: number;
  daysWorked: number;
  daysAbsent: number;
  overtimeHours: number;
  overtimePay: number;
  isPaid: boolean;
  paidDate?: string;
  createdAt: string;
}

// DTOs
export interface CreateEmployeeDto {
  facilityId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  maritalStatus?: string;
  nationalId?: string;
  nssfNumber?: string;
  tinNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  jobTitle: string;
  department?: string;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'intern';
  hireDate: string;
  salaryGrade?: string;
  basicSalary: number;
  allowances?: Record<string, number>;
  bankName?: string;
  bankAccountNumber?: string;
}

export interface UpdateEmployeeDto {
  phone?: string;
  email?: string;
  address?: string;
  jobTitle?: string;
  department?: string;
  basicSalary?: number;
  allowances?: Record<string, number>;
  bankName?: string;
  bankAccountNumber?: string;
}

export interface RecordAttendanceDto {
  employeeId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  status?: 'present' | 'absent' | 'late' | 'half-day';
  notes?: string;
}

export interface RequestLeaveDto {
  employeeId: string;
  leaveType: 'annual' | 'sick' | 'maternity' | 'paternity' | 'compassionate' | 'unpaid' | 'study';
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface ApproveLeaveDto {
  approved: boolean;
  notes?: string;
}

export interface CreatePayrollRunDto {
  facilityId: string;
  month: number;
  year: number;
}

export interface EmployeeListParams {
  facilityId?: string;
  status?: string;
  department?: string;
  limit?: number;
  offset?: number;
}

export interface HRDashboard {
  totalEmployees: number;
  activeEmployees: number;
  onLeave: number;
  presentToday: number;
  absentToday?: number;
  pendingLeaveRequests: number;
  departmentBreakdown: Record<string, number>;
}

export interface StaffDocument {
  id: string;
  userId: string;
  documentType: string;
  documentName: string;
  filePath: string;
  fileType?: string;
  fileSize?: number;
  licenseNumber?: string;
  issuingAuthority?: string;
  issueDate?: string;
  expiryDate?: string;
  status: 'pending' | 'verified' | 'rejected' | 'expired';
  notes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
}

export const hrService = {
  // Staff (users with HR fields - merged user/employee)
  staff: {
    list: async (params?: EmployeeListParams): Promise<{ data: Employee[]; meta: { total: number } }> => {
      const response = await api.get<{ data: Employee[]; meta: { total: number } }>('/hr/staff', { params });
      return response.data;
    },
    getById: async (id: string): Promise<Employee> => {
      const response = await api.get<Employee>(`/hr/staff/${id}`);
      return response.data;
    },
    update: async (id: string, data: UpdateEmployeeDto): Promise<Employee> => {
      const response = await api.patch<Employee>(`/hr/staff/${id}`, data);
      return response.data;
    },
    create: async (data: {
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
      hireDate?: string;
      basicSalary?: number;
      nationalId?: string;
      address?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      bankName?: string;
      bankAccountNumber?: string;
      roleId?: string;
    }): Promise<Employee & { temporaryPassword?: string }> => {
      const response = await api.post<Employee & { temporaryPassword?: string }>('/hr/staff', data);
      return response.data;
    },
    deactivate: async (id: string, reason?: string): Promise<{ success: boolean; message: string }> => {
      const response = await api.post<{ success: boolean; message: string }>(`/hr/staff/${id}/deactivate`, { reason });
      return response.data;
    },
    reactivate: async (id: string): Promise<{ success: boolean; message: string }> => {
      const response = await api.post<{ success: boolean; message: string }>(`/hr/staff/${id}/reactivate`);
      return response.data;
    },
  },

  // Staff Documents
  documents: {
    list: async (userId: string): Promise<StaffDocument[]> => {
      const response = await api.get<StaffDocument[]>(`/hr/staff/${userId}/documents`);
      return response.data;
    },
    upload: async (userId: string, file: File, data: {
      documentType: string;
      documentName: string;
      licenseNumber?: string;
      issuingAuthority?: string;
      issueDate?: string;
      expiryDate?: string;
      notes?: string;
    }): Promise<StaffDocument> => {
      const formData = new FormData();
      formData.append('file', file);
      Object.entries(data).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });
      const response = await api.post<StaffDocument>(`/hr/staff/${userId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    verify: async (documentId: string, status: 'verified' | 'rejected'): Promise<StaffDocument> => {
      const response = await api.patch<StaffDocument>(`/hr/documents/${documentId}/verify`, { status });
      return response.data;
    },
    delete: async (documentId: string): Promise<void> => {
      await api.delete(`/hr/documents/${documentId}`);
    },
    download: async (documentId: string): Promise<Blob> => {
      const response = await api.get(`/hr/documents/${documentId}/download`, {
        responseType: 'blob',
      });
      return response.data;
    },
    stats: async (): Promise<{ total: number; valid: number; expiringSoon: number; expired: number }> => {
      const response = await api.get('/hr/documents/stats');
      return response.data;
    },
  },

  // Employees (legacy - use staff instead)
  employees: {
    list: async (params?: EmployeeListParams): Promise<Employee[]> => {
      // Redirect to staff endpoint
      const response = await api.get<{ data: Employee[]; meta: { total: number } }>('/hr/staff', { params });
      return response.data?.data || [];
    },
    getById: async (id: string): Promise<Employee> => {
      const response = await api.get<Employee>(`/hr/staff/${id}`);
      return response.data;
    },
    create: async (data: CreateEmployeeDto): Promise<Employee> => {
      const response = await api.post<Employee>('/hr/employees', data);
      return response.data;
    },
    update: async (id: string, data: UpdateEmployeeDto): Promise<Employee> => {
      const response = await api.patch<Employee>(`/hr/staff/${id}`, data);
      return response.data;
    },
    terminate: async (id: string): Promise<Employee> => {
      const response = await api.post<Employee>(`/hr/employees/${id}/terminate`);
      return response.data;
    },
  },

  // Attendance
  attendance: {
    list: async (params?: { facilityId?: string; employeeId?: string; startDate?: string; endDate?: string }): Promise<Attendance[]> => {
      const response = await api.get<Attendance[]>('/hr/attendance', { params });
      return response.data;
    },
    record: async (data: RecordAttendanceDto): Promise<Attendance> => {
      const response = await api.post<Attendance>('/hr/attendance', data);
      return response.data;
    },
    clockIn: async (facilityId?: string): Promise<Attendance> => {
      const response = await api.post<Attendance>('/hr/attendance/clock-in', { facilityId });
      return response.data;
    },
    clockOut: async (facilityId?: string): Promise<Attendance> => {
      const response = await api.post<Attendance>('/hr/attendance/clock-out', { facilityId });
      return response.data;
    },
  },

  // Leave
  leave: {
    list: async (params?: { facilityId?: string; status?: string; employeeId?: string }): Promise<LeaveRequest[]> => {
      const response = await api.get<LeaveRequest[]>('/hr/leave', { params });
      return response.data;
    },
    request: async (data: RequestLeaveDto): Promise<LeaveRequest> => {
      const response = await api.post<LeaveRequest>('/hr/leave', data);
      return response.data;
    },
    approve: async (id: string, data: ApproveLeaveDto): Promise<LeaveRequest> => {
      const response = await api.patch<LeaveRequest>(`/hr/leave/${id}/approve`, data);
      return response.data;
    },
  },

  // Payroll
  payroll: {
    list: async (params?: { facilityId?: string; year?: number; status?: string }): Promise<PayrollRun[]> => {
      const response = await api.get<PayrollRun[]>('/hr/payroll', { params });
      return response.data;
    },
    create: async (data: CreatePayrollRunDto): Promise<PayrollRun> => {
      const response = await api.post<PayrollRun>('/hr/payroll', data);
      return response.data;
    },
    process: async (id: string): Promise<PayrollRun> => {
      const response = await api.post<PayrollRun>(`/hr/payroll/${id}/process`);
      return response.data;
    },
    getMyPayslips: async (year?: number): Promise<Payslip[]> => {
      const response = await api.get<Payslip[]>('/hr/my-payslips', { params: { year } });
      return response.data;
    },
  },

  // Dashboard
  getDashboard: async (facilityId?: string): Promise<HRDashboard> => {
    const response = await api.get<HRDashboard>('/hr/dashboard', { params: { facilityId } });
    return response.data;
  },

  // Recruitment
  recruitment: {
    // Job Postings
    listJobs: async (params?: { facilityId?: string; status?: string }): Promise<JobPosting[]> => {
      const response = await api.get<JobPosting[]>('/hr/recruitment/jobs', { params });
      return response.data;
    },
    getJob: async (id: string): Promise<JobPosting> => {
      const response = await api.get<JobPosting>(`/hr/recruitment/jobs/${id}`);
      return response.data;
    },
    createJob: async (data: CreateJobPostingDto): Promise<JobPosting> => {
      const response = await api.post<JobPosting>('/hr/recruitment/jobs', data);
      return response.data;
    },
    updateJob: async (id: string, data: Partial<CreateJobPostingDto>): Promise<JobPosting> => {
      const response = await api.patch<JobPosting>(`/hr/recruitment/jobs/${id}`, data);
      return response.data;
    },
    deleteJob: async (id: string): Promise<void> => {
      await api.delete(`/hr/recruitment/jobs/${id}`);
    },
    getStats: async (facilityId: string): Promise<RecruitmentStats> => {
      const response = await api.get<RecruitmentStats>('/hr/recruitment/stats', { params: { facilityId } });
      return response.data;
    },
    // Applications
    listApplications: async (jobPostingId: string, status?: string): Promise<JobApplication[]> => {
      const response = await api.get<JobApplication[]>(`/hr/recruitment/jobs/${jobPostingId}/applications`, { params: { status } });
      return response.data;
    },
    createApplication: async (data: CreateApplicationDto): Promise<JobApplication> => {
      const response = await api.post<JobApplication>('/hr/recruitment/applications', data);
      return response.data;
    },
    updateApplication: async (id: string, data: UpdateApplicationDto): Promise<JobApplication> => {
      const response = await api.patch<JobApplication>(`/hr/recruitment/applications/${id}`, data);
      return response.data;
    },
  },

  // Appraisals
  appraisals: {
    list: async (params?: { facilityId?: string; employeeId?: string; year?: number; status?: string }): Promise<Appraisal[]> => {
      const response = await api.get<Appraisal[]>('/hr/appraisals', { params });
      return response.data;
    },
    getById: async (id: string): Promise<Appraisal> => {
      const response = await api.get<Appraisal>(`/hr/appraisals/${id}`);
      return response.data;
    },
    create: async (data: CreateAppraisalDto): Promise<Appraisal> => {
      const response = await api.post<Appraisal>('/hr/appraisals', data);
      return response.data;
    },
    update: async (id: string, data: UpdateAppraisalDto): Promise<Appraisal> => {
      const response = await api.patch<Appraisal>(`/hr/appraisals/${id}`, data);
      return response.data;
    },
    getStats: async (facilityId: string, year: number): Promise<AppraisalStats> => {
      const response = await api.get<AppraisalStats>('/hr/appraisals/stats', { params: { facilityId, year } });
      return response.data;
    },
  },

  // Training
  training: {
    // Programs
    listPrograms: async (params?: { facilityId?: string; status?: string }): Promise<TrainingProgram[]> => {
      const response = await api.get<TrainingProgram[]>('/hr/training/programs', { params });
      return response.data;
    },
    getProgram: async (id: string): Promise<TrainingProgram> => {
      const response = await api.get<TrainingProgram>(`/hr/training/programs/${id}`);
      return response.data;
    },
    createProgram: async (data: CreateTrainingProgramDto): Promise<TrainingProgram> => {
      const response = await api.post<TrainingProgram>('/hr/training/programs', data);
      return response.data;
    },
    updateProgram: async (id: string, data: Partial<CreateTrainingProgramDto>): Promise<TrainingProgram> => {
      const response = await api.patch<TrainingProgram>(`/hr/training/programs/${id}`, data);
      return response.data;
    },
    deleteProgram: async (id: string): Promise<void> => {
      await api.delete(`/hr/training/programs/${id}`);
    },
    getStats: async (facilityId: string): Promise<TrainingStats> => {
      const response = await api.get<TrainingStats>('/hr/training/stats', { params: { facilityId } });
      return response.data;
    },
    // Enrollments
    listEnrollments: async (trainingProgramId: string): Promise<TrainingEnrollment[]> => {
      const response = await api.get<TrainingEnrollment[]>(`/hr/training/programs/${trainingProgramId}/enrollments`);
      return response.data;
    },
    enrollEmployee: async (data: { trainingProgramId: string; employeeId: string }): Promise<TrainingEnrollment> => {
      const response = await api.post<TrainingEnrollment>('/hr/training/enrollments', data);
      return response.data;
    },
    updateEnrollment: async (id: string, data: Partial<TrainingEnrollment>): Promise<TrainingEnrollment> => {
      const response = await api.patch<TrainingEnrollment>(`/hr/training/enrollments/${id}`, data);
      return response.data;
    },
    getEmployeeTrainings: async (employeeId: string): Promise<TrainingEnrollment[]> => {
      const response = await api.get<TrainingEnrollment[]>(`/hr/employees/${employeeId}/trainings`);
      return response.data;
    },
  },
};

// Types for new features
export interface JobPosting {
  id: string;
  facilityId: string;
  title: string;
  departmentId?: string;
  department?: { id: string; name: string };
  description?: string;
  requirements?: string;
  responsibilities?: string;
  employmentType: string;
  salaryMin?: number;
  salaryMax?: number;
  location?: string;
  status: 'draft' | 'open' | 'closed' | 'on_hold' | 'filled';
  closingDate?: string;
  positionsAvailable: number;
  applicationsCount: number;
  createdAt: string;
}

export interface JobApplication {
  id: string;
  jobPostingId: string;
  jobPosting?: JobPosting;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  coverLetter?: string;
  resumeUrl?: string;
  status: 'submitted' | 'screening' | 'shortlisted' | 'interview' | 'offered' | 'hired' | 'rejected' | 'withdrawn';
  notes?: string;
  rating?: number;
  interviewDate?: string;
  appliedAt: string;
}

export interface CreateJobPostingDto {
  facilityId: string;
  title: string;
  departmentId?: string;
  description?: string;
  requirements?: string;
  responsibilities?: string;
  employmentType?: string;
  salaryMin?: number;
  salaryMax?: number;
  location?: string;
  closingDate?: string;
  positionsAvailable?: number;
}

export interface CreateApplicationDto {
  jobPostingId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  coverLetter?: string;
  resumeUrl?: string;
}

export interface UpdateApplicationDto {
  status?: string;
  notes?: string;
  rating?: number;
  interviewDate?: string;
}

export interface RecruitmentStats {
  openPositions: number;
  totalApplications: number;
  shortlisted: number;
  hired: number;
}

export interface Appraisal {
  id: string;
  facilityId: string;
  employeeId: string;
  employee?: Employee;
  reviewerId: string;
  reviewer?: Employee;
  appraisalPeriod: string;
  year: number;
  status: 'draft' | 'self_review' | 'manager_review' | 'completed' | 'acknowledged';
  jobKnowledgeRating?: number;
  workQualityRating?: number;
  attendanceRating?: number;
  communicationRating?: number;
  teamworkRating?: number;
  initiativeRating?: number;
  overallRating?: number;
  employeeComments?: string;
  reviewerComments?: string;
  strengths?: string;
  areasForImprovement?: string;
  goals?: string;
  reviewDate?: string;
  acknowledgedDate?: string;
  createdAt: string;
}

export interface CreateAppraisalDto {
  facilityId: string;
  employeeId: string;
  reviewerId: string;
  appraisalPeriod: string;
  year: number;
}

export interface UpdateAppraisalDto {
  jobKnowledgeRating?: number;
  workQualityRating?: number;
  attendanceRating?: number;
  communicationRating?: number;
  teamworkRating?: number;
  initiativeRating?: number;
  employeeComments?: string;
  reviewerComments?: string;
  strengths?: string;
  areasForImprovement?: string;
  goals?: string;
  status?: string;
}

export interface AppraisalStats {
  total: number;
  pending: number;
  completed: number;
  averageRating: string | null;
}

export interface TrainingProgram {
  id: string;
  facilityId: string;
  name: string;
  description?: string;
  trainingType: string;
  trainer?: string;
  location?: string;
  startDate: string;
  endDate: string;
  durationHours?: number;
  maxParticipants?: number;
  enrolledCount?: number;
  completedCount?: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  isMandatory: boolean;
  providesCertification: boolean;
  certificationName?: string;
  createdAt: string;
}

export interface TrainingEnrollment {
  id: string;
  trainingProgramId: string;
  trainingProgram?: TrainingProgram;
  employeeId: string;
  employee?: Employee;
  status: 'enrolled' | 'attending' | 'completed' | 'failed' | 'cancelled' | 'no_show';
  completionDate?: string;
  score?: number;
  certified: boolean;
  certificationExpiry?: string;
  feedback?: string;
  enrolledAt: string;
}

export interface CreateTrainingProgramDto {
  facilityId: string;
  name: string;
  description?: string;
  trainingType: string;
  trainer?: string;
  location?: string;
  startDate: string;
  endDate: string;
  durationHours?: number;
  maxParticipants?: number;
  enrolledCount?: number;
  completedCount?: number;
  isMandatory?: boolean;
  providesCertification?: boolean;
  hasCertification?: boolean;
  certificationName?: string;
}

export interface TrainingStats {
  totalPrograms: number;
  activePrograms: number;
  totalEnrollments: number;
  completed: number;
  certificatesIssued?: number;
}

export default hrService;
