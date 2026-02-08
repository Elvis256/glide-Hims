import api from './api';

export type DutyStatus = 'on_duty' | 'off_duty' | 'on_break' | 'in_consultation';

export interface DoctorDuty {
  id: string;
  doctorId: string;
  doctor?: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
  };
  facilityId: string;
  departmentId?: string;
  department?: {
    id: string;
    name: string;
  };
  dutyDate: string;
  status: DutyStatus;
  checkInTime?: string;
  checkOutTime?: string;
  roomNumber?: string;
  currentQueueCount: number;
  maxPatients: number;
  notes?: string;
}

export interface DoctorWithDutyStatus {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  roles?: string[];
  dutyId?: string;
  status: DutyStatus;
  checkInTime?: string;
  checkOutTime?: string;
  roomNumber?: string;
  departmentId?: string;
  currentQueueCount: number;
  maxPatients: number;
}

export interface CheckInDto {
  doctorId: string;
  departmentId?: string;
  roomNumber?: string;
}

export interface CheckOutDto {
  notes?: string;
}

export interface DoctorDutyFilterDto {
  date?: string;
  departmentId?: string;
  status?: DutyStatus;
  onlyOnDuty?: string;
}

export const doctorDutyService = {
  // Check in a doctor
  checkIn: async (data: CheckInDto): Promise<DoctorDuty> => {
    const response = await api.post<DoctorDuty>('/doctor-duty/check-in', data);
    return response.data;
  },

  // Check out a doctor
  checkOut: async (id: string, data?: CheckOutDto): Promise<DoctorDuty> => {
    const response = await api.post<DoctorDuty>(`/doctor-duty/${id}/check-out`, data || {});
    return response.data;
  },

  // Update status (on_break, in_consultation, etc.)
  updateStatus: async (id: string, status: DutyStatus): Promise<DoctorDuty> => {
    const response = await api.patch<DoctorDuty>(`/doctor-duty/${id}/status`, { status });
    return response.data;
  },

  // Get doctors currently on duty
  getOnDuty: async (filter?: DoctorDutyFilterDto): Promise<DoctorDuty[]> => {
    const response = await api.get<DoctorDuty[]>('/doctor-duty/on-duty', { params: filter });
    return response.data;
  },

  // Get all doctors (for check-in selection)
  getAllDoctors: async (): Promise<any[]> => {
    const response = await api.get('/doctor-duty/all-doctors');
    return response.data;
  },

  // Get all doctors with their duty status for today
  getDoctorsWithStatus: async (date?: string): Promise<DoctorWithDutyStatus[]> => {
    const response = await api.get<DoctorWithDutyStatus[]>('/doctor-duty/with-status', {
      params: date ? { date } : undefined,
    });
    return response.data;
  },

  // Get single duty record
  getById: async (id: string): Promise<DoctorDuty> => {
    const response = await api.get<DoctorDuty>(`/doctor-duty/${id}`);
    return response.data;
  },

  // Update duty record
  update: async (id: string, data: Partial<DoctorDuty>): Promise<DoctorDuty> => {
    const response = await api.patch<DoctorDuty>(`/doctor-duty/${id}`, data);
    return response.data;
  },
};

export default doctorDutyService;
