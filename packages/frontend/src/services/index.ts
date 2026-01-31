// API Services
export { default as api } from './api';
export { authService } from './auth';
export { patientsService } from './patients';
export { queueService } from './queue';
export { encountersService } from './encounters';
export { insuranceService } from './insurance';
export { billingService } from './billing';
export { usersService } from './users';
export { rolesService, permissionsService } from './roles';
export { servicesService } from './services';
export { hrService } from './hr';
export { facilitiesService } from './facilities';
export { pharmacyService } from './pharmacy';
export { prescriptionsService } from './prescriptions';
export { labService } from './lab';
export { radiologyService } from './radiology';
export { storesService } from './stores';
export { financeService } from './finance';
export { membershipService } from './membership';
export { followUpsService } from './follow-ups';
export { ipdService } from './ipd';
export { ordersService } from './orders';
export { emergencyService } from './emergency';
export { procurementService } from './procurement';

// Re-export types
export type { Patient, CreatePatientDto, UpdatePatientDto, PatientSearchParams } from './patients';
export type { QueueEntry, CreateQueueEntryDto, QueueStats } from './queue';
export type { Encounter, CreateEncounterDto, UpdateEncounterDto } from './encounters';
export type { InsuranceProvider, InsurancePolicy, PreAuth, Claim } from './insurance';
export type { Invoice, Payment, CreateInvoiceDto, CreatePaymentDto } from './billing';
export type { User, Role, Permission, CreateUserDto, UpdateUserDto, ActivityLog } from './users';
export type { Service, ServiceCategory, ServicePackage, CreateServiceDto, CreateServicePackageDto } from './services';
export type { Employee, Attendance, LeaveRequest, PayrollRun } from './hr';
export type { Facility, Department, Unit } from './facilities';
export type { PharmacySale, DrugClassification, Supplier } from './pharmacy';
export type { Prescription, PrescriptionItem } from './prescriptions';
export type { LabOrder, LabOrderTest, LabResult, LabTest, LabSample } from './lab';
export type { ImagingOrder, ImagingResult, ImagingModality, DashboardStats as RadiologyDashboardStats, RadiologyOrder, RadiologyResult } from './radiology';
export type { InventoryItem, StockMovement, Store } from './stores';
export type { Currency, ExchangeRate, CreateCurrencyDto, CreateExchangeRateDto } from './finance';
export type { MembershipPlan, Membership, CreatePlanDto } from './membership';
export type { FollowUp, CreateFollowUpDto, FollowUpFilterParams, FollowUpStats, FollowUpStatus, FollowUpType, FollowUpPriority } from './follow-ups';
export type { Order, CreateOrderDto, OrderQueryParams, OrderType, OrderStatus, OrderPriority, TestCode } from './orders';
export type { 
  EmergencyCase, EmergencyDashboard, CreateEmergencyCaseDto, TriageDto, 
  DischargeEmergencyDto, AdmitFromEmergencyDto,
} from './emergency';
export { TriageLevel, TriageStatus, ArrivalMode } from './emergency';
export type { 
  PurchaseRequest, PurchaseOrder, GoodsReceipt, ProcurementDashboard,
  CreatePurchaseRequestDto, CreatePurchaseOrderDto, CreateGoodsReceiptDto,
} from './procurement';
