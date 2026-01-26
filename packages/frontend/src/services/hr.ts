import api from './api';
import type { Department } from './facilities';

// Employee
export interface Employee {
  id: string;
  facilityId?: string;
  employeeCode?: string;
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
  department?: Department;
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'intern';
  hireDate?: string;
  terminationDate?: string;
  salaryGrade?: string;
  basicSalary?: number;
  allowances?: Record<string, number>;
  bankName?: string;
  bankAccountNumber?: string;
  status: 'active' | 'on-leave' | 'terminated' | 'resigned';
  createdAt: string;
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
  pendingLeaveRequests: number;
  departmentBreakdown: Record<string, number>;
}

export const hrService = {
  // Employees
  employees: {
    list: async (params?: EmployeeListParams): Promise<Employee[]> => {
      const response = await api.get<Employee[]>('/hr/employees', { params });
      return response.data;
    },
    getById: async (id: string): Promise<Employee> => {
      const response = await api.get<Employee>(`/hr/employees/${id}`);
      return response.data;
    },
    create: async (data: CreateEmployeeDto): Promise<Employee> => {
      const response = await api.post<Employee>('/hr/employees', data);
      return response.data;
    },
    update: async (id: string, data: UpdateEmployeeDto): Promise<Employee> => {
      const response = await api.patch<Employee>(`/hr/employees/${id}`, data);
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
  },

  // Dashboard
  getDashboard: async (facilityId?: string): Promise<HRDashboard> => {
    const response = await api.get<HRDashboard>('/hr/dashboard', { params: { facilityId } });
    return response.data;
  },
};

export default hrService;
