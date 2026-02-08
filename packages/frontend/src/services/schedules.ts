import api from './api';

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  doctor?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration: number;
  maxPatients: number;
  department?: string;
  isActive: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
}

export interface CreateScheduleDto {
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration?: number;
  maxPatients?: number;
  department?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
}

export interface ScheduleQueryParams {
  doctorId?: string;
  dayOfWeek?: number;
  department?: string;
  includeInactive?: boolean;
}

export const schedulesService = {
  getAll: async (params?: ScheduleQueryParams) => {
    const response = await api.get<{
      data: DoctorSchedule[];
      grouped: { doctor: any; schedules: DoctorSchedule[] }[];
    }>('/schedules', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<DoctorSchedule>(`/schedules/${id}`);
    return response.data;
  },

  create: async (data: CreateScheduleDto) => {
    const response = await api.post<DoctorSchedule>('/schedules', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateScheduleDto> & { isActive?: boolean }) => {
    const response = await api.put<DoctorSchedule>(`/schedules/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/schedules/${id}`);
  },

  getDoctorsWithSchedules: async () => {
    const response = await api.get<{ id: string; firstName: string; lastName: string }[]>(
      '/schedules/doctors',
    );
    return response.data;
  },
};
