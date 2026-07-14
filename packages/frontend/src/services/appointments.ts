import api from './api';

// Enums matching backend
export const AppointmentStatus = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const AppointmentType = {
  CONSULTATION: 'consultation',
  FOLLOW_UP: 'follow_up',
  PROCEDURE: 'procedure',
  LAB: 'lab',
  IMAGING: 'imaging',
  VACCINATION: 'vaccination',
  SCREENING: 'screening',
  OTHER: 'other',
} as const;
export type AppointmentType = (typeof AppointmentType)[keyof typeof AppointmentType];

// Interfaces
export interface Appointment {
  id: string;
  appointmentNumber: string;
  patientId: string;
  doctorId: string;
  facilityId: string;
  appointmentDate: string;
  startTime: string;
  endTime?: string;
  type: AppointmentType;
  status: AppointmentStatus;
  department?: string;
  reasonForVisit?: string;
  notes?: string;
  cancellationReason?: string;
  createdBy: string;
  // Patient and User entities store fullName (no firstName/lastName columns)
  patient?: { id: string; fullName: string; mrn?: string; phone?: string };
  doctor?: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentDto {
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  startTime: string;
  endTime?: string;
  type?: AppointmentType;
  department?: string;
  reasonForVisit?: string;
  notes?: string;
}

export interface UpdateAppointmentDto extends Partial<CreateAppointmentDto> {
  status?: AppointmentStatus;
  cancellationReason?: string;
}

export interface AppointmentQueryDto {
  date?: string;
  patientId?: string;
  doctorId?: string;
  status?: AppointmentStatus;
  type?: AppointmentType;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AppointmentListResult {
  data: Appointment[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export const appointmentsService = {
  create: async (data: CreateAppointmentDto): Promise<Appointment> => {
    const response = await api.post<Appointment>('/appointments', data);
    return response.data;
  },

  // Backend returns { data, meta } (pagination)
  list: async (params?: AppointmentQueryDto): Promise<AppointmentListResult> => {
    const response = await api.get('/appointments', { params });
    const body: any = response.data;
    if (Array.isArray(body)) {
      return { data: body, meta: { total: body.length, page: 1, limit: body.length, totalPages: 1 } };
    }
    return {
      data: body?.data || [],
      meta: body?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 },
    };
  },

  getById: async (id: string): Promise<Appointment> => {
    const response = await api.get<Appointment>(`/appointments/${id}`);
    return response.data;
  },

  getStats: async (date?: string) => {
    const response = await api.get('/appointments/stats', { params: { date } });
    return response.data;
  },

  update: async (id: string, data: UpdateAppointmentDto): Promise<Appointment> => {
    const response = await api.put<Appointment>(`/appointments/${id}`, data);
    return response.data;
  },

  updateStatus: async (id: string, status: AppointmentStatus, cancellationReason?: string): Promise<Appointment> => {
    const response = await api.patch<Appointment>(`/appointments/${id}/status`, { status, cancellationReason });
    return response.data;
  },

  checkIn: async (id: string): Promise<{ appointment: Appointment; queueEntry?: any }> => {
    const response = await api.post(`/appointments/${id}/check-in`);
    return response.data as any;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/appointments/${id}`);
  },
};

export default appointmentsService;
