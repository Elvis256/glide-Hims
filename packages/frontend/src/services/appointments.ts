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
  patient?: { id: string; firstName: string; lastName: string; mrn?: string };
  doctor?: { id: string; firstName: string; lastName: string };
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

export const appointmentsService = {
  create: (data: CreateAppointmentDto) =>
    api.post<Appointment>('/appointments', data),

  list: (params?: AppointmentQueryDto) =>
    api.get<Appointment[]>('/appointments', { params }),

  getById: (id: string) =>
    api.get<Appointment>(`/appointments/${id}`),

  getStats: (date?: string) =>
    api.get('/appointments/stats', { params: { date } }),

  update: (id: string, data: UpdateAppointmentDto) =>
    api.put<Appointment>(`/appointments/${id}`, data),

  updateStatus: (id: string, status: AppointmentStatus, cancellationReason?: string) =>
    api.patch<Appointment>(`/appointments/${id}/status`, { status, cancellationReason }),

  delete: (id: string) =>
    api.delete(`/appointments/${id}`),
};

export default appointmentsService;
