import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import {
  Building2,
  Users,
  Building,
  UserCircle,
  Stethoscope,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Shield,
  ShieldCheck,
  ClipboardList,
  Pill,
  CreditCard,
  Package,
  FlaskConical,
  Scan,
  Bed,
  Siren,
  Scissors,
  Baby,
  Briefcase,
  Calculator,
  BarChart3,
  Crown,
  Layers,
  Warehouse,
  ListOrdered,
  Building as TenantIcon,
  Activity,
  FileText,
  ArrowRightLeft,
  CalendarCheck,
  FileSpreadsheet,
  ClipboardCheck,
  Search,
  UserPlus,
  Clock,
  Heart,
  HeartPulse,
  Thermometer,
  Receipt,
  FileCheck,
  Truck,
  Wrench,
  DollarSign,
  Settings,
  Database,
  Globe,
  Lock,
  BookOpen,
  TrendingUp,
  PieChart,
  Banknote,
  HandCoins,
  ClipboardPlus,
  Ambulance,
  Printer,
  RotateCcw,
  UserCog,
  CalendarDays,
  BadgeCheck,
  FolderKanban,
  Home,
  CircleDollarSign,
  ShoppingCart,
  PackageCheck,
  AlertTriangle,
  Boxes,
  ArrowDownUp,
  ClipboardMinus,
  Trash2,
  RefreshCw,
  Building2 as HospitalIcon,
  MapPin,
  Languages,
  KeyRound,
  ScrollText,
  Folder,
  Bell,
  Syringe,
  Monitor,
  MonitorSmartphone,
  Percent,
  Calendar,
  Award,
  TestTube,
  Beaker,
  LayoutGrid,
  GitBranch,
  Wallet,
  FolderTree,
  Ruler,
  Landmark,
  Link2,
  Gift,
  Coins,
  Send,
  MessageSquare,
} from 'lucide-react';
import Logo, { LogoIcon } from './Logo';

// Custom Bandage icon (not in lucide)
const Bandage = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.5 5.5L5.5 18.5" />
    <path d="M5.5 5.5l13 13" />
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);

interface LayoutProps {
  children: ReactNode;
}

// Level 3 navigation item (leaf)
interface NavLeafItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permissions?: string[]; // Required permissions to see this item
}

// Level 2 navigation item (may have children)
interface NavSubItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavLeafItem[];
  permissions?: string[]; // Required permissions to see this item
}

// Level 1 navigation section (top-level menu)
interface NavSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavSubItem[];
  permissions?: string[]; // Required permissions to see this section
  roles?: string[]; // Required roles to see this section
}

// Comprehensive Level-3 Hospital ERP Navigation
const navigationSections: NavSection[] = [
  // 1. Registration - Reception/Front Desk (Everything done at reception)
  {
    title: 'Registration',
    icon: UserPlus,
    items: [
      {
        name: 'Patient Management',
        icon: Users,
        permissions: ['patients.read', 'patients.create'],
        children: [
          { name: 'Patient Search', href: '/patients/search', icon: Search, permissions: ['patients.read'] },
          { name: 'New Patient', href: '/patients/new', icon: UserPlus, permissions: ['patients.create'] },
          { name: 'Update Patient', href: '/patients', icon: UserCircle, permissions: ['patients.update'] },
          { name: 'Patient Documents', href: '/patients/documents', icon: FileText, permissions: ['patients.read'] },
          { name: 'Patient History', href: '/patients/history', icon: ClipboardList, permissions: ['patients.read'] },
        ],
      },
      {
        name: 'Queue & Tokens',
        icon: ListOrdered,
        permissions: ['queue.create', 'queue.read'],
        children: [
          { name: 'Issue OPD Token', href: '/opd/token', icon: Receipt, permissions: ['queue.create'] },
          { name: 'Queue Monitor', href: '/queue/monitor', icon: Activity, permissions: ['queue.read'] },
          { name: 'Call Next Patient', href: '/queue/call', icon: Bell, permissions: ['queue.update'] },
          { name: 'Queue Analytics', href: '/queue/analytics', icon: BarChart3, permissions: ['queue.read', 'analytics.read'] },
        ],
      },
      {
        name: 'Channelling',
        icon: CalendarDays,
        permissions: ['appointments.read', 'appointments.create'],
        children: [
          { name: 'Book Appointment', href: '/appointments/new', icon: CalendarCheck, permissions: ['appointments.create'] },
          { name: 'View Appointments', href: '/appointments', icon: CalendarDays, permissions: ['appointments.read'] },
          { name: 'Doctor Schedules', href: '/schedules/doctors', icon: Clock, permissions: ['appointments.read'] },
          { name: 'Reschedule/Cancel', href: '/appointments/manage', icon: RefreshCw, permissions: ['appointments.update', 'appointments.delete'] },
        ],
      },
      {
        name: 'Reception Billing',
        icon: CreditCard,
        permissions: ['billing.create', 'billing.read'],
        children: [
          { name: 'New Bill', href: '/billing/reception/new', icon: Receipt, permissions: ['billing.create'] },
          { name: 'Collect Payment', href: '/billing/reception/payment', icon: Banknote, permissions: ['billing.create'] },
          { name: 'Print Receipt', href: '/billing/reception/receipt', icon: Printer, permissions: ['billing.read'] },
          { name: 'Pending Payments', href: '/billing/reception/pending', icon: Clock, permissions: ['billing.read'] },
          { name: 'Refunds', href: '/billing/reception/refunds', icon: RotateCcw, permissions: ['billing.update'] },
        ],
      },
      {
        name: 'Insurance Desk',
        icon: ShieldCheck,
        permissions: ['insurance.read', 'insurance.create'],
        children: [
          { name: 'Verify Coverage', href: '/insurance/verify', icon: Search, permissions: ['insurance.read'] },
          { name: 'Pre-Authorization', href: '/insurance/preauth', icon: FileCheck, permissions: ['insurance.create'] },
          { name: 'Claim Submission', href: '/insurance/submit', icon: FileText, permissions: ['insurance.create'] },
          { name: 'Insurance Cards', href: '/insurance/cards', icon: CreditCard, permissions: ['insurance.read'] },
        ],
      },
      {
        name: 'Registration Reports',
        icon: BarChart3,
        permissions: ['reports.read'],
        children: [
          { name: 'Daily Summary', href: '/reports/registration/daily', icon: FileText, permissions: ['reports.read'] },
          { name: 'Patient Statistics', href: '/reports/registration/patients', icon: Users, permissions: ['reports.read'] },
          { name: 'Revenue Report', href: '/reports/registration/revenue', icon: DollarSign, permissions: ['reports.read', 'billing.read'] },
          { name: 'Queue Performance', href: '/reports/registration/queue', icon: Activity, permissions: ['reports.read'] },
        ],
      },
    ],
  },
  // 2. Nursing Workbench - Nursing Station Activities
  {
    title: 'Nursing',
    icon: Heart,
    items: [
      {
        name: 'Patient Vitals',
        icon: Activity,
        permissions: ['vitals.read', 'vitals.create'],
        children: [
          { name: 'Record Vitals', href: '/nursing/vitals/new', icon: Heart, permissions: ['vitals.create'] },
          { name: 'Vitals History', href: '/nursing/vitals/history', icon: ClipboardList, permissions: ['vitals.read'] },
          { name: 'Vital Trends', href: '/nursing/vitals/trends', icon: TrendingUp, permissions: ['vitals.read'] },
          { name: 'Abnormal Alerts', href: '/nursing/vitals/alerts', icon: AlertTriangle, permissions: ['vitals.read'] },
        ],
      },
      {
        name: 'Triage & Assessment',
        icon: Thermometer,
        permissions: ['nursing.read', 'nursing.create'],
        children: [
          { name: 'Triage Queue', href: '/nursing/triage', icon: ListOrdered, permissions: ['nursing.read'] },
          { name: 'Nursing Assessment', href: '/nursing/assessment', icon: ClipboardCheck, permissions: ['nursing.create'] },
          { name: 'Pain Assessment', href: '/nursing/pain', icon: Activity, permissions: ['nursing.create'] },
          { name: 'Fall Risk', href: '/nursing/fall-risk', icon: AlertTriangle, permissions: ['nursing.read'] },
        ],
      },
      {
        name: 'Medication',
        icon: Pill,
        permissions: ['pharmacy.read', 'pharmacy.dispense'],
        children: [
          { name: 'Medication Schedule', href: '/nursing/meds/schedule', icon: Clock, permissions: ['pharmacy.read'] },
          { name: 'Administer Meds', href: '/nursing/meds/administer', icon: Pill, permissions: ['pharmacy.dispense'] },
          { name: 'Medication Chart', href: '/nursing/meds/chart', icon: ClipboardList, permissions: ['pharmacy.read'] },
          { name: 'Drug Allergies', href: '/nursing/meds/allergies', icon: AlertTriangle, permissions: ['patients.read'] },
        ],
      },
      {
        name: 'Wound Care',
        icon: Bandage,
        permissions: ['nursing.read', 'nursing.create'],
        children: [
          { name: 'Wound Assessment', href: '/nursing/wounds/assess', icon: ClipboardCheck, permissions: ['nursing.create'] },
          { name: 'Dressing Log', href: '/nursing/wounds/dressing', icon: FileText, permissions: ['nursing.create'] },
          { name: 'Wound Progress', href: '/nursing/wounds/progress', icon: TrendingUp, permissions: ['nursing.read'] },
        ],
      },
      {
        name: 'Patient Care',
        icon: Users,
        permissions: ['nursing.read', 'nursing.create'],
        children: [
          { name: 'Care Plans', href: '/nursing/care-plans', icon: ClipboardList, permissions: ['nursing.read'] },
          { name: 'Nursing Notes', href: '/nursing/notes', icon: FileText, permissions: ['nursing.create'] },
          { name: 'Shift Handover', href: '/nursing/handover', icon: ArrowRightLeft, permissions: ['nursing.read'] },
          { name: 'Patient Education', href: '/nursing/education', icon: BookOpen, permissions: ['nursing.read'] },
        ],
      },
      {
        name: 'Procedures',
        icon: Syringe,
        permissions: ['nursing.create', 'procedures.create'],
        children: [
          { name: 'IV Cannulation', href: '/nursing/procedures/iv', icon: Syringe, permissions: ['nursing.create'] },
          { name: 'Catheterization', href: '/nursing/procedures/catheter', icon: ClipboardCheck, permissions: ['nursing.create'] },
          { name: 'Specimen Collection', href: '/nursing/procedures/specimen', icon: FlaskConical, permissions: ['lab.create'] },
          { name: 'Procedure Log', href: '/nursing/procedures/log', icon: FileText, permissions: ['nursing.read'] },
        ],
      },
      {
        name: 'Monitoring',
        icon: Monitor,
        permissions: ['vitals.read', 'nursing.read'],
        children: [
          { name: 'Patient Monitor', href: '/nursing/monitor', icon: Monitor, permissions: ['vitals.read'] },
          { name: 'Intake/Output', href: '/nursing/io', icon: ArrowDownUp, permissions: ['nursing.create'] },
          { name: 'Blood Sugar', href: '/nursing/glucose', icon: Activity, permissions: ['vitals.create'] },
          { name: 'Observation Chart', href: '/nursing/observations', icon: ClipboardList, permissions: ['nursing.read'] },
        ],
      },
      {
        name: 'Nursing Reports',
        icon: BarChart3,
        permissions: ['reports.read', 'nursing.read'],
        children: [
          { name: 'Daily Report', href: '/nursing/reports/daily', icon: FileText, permissions: ['reports.read'] },
          { name: 'Shift Summary', href: '/nursing/reports/shift', icon: Clock, permissions: ['reports.read'] },
          { name: 'Incident Report', href: '/nursing/reports/incident', icon: AlertTriangle, permissions: ['nursing.create'] },
          { name: 'Workload Stats', href: '/nursing/reports/workload', icon: BarChart3, permissions: ['reports.read'] },
        ],
      },
    ],
  },
  // 3. Doctors Workbench - Clinical Consultation
  {
    title: 'Doctors',
    icon: Stethoscope,
    items: [
      {
        name: 'My Queue',
        icon: ListOrdered,
        permissions: ['encounters.read'],
        children: [
          { name: 'Waiting Patients', href: '/doctor/queue', icon: ListOrdered, permissions: ['encounters.read'] },
          { name: 'Call Next', href: '/doctor/queue/call', icon: Bell, permissions: ['encounters.read'] },
          { name: 'Today\'s Schedule', href: '/doctor/schedule', icon: CalendarDays, permissions: ['appointments.read'] },
          { name: 'Pending Reviews', href: '/doctor/pending', icon: Clock, permissions: ['encounters.read'] },
        ],
      },
      {
        name: 'Consultation',
        icon: ClipboardPlus,
        permissions: ['encounters.create', 'encounters.read'],
        children: [
          { name: 'New Consultation', href: '/encounters/new', icon: ClipboardPlus, permissions: ['encounters.create'] },
          { name: 'SOAP Notes', href: '/doctor/soap', icon: FileText, permissions: ['clinical-notes.create'] },
          { name: 'Clinical Notes', href: '/doctor/notes', icon: ClipboardList, permissions: ['clinical-notes.read'] },
          { name: 'Past Visits', href: '/encounters', icon: ClipboardCheck, permissions: ['encounters.read'] },
        ],
      },
      {
        name: 'Diagnosis',
        icon: Search,
        permissions: ['diagnoses.create', 'diagnoses.read'],
        children: [
          { name: 'ICD-10 Coding', href: '/doctor/diagnosis/icd', icon: Search, permissions: ['diagnoses.create'] },
          { name: 'Differential Dx', href: '/doctor/diagnosis/differential', icon: ClipboardList, permissions: ['diagnoses.create'] },
          { name: 'Problem List', href: '/doctor/diagnosis/problems', icon: AlertTriangle, permissions: ['diagnoses.read'] },
        ],
      },
      {
        name: 'Prescriptions',
        icon: Pill,
        permissions: ['prescriptions.create', 'prescriptions.read'],
        children: [
          { name: 'Write Prescription', href: '/doctor/prescriptions/new', icon: Pill, permissions: ['prescriptions.create'] },
          { name: 'Prescription History', href: '/doctor/prescriptions', icon: ClipboardList, permissions: ['prescriptions.read'] },
          { name: 'Drug Interactions', href: '/doctor/prescriptions/interactions', icon: AlertTriangle, permissions: ['prescriptions.read'] },
          { name: 'Favorites', href: '/doctor/prescriptions/favorites', icon: Heart, permissions: ['prescriptions.create'] },
        ],
      },
      {
        name: 'Orders',
        icon: ShoppingCart,
        permissions: ['orders.create', 'lab.create', 'radiology.create'],
        children: [
          { name: 'Lab Orders', href: '/doctor/orders/lab', icon: FlaskConical, permissions: ['lab.create'] },
          { name: 'Radiology Orders', href: '/doctor/orders/radiology', icon: Scan, permissions: ['radiology.create'] },
          { name: 'Procedure Orders', href: '/doctor/orders/procedures', icon: Scissors, permissions: ['orders.create'] },
          { name: 'Order Sets', href: '/doctor/orders/sets', icon: Package, permissions: ['orders.read'] },
        ],
      },
      {
        name: 'Results Review',
        icon: FileSpreadsheet,
        permissions: ['lab.read', 'radiology.read'],
        children: [
          { name: 'Lab Results', href: '/doctor/results/lab', icon: FlaskConical, permissions: ['lab.read'] },
          { name: 'Imaging Results', href: '/doctor/results/imaging', icon: Scan, permissions: ['radiology.read'] },
          { name: 'Critical Values', href: '/doctor/results/critical', icon: AlertTriangle, permissions: ['lab.read'] },
        ],
      },
      {
        name: 'Referrals',
        icon: ArrowRightLeft,
        permissions: ['referrals.create', 'referrals.read'],
        children: [
          { name: 'New Referral', href: '/referrals/new', icon: ArrowRightLeft, permissions: ['referrals.create'] },
          { name: 'Sent Referrals', href: '/referrals/sent', icon: FileText, permissions: ['referrals.read'] },
          { name: 'Received Referrals', href: '/referrals/received', icon: ClipboardList, permissions: ['referrals.read'] },
        ],
      },
      {
        name: 'Certificates',
        icon: BadgeCheck,
        permissions: ['certificates.create'],
        children: [
          { name: 'Medical Certificate', href: '/doctor/certificates/medical', icon: FileText, permissions: ['certificates.create'] },
          { name: 'Sick Leave', href: '/doctor/certificates/sick-leave', icon: CalendarCheck, permissions: ['certificates.create'] },
          { name: 'Fitness Certificate', href: '/doctor/certificates/fitness', icon: BadgeCheck, permissions: ['certificates.create'] },
          { name: 'Death Certificate', href: '/doctor/certificates/death', icon: FileText, permissions: ['certificates.create'] },
        ],
      },
      {
        name: 'Follow-up',
        icon: CalendarCheck,
        permissions: ['appointments.create', 'appointments.read'],
        children: [
          { name: 'Schedule Follow-up', href: '/follow-ups/new', icon: CalendarCheck, permissions: ['appointments.create'] },
          { name: 'My Follow-ups', href: '/follow-ups', icon: CalendarDays, permissions: ['appointments.read'] },
          { name: 'Overdue', href: '/follow-ups/overdue', icon: AlertTriangle, permissions: ['appointments.read'] },
        ],
      },
    ],
  },
  // Chronic Care - Disease Management
  {
    title: 'Chronic Care',
    icon: HeartPulse,
    items: [
      { name: 'Dashboard', href: '/chronic-care/dashboard', icon: BarChart3, permissions: ['patients.read'] },
      { name: 'Patient Registry', href: '/chronic-care/registry', icon: ClipboardList, permissions: ['patients.read'] },
      { name: 'Follow-up Reminders', href: '/chronic-care/reminders', icon: Bell, permissions: ['patients.read'] },
      { name: 'Notification Settings', href: '/chronic-care/notifications', icon: Settings, permissions: ['settings.read'] },
    ],
    roles: ['doctor', 'nurse', 'admin'],
  },
  // 4. Emergency
  {
    title: 'Emergency',
    icon: Siren,
    items: [
      { name: 'Emergency Queue', href: '/emergency', icon: Siren, permissions: ['emergency.read'] },
      { name: 'Ambulance Tracking', href: '/emergency/ambulance', icon: Ambulance, permissions: ['emergency.read'] },
      { name: 'Triage Assessment', href: '/emergency/triage', icon: Thermometer, permissions: ['emergency.create'] },
      { name: 'Emergency Billing', href: '/emergency/billing', icon: CreditCard, permissions: ['emergency.read', 'billing.create'] },
    ],
  },
  // 5. Diagnostics - Lab & Radiology
  {
    title: 'Diagnostics',
    icon: FlaskConical,
    items: [
      {
        name: 'Laboratory',
        icon: FlaskConical,
        permissions: ['lab.read', 'lab.create'],
        children: [
          { name: 'Lab Queue', href: '/lab/queue', icon: ListOrdered, permissions: ['lab.read'] },
          { name: 'Sample Collection', href: '/lab/samples', icon: FlaskConical, permissions: ['lab.create'] },
          { name: 'Results Entry', href: '/lab/results', icon: ClipboardCheck, permissions: ['lab.update'] },
          { name: 'Lab Reports', href: '/lab/reports', icon: FileText, permissions: ['lab.read'] },
          { name: 'Lab Analytics', href: '/lab/analytics', icon: BarChart3, permissions: ['lab.read', 'analytics.read'] },
        ],
      },
      {
        name: 'Radiology',
        icon: Scan,
        permissions: ['radiology.read', 'radiology.create'],
        children: [
          { name: 'Radiology Queue', href: '/radiology/queue', icon: ListOrdered, permissions: ['radiology.read'] },
          { name: 'Imaging Orders', href: '/radiology/orders', icon: ClipboardList, permissions: ['radiology.read'] },
          { name: 'Results & Reports', href: '/radiology/results', icon: FileText, permissions: ['radiology.update'] },
          { name: 'Radiology Analytics', href: '/radiology/analytics', icon: BarChart3, permissions: ['radiology.read', 'analytics.read'] },
        ],
      },
    ],
  },
  // 6. Pharmacy
  {
    title: 'Pharmacy',
    icon: Pill,
    items: [
      { name: 'Dispense Medication', href: '/pharmacy/dispense', icon: Pill, permissions: ['pharmacy.update'] },
      { name: 'Pharmacy Queue', href: '/pharmacy/queue', icon: ListOrdered, permissions: ['pharmacy.read'] },
      { name: 'Pharmacy Stock', href: '/pharmacy/stock', icon: Package, permissions: ['pharmacy.read', 'inventory.read'] },
      {
        name: 'Transactions',
        icon: ArrowDownUp,
        permissions: ['pharmacy.create', 'pharmacy.read'],
        children: [
          { name: 'Retail Sales', href: '/pharmacy/retail', icon: ShoppingCart, permissions: ['pharmacy.create'] },
          { name: 'Wholesale', href: '/pharmacy/wholesale', icon: Boxes, permissions: ['pharmacy.create'] },
          { name: 'Inpatient Meds', href: '/pharmacy/inpatient', icon: Bed, permissions: ['pharmacy.read'] },
        ],
      },
      {
        name: 'Expiry Management',
        icon: AlertTriangle,
        permissions: ['inventory.read', 'pharmacy.read'],
        children: [
          { name: 'Expiring Soon', href: '/pharmacy/expiry/soon', icon: Clock, permissions: ['inventory.read'] },
          { name: 'Expired Items', href: '/pharmacy/expiry/expired', icon: AlertTriangle, permissions: ['inventory.read'] },
          { name: 'Expiry Alerts', href: '/pharmacy/expiry/alerts', icon: Bell, permissions: ['inventory.read'] },
          { name: 'Disposal Log', href: '/pharmacy/expiry/disposal', icon: Trash2, permissions: ['inventory.update'] },
          { name: 'Return to Supplier', href: '/pharmacy/expiry/return', icon: RotateCcw, permissions: ['inventory.update'] },
        ],
      },
      {
        name: 'Procurement',
        icon: Truck,
        permissions: ['procurement.read', 'procurement.create'],
        children: [
          { name: 'Requisitions', href: '/pharmacy/requisitions', icon: ClipboardList, permissions: ['procurement.read'] },
          { name: 'Request Quotation', href: '/pharmacy/rfq', icon: FileText, permissions: ['procurement.create'] },
          { name: 'Compare Quotes', href: '/pharmacy/quotes/compare', icon: FileSpreadsheet, permissions: ['procurement.read'] },
          { name: 'Purchase Orders', href: '/pharmacy/po', icon: ShoppingCart, permissions: ['procurement.create'] },
          { name: 'Goods Received', href: '/pharmacy/grn', icon: PackageCheck, permissions: ['procurement.update'] },
          { name: 'Invoice Matching', href: '/pharmacy/invoices/match', icon: FileCheck, permissions: ['procurement.read'] },
          { name: 'Supplier Payments', href: '/pharmacy/supplier-payments', icon: DollarSign, permissions: ['procurement.approve'] },
        ],
      },
      {
        name: 'Suppliers',
        icon: Building,
        permissions: ['suppliers.read', 'suppliers.create'],
        children: [
          { name: 'Supplier List', href: '/pharmacy/suppliers', icon: Building, permissions: ['suppliers.read'] },
          { name: 'Contracts', href: '/pharmacy/suppliers/contracts', icon: ScrollText, permissions: ['suppliers.read'] },
          { name: 'Supplier Ratings', href: '/pharmacy/suppliers/ratings', icon: TrendingUp, permissions: ['suppliers.read'] },
          { name: 'Price Lists', href: '/pharmacy/suppliers/prices', icon: DollarSign, permissions: ['suppliers.read'] },
        ],
      },
      { name: 'Returns', href: '/pharmacy/returns', icon: RotateCcw, permissions: ['pharmacy.update'] },
      { name: 'Adjustments', href: '/pharmacy/adjustments', icon: ClipboardMinus, permissions: ['pharmacy.update'] },
      { name: 'Pharmacy Analytics', href: '/pharmacy/analytics', icon: BarChart3, permissions: ['pharmacy.read', 'analytics.read'] },
    ],
  },
  // 7. IPD - Inpatient
  {
    title: 'IPD',
    icon: Bed,
    items: [
      { name: 'Admissions', href: '/ipd/admissions', icon: ClipboardPlus, permissions: ['ipd.create'] },
      { name: 'Wards & Beds', href: '/wards', icon: Bed, permissions: ['ipd.read'] },
      { name: 'BHT Issue', href: '/ipd/bht', icon: FileText, permissions: ['ipd.create'] },
      { name: 'Inpatient Billing', href: '/ipd/billing', icon: CreditCard, permissions: ['ipd.read', 'billing.create'] },
      { name: 'Nursing Notes', href: '/ipd/nursing', icon: ClipboardList, permissions: ['nursing.create', 'ipd.read'] },
      { name: 'Theatre', href: '/theatre', icon: Scissors, permissions: ['surgery.read', 'surgery.create'] },
      { name: 'Maternity', href: '/maternity', icon: Baby, permissions: ['maternity.read', 'maternity.create'] },
      { name: 'Discharge', href: '/discharge', icon: ClipboardCheck, permissions: ['ipd.update'] },
      { name: 'IPD Analytics', href: '/ipd/analytics', icon: BarChart3, permissions: ['ipd.read', 'analytics.read'] },
    ],
  },
  // 8. Billing & Finance
  {
    title: 'Billing',
    icon: CreditCard,
    items: [
      { name: 'Cashier', href: '/cashier', icon: CreditCard, permissions: ['billing.create'] },
      {
        name: 'OPD Billing',
        icon: Receipt,
        permissions: ['billing.create', 'billing.read'],
        children: [
          { name: 'New OPD Bill', href: '/billing/opd/new', icon: Receipt, permissions: ['billing.create'] },
          { name: 'OPD Ordering', href: '/billing/opd/orders', icon: ShoppingCart, permissions: ['billing.create'] },
          { name: 'Package Billing', href: '/billing/opd/packages', icon: Package, permissions: ['billing.create'] },
          { name: 'Search OPD Bills', href: '/billing/opd/search', icon: Search, permissions: ['billing.read'] },
        ],
      },
      { name: 'Invoices', href: '/billing/invoices', icon: Receipt, permissions: ['billing.read'] },
      { name: 'Payments', href: '/billing/payments', icon: Banknote, permissions: ['billing.read'] },
      {
        name: 'Insurance',
        icon: ShieldCheck,
        permissions: ['insurance.read', 'insurance.create'],
        children: [
          { name: 'Claims', href: '/insurance/claims', icon: FileText, permissions: ['insurance.read'] },
          { name: 'Pre-auth', href: '/insurance/preauth', icon: FileCheck, permissions: ['insurance.create'] },
          { name: 'Providers', href: '/insurance/providers', icon: Building, permissions: ['insurance.read'] },
        ],
      },
      { name: 'Membership', href: '/membership', icon: Crown, permissions: ['membership.read'] },
      {
        name: 'Procurement',
        icon: Truck,
        permissions: ['procurement.read', 'procurement.create'],
        children: [
          { name: 'Requisitions', href: '/procurement/requisitions', icon: ClipboardList, permissions: ['procurement.read'] },
          { name: 'Request Quotation', href: '/procurement/rfq', icon: FileText, permissions: ['procurement.create'] },
          { name: 'Compare Quotes', href: '/procurement/quotes/compare', icon: FileSpreadsheet, permissions: ['procurement.read'] },
          { name: 'Approve Quotations', href: '/procurement/quotes/approve', icon: FileCheck, permissions: ['procurement.approve'] },
          { name: 'Purchase Orders', href: '/procurement/orders', icon: ShoppingCart, permissions: ['procurement.create'] },
          { name: 'Goods Received', href: '/procurement/grn', icon: PackageCheck, permissions: ['procurement.update'] },
          { name: 'Invoice Matching', href: '/procurement/invoices/match', icon: FileCheck, permissions: ['procurement.read'] },
        ],
      },
      {
        name: 'Vendors',
        icon: Building,
        permissions: ['suppliers.read', 'suppliers.create'],
        children: [
          { name: 'Vendor List', href: '/procurement/vendors', icon: Building, permissions: ['suppliers.read'] },
          { name: 'Vendor Contracts', href: '/procurement/vendors/contracts', icon: ScrollText, permissions: ['suppliers.read'] },
          { name: 'Vendor Ratings', href: '/procurement/vendors/ratings', icon: TrendingUp, permissions: ['suppliers.read'] },
          { name: 'Price Agreements', href: '/procurement/vendors/prices', icon: DollarSign, permissions: ['suppliers.read'] },
          { name: 'Vendor Payments', href: '/procurement/vendors/payments', icon: Banknote, permissions: ['suppliers.update'] },
        ],
      },
      {
        name: 'Finance',
        icon: Calculator,
        permissions: ['finance.read', 'finance.create'],
        children: [
          { name: 'Accounts', href: '/finance/accounts', icon: Calculator, permissions: ['finance.read'] },
          { name: 'Journal Entries', href: '/finance/journals', icon: BookOpen, permissions: ['finance.create'] },
          { name: 'Expenses', href: '/finance/expenses', icon: DollarSign, permissions: ['finance.create'] },
          { name: 'Revenue', href: '/finance/revenue', icon: TrendingUp, permissions: ['finance.read'] },
          { name: 'Financial Reports', href: '/finance/reports', icon: PieChart, permissions: ['finance.read', 'reports.read'] },
        ],
      },
    ],
  },
  // 9. Stores / Inventory
  {
    title: 'Stores',
    icon: Warehouse,
    items: [
      { name: 'Inventory', href: '/inventory', icon: Package, permissions: ['inventory.read'] },
      { name: 'Unit Issue', href: '/stores/issue', icon: ArrowRightLeft, permissions: ['stores.create'] },
      { name: 'Store Transfers', href: '/stores/transfers', icon: ArrowDownUp, permissions: ['stores.update'] },
      {
        name: 'Procurement',
        icon: Truck,
        permissions: ['procurement.read', 'procurement.create'],
        children: [
          { name: 'Requisitions', href: '/stores/requisitions', icon: ClipboardList, permissions: ['procurement.read'] },
          { name: 'Request Quotation', href: '/stores/rfq', icon: FileText, permissions: ['procurement.create'] },
          { name: 'Compare Quotes', href: '/stores/quotes/compare', icon: FileSpreadsheet, permissions: ['procurement.read'] },
          { name: 'Purchase Orders', href: '/stores/po', icon: ShoppingCart, permissions: ['procurement.create'] },
          { name: 'Goods Received', href: '/stores/grn', icon: PackageCheck, permissions: ['procurement.update'] },
          { name: 'Invoice Matching', href: '/stores/invoices/match', icon: FileCheck, permissions: ['procurement.read'] },
        ],
      },
      {
        name: 'Suppliers',
        icon: Building,
        permissions: ['suppliers.read'],
        children: [
          { name: 'Supplier List', href: '/stores/suppliers', icon: Building, permissions: ['suppliers.read'] },
          { name: 'Contracts', href: '/stores/suppliers/contracts', icon: ScrollText, permissions: ['suppliers.read'] },
          { name: 'Supplier Payments', href: '/stores/payments', icon: DollarSign, permissions: ['suppliers.update'] },
        ],
      },
      {
        name: 'Expiry & Disposal',
        icon: AlertTriangle,
        permissions: ['inventory.read'],
        children: [
          { name: 'Expiring Items', href: '/stores/expiry/soon', icon: Clock, permissions: ['inventory.read'] },
          { name: 'Expired Items', href: '/stores/expiry/expired', icon: AlertTriangle, permissions: ['inventory.read'] },
          { name: 'Disposal Log', href: '/stores/disposal', icon: Trash2, permissions: ['inventory.update'] },
        ],
      },
      { name: 'Adjustments', href: '/stores/adjustments', icon: ClipboardMinus, permissions: ['inventory.update'] },
      { name: 'Stock Takes', href: '/stores/stock-take', icon: ClipboardCheck, permissions: ['inventory.read'] },
      { name: 'Stores Analytics', href: '/stores/analytics', icon: BarChart3, permissions: ['inventory.read', 'analytics.read'] },
    ],
  },
  // 10. Reports
  {
    title: 'Reports',
    icon: BarChart3,
    items: [
      { name: 'Reports Dashboard', href: '/reports', icon: LayoutDashboard, permissions: ['reports.read'] },
      { name: 'Analytics', href: '/analytics', icon: BarChart3, permissions: ['analytics.read'] },
      {
        name: 'Clinical Reports',
        icon: Stethoscope,
        permissions: ['reports.read'],
        children: [
          { name: 'Patient Statistics', href: '/reports/patients', icon: UserCircle, permissions: ['reports.read'] },
          { name: 'Visit Reports', href: '/reports/visits', icon: ClipboardList, permissions: ['reports.read'] },
          { name: 'Disease Statistics', href: '/reports/diseases', icon: Activity, permissions: ['reports.read'] },
          { name: 'Mortality Reports', href: '/reports/mortality', icon: FileText, permissions: ['reports.read'] },
        ],
      },
      {
        name: 'Financial Reports',
        icon: DollarSign,
        permissions: ['reports.read', 'finance.read'],
        children: [
          { name: 'Revenue Reports', href: '/reports/revenue', icon: TrendingUp, permissions: ['finance.read'] },
          { name: 'Collection Reports', href: '/reports/collections', icon: Banknote, permissions: ['finance.read'] },
          { name: 'Outstanding', href: '/reports/outstanding', icon: AlertTriangle, permissions: ['billing.read'] },
        ],
      },
      {
        name: 'Inventory Reports',
        icon: Package,
        permissions: ['reports.read', 'inventory.read'],
        children: [
          { name: 'Stock Reports', href: '/reports/stock', icon: Boxes, permissions: ['inventory.read'] },
          { name: 'Expiry Reports', href: '/reports/expiry', icon: AlertTriangle, permissions: ['inventory.read'] },
          { name: 'Consumption', href: '/reports/consumption', icon: BarChart3, permissions: ['inventory.read'] },
        ],
      },
    ],
  },
  // 11. HR
  {
    title: 'HR',
    icon: Briefcase,
    // Section shows if user has ANY of these item permissions
    items: [
      { name: 'Staff Records', href: '/hr/staff', icon: Users, permissions: ['employees.read', 'employees.create'] },
      { name: 'Payroll', href: '/hr/payroll', icon: Banknote, permissions: ['payroll.read', 'payroll.create'] },
      { name: 'My Payslips', href: '/hr/my-payslips', icon: Receipt, permissions: ['payroll.view-own'] },
      { name: 'Leave Management', href: '/hr/leave', icon: CalendarDays, permissions: ['leave.read', 'leave.create'] },
      { name: 'My Leave', href: '/hr/my-leave', icon: Calendar, permissions: ['leave.request-own'] },
      { name: 'Attendance', href: '/hr/attendance', icon: Clock, permissions: ['attendance.read', 'attendance.create'] },
      { name: 'My Attendance', href: '/hr/my-attendance', icon: ClipboardCheck, permissions: ['attendance.view-own'] },
      { name: 'Recruitment', href: '/hr/recruitment', icon: UserPlus, permissions: ['hr.create', 'recruitment.read'] },
      { name: 'Appraisals', href: '/hr/appraisals', icon: BadgeCheck, permissions: ['hr.read', 'appraisals.read'] },
      { name: 'Training', href: '/hr/training', icon: BookOpen, permissions: ['training.read', 'training.create'] },
      { name: 'HR Analytics', href: '/hr/analytics', icon: BarChart3, permissions: ['hr.read', 'analytics.read'] },
    ],
  },
  // 12. Asset Management
  {
    title: 'Assets',
    icon: FolderKanban,
    items: [
      { name: 'Asset Register', href: '/assets', icon: FolderKanban, permissions: ['assets.read'] },
      { name: 'Asset Allocation', href: '/assets/allocation', icon: ArrowRightLeft, permissions: ['assets.update'] },
      { name: 'Asset Tracking', href: '/assets/tracking', icon: MapPin, permissions: ['assets.read'] },
      { name: 'Maintenance', href: '/assets/maintenance', icon: Wrench, permissions: ['assets.read'] },
      { name: 'Depreciation', href: '/assets/depreciation', icon: TrendingUp, permissions: ['assets.read'] },
      { name: 'Transfers', href: '/assets/transfers', icon: ArrowRightLeft, permissions: ['assets.update'] },
      { name: 'Asset Reports', href: '/assets/reports', icon: FileText, permissions: ['assets.read', 'reports.read'] },
      { name: 'Categories', href: '/assets/categories', icon: Settings, permissions: ['admin', 'assets.create'] },
    ],
  },
  // 13. External Integrations
  {
    title: 'Integrations',
    icon: Database,
    items: [
      { name: 'Drug Database', href: '/integrations/drugs', icon: Pill, permissions: ['pharmacy.read'] },
      { name: 'Lab Reference', href: '/integrations/lab-reference', icon: TestTube, permissions: ['lab.read'] },
      { name: 'SMS Notifications', href: '/integrations/sms', icon: MessageSquare, permissions: ['admin', 'notifications.create'] },
    ],
  },
  // 14. Administration
  {
    title: 'Admin',
    icon: Settings,
    items: [
      {
        name: 'Users & Access',
        icon: Lock,
        permissions: ['users.read', 'users.create', 'roles.read'],
        children: [
          { name: 'User List', href: '/admin/users', icon: Users, permissions: ['users.read'] },
          { name: 'Roles & Permissions', href: '/admin/roles', icon: Shield, permissions: ['roles.read'] },
          { name: 'Department Access', href: '/admin/users/departments', icon: Layers, permissions: ['users.read'] },
          { name: 'Activity Log', href: '/admin/users/activity', icon: ScrollText, permissions: ['audit.read'] },
          { name: 'Active Sessions', href: '/admin/users/sessions', icon: MonitorSmartphone, permissions: ['users.read'] },
        ],
      },
      {
        name: 'Services & Pricing',
        icon: DollarSign,
        permissions: ['services.read', 'services.create'],
        children: [
          { name: 'Service Catalog', href: '/admin/services', icon: Layers, permissions: ['services.read'] },
          { name: 'Pricing Management', href: '/admin/services/pricing', icon: DollarSign, permissions: ['services.update'] },
          { name: 'Service Packages', href: '/admin/services/packages', icon: Package, permissions: ['services.create'] },
          { name: 'Discount Schemes', href: '/admin/services/discounts', icon: Percent, permissions: ['services.update'] },
          { name: 'Tax Configuration', href: '/admin/services/tax', icon: Calculator, permissions: ['services.update'] },
        ],
      },
      {
        name: 'HR Management',
        icon: UserCog,
        permissions: ['hr.read', 'employees.read'],
        children: [
          { name: 'Staff Directory', href: '/admin/hr/staff', icon: Users, permissions: ['employees.read'] },
          { name: 'Departments', href: '/admin/hr/departments', icon: Building, permissions: ['hr.read'] },
          { name: 'Designations', href: '/admin/hr/designations', icon: Briefcase, permissions: ['hr.read'] },
          { name: 'Shift Management', href: '/admin/hr/shifts', icon: Clock, permissions: ['hr.update'] },
          { name: 'Leave Management', href: '/admin/hr/leave', icon: Calendar, permissions: ['leave.read'] },
          { name: 'Staff Credentials', href: '/admin/hr/credentials', icon: Award, permissions: ['employees.read'] },
        ],
      },
      {
        name: 'Lab Services',
        icon: FlaskConical,
        permissions: ['lab.read', 'settings.read'],
        children: [
          { name: 'Test Catalog', href: '/admin/lab/tests', icon: TestTube, permissions: ['lab.read'] },
          { name: 'Lab Equipment', href: '/admin/lab/equipment', icon: MonitorSmartphone, permissions: ['lab.read'] },
          { name: 'Reagents Inventory', href: '/admin/lab/reagents', icon: Beaker, permissions: ['inventory.read'] },
          { name: 'Test Panels', href: '/admin/lab/panels', icon: LayoutGrid, permissions: ['lab.read'] },
        ],
      },
      {
        name: 'Procurement Settings',
        icon: ShoppingCart,
        permissions: ['procurement.read', 'settings.read'],
        children: [
          { name: 'Approval Workflows', href: '/admin/procurement/approvals', icon: GitBranch, permissions: ['settings.update'] },
          { name: 'Budget Management', href: '/admin/procurement/budgets', icon: Wallet, permissions: ['finance.read'] },
          { name: 'Procurement Policies', href: '/admin/procurement/policies', icon: FileText, permissions: ['settings.read'] },
          { name: 'Item Categories', href: '/admin/procurement/categories', icon: FolderTree, permissions: ['inventory.read'] },
        ],
      },
      {
        name: 'Stores Management',
        icon: Warehouse,
        permissions: ['stores.read', 'inventory.read'],
        children: [
          { name: 'Store Locations', href: '/admin/stores/locations', icon: MapPin, permissions: ['stores.read'] },
          { name: 'Item Master', href: '/admin/stores/items', icon: Package, permissions: ['inventory.read'] },
          { name: 'Item Classifications', href: '/settings/classifications', icon: FolderTree, permissions: ['inventory.read'] },
          { name: 'Units of Measure', href: '/admin/inventory/units', icon: Ruler, permissions: ['settings.read'] },
          { name: 'Expiry Policies', href: '/admin/inventory/expiry', icon: AlertTriangle, permissions: ['settings.read'] },
        ],
      },
      {
        name: 'Pharmacy Settings',
        icon: Pill,
        permissions: ['pharmacy.read', 'settings.read'],
        children: [
          { name: 'Drug Formulary', href: '/admin/pharmacy/formulary', icon: BookOpen, permissions: ['pharmacy.read'] },
          { name: 'Drug Categories', href: '/admin/pharmacy/categories', icon: FolderTree, permissions: ['pharmacy.read'] },
        ],
      },
      {
        name: 'Institution',
        icon: Building,
        permissions: ['settings.read', 'facilities.read'],
        children: [
          { name: 'Institution Profile', href: '/admin/site/profile', icon: Building, permissions: ['facilities.read'] },
          { name: 'Branches', href: '/admin/site/branches', icon: GitBranch, permissions: ['facilities.read'] },
          { name: 'Buildings & Floors', href: '/admin/site/buildings', icon: Landmark, permissions: ['facilities.read'] },
          { name: 'System Settings', href: '/admin/site/settings', icon: Settings, permissions: ['settings.update'] },
          { name: 'Integrations', href: '/admin/site/integrations', icon: Link2, permissions: ['settings.update'] },
        ],
      },
      {
        name: 'Membership',
        icon: CreditCard,
        permissions: ['membership.read', 'membership.create'],
        children: [
          { name: 'Membership Plans', href: '/admin/membership/plans', icon: Award, permissions: ['membership.read'] },
          { name: 'Benefits', href: '/admin/membership/benefits', icon: Gift, permissions: ['membership.read'] },
          { name: 'Corporate Plans', href: '/admin/membership/corporate', icon: Briefcase, permissions: ['membership.create'] },
          { name: 'Membership Rules', href: '/admin/membership/rules', icon: FileText, permissions: ['membership.update'] },
        ],
      },
      {
        name: 'Finance Settings',
        icon: CircleDollarSign,
        children: [
          { name: 'Currencies', href: '/admin/finance/currencies', icon: Coins },
          { name: 'Exchange Rates', href: '/admin/finance/exchange-rates', icon: ArrowRightLeft },
          { name: 'Payment Methods', href: '/admin/finance/payment-methods', icon: CreditCard },
        ],
      },
      {
        name: 'Notifications',
        icon: Bell,
        permissions: ['settings.read', 'settings.update'],
        children: [
          { name: 'SMS/Email Settings', href: '/notifications/settings', icon: Settings, permissions: ['settings.update'] },
          { name: 'Message Templates', href: '/notifications/templates', icon: FileText, permissions: ['settings.update'] },
          { name: 'Notification History', href: '/notifications/history', icon: ScrollText, permissions: ['settings.read'] },
          { name: 'Bulk Messaging', href: '/notifications/bulk', icon: Send, permissions: ['settings.update'] },
        ],
      },
    ],
  },
];

// Submenu item with optional children (Level 2)
function SubmenuItem({ 
  item, 
  onClose 
}: { 
  item: NavSubItem; 
  onClose: () => void;
}) {
  const [isSubOpen, setIsSubOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();

  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.href ? location.pathname === item.href : false;
  const hasActiveChild = item.children?.some(child => location.pathname === child.href);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (hasChildren) setIsSubOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsSubOpen(false), 300);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (hasChildren) {
    return (
      <div 
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={() => setIsSubOpen(!isSubOpen)}
          className={`flex items-center justify-between w-full px-4 py-2 text-sm transition-colors ${
            hasActiveChild
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <span className="flex items-center gap-2">
            <item.icon className="w-4 h-4" />
            {item.name}
          </span>
          <ChevronRight className="w-3 h-3" />
        </button>
        {isSubOpen && (
          <div 
            className="absolute left-full top-0 pl-1 z-[10000]"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="w-52 bg-white rounded-lg shadow-xl border border-gray-200 py-1">
              {item.children!.map((child) => {
                const childActive = location.pathname === child.href;
                return (
                  <Link
                    key={child.name}
                    to={child.href}
                    className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                      childActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={onClose}
                  >
                    <child.icon className="w-4 h-4" />
                    {child.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.href!}
      className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
        isActive
          ? 'bg-blue-50 text-blue-700 font-medium'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
      onClick={onClose}
    >
      <item.icon className="w-4 h-4" />
      {item.name}
    </Link>
  );
}

// Top-level dropdown menu (Level 1)
function NavDropdown({ section }: { section: NavSection }) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();

  // Check if any item in this section is active
  const isActive = section.items.some((item) => {
    if (item.href && location.pathname === item.href) return true;
    if (item.children) {
      return item.children.some((child) => location.pathname === child.href);
    }
    return false;
  });

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 300); // 300ms delay before closing
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium rounded-md transition-colors ${
          isActive
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <section.icon className="w-4 h-4" />
        <span>{section.title}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div 
          className="absolute left-0 top-full pt-1 z-[9999]"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="w-52 bg-white rounded-lg shadow-xl border border-gray-200 py-1">
            {section.items.map((item) => (
              <SubmenuItem 
                key={item.name} 
                item={item} 
                onClose={() => setIsOpen(false)} 
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Mobile navigation - Level 2 item
function MobileSubItem({ 
  item, 
  onClose,
  depth 
}: { 
  item: NavSubItem; 
  onClose: () => void;
  depth: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.href ? location.pathname === item.href : false;
  const hasActiveChild = item.children?.some(child => location.pathname === child.href);

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center justify-between w-full px-4 py-2 text-sm text-left ${
            hasActiveChild ? 'text-blue-700 font-medium' : 'text-gray-600'
          }`}
          style={{ paddingLeft: `${(depth + 1) * 16}px` }}
        >
          <span className="flex items-center gap-2">
            <item.icon className="w-4 h-4" />
            {item.name}
          </span>
          <ChevronRight
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        </button>
        {isExpanded && (
          <div className="bg-gray-50">
            {item.children!.map((child) => {
              const childActive = location.pathname === child.href;
              return (
                <Link
                  key={child.name}
                  to={child.href}
                  className={`flex items-center gap-2 px-4 py-2 text-sm ${
                    childActive
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  style={{ paddingLeft: `${(depth + 2) * 16}px` }}
                  onClick={onClose}
                >
                  <child.icon className="w-4 h-4" />
                  {child.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.href!}
      className={`flex items-center gap-2 px-4 py-2 text-sm ${
        isActive
          ? 'bg-blue-100 text-blue-700 font-medium'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
      style={{ paddingLeft: `${(depth + 1) * 16}px` }}
      onClick={onClose}
    >
      <item.icon className="w-4 h-4" />
      {item.name}
    </Link>
  );
}

// Mobile navigation accordion section
function MobileNavSection({ section, onClose }: { section: NavSection; onClose: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();

  const hasActiveItem = section.items.some((item) => {
    if (item.href && location.pathname === item.href) return true;
    if (item.children) {
      return item.children.some((child) => location.pathname === child.href);
    }
    return false;
  });

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center justify-between w-full px-4 py-3 text-left ${
          hasActiveItem ? 'bg-blue-50' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <section.icon className={`w-5 h-5 ${hasActiveItem ? 'text-blue-600' : 'text-gray-500'}`} />
          <span className={`font-medium ${hasActiveItem ? 'text-blue-700' : 'text-gray-900'}`}>
            {section.title}
          </span>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="bg-gray-50 py-1">
          {section.items.map((item) => (
            <MobileSubItem 
              key={item.name} 
              item={item} 
              onClose={onClose}
              depth={1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasRole, hasAnyPermission } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hospitalName, setHospitalName] = useState('');

  // Load hospital name from settings
  useEffect(() => {
    const loadHospitalName = () => {
      try {
        const stored = localStorage.getItem('glide_hospital_settings');
        if (stored) {
          const settings = JSON.parse(stored);
          setHospitalName(settings.name || '');
        }
      } catch {
        // Use default
      }
    };
    loadHospitalName();
    
    // Listen for settings changes
    const handleSettingsChange = (e: CustomEvent) => {
      setHospitalName(e.detail?.name || '');
    };
    window.addEventListener('hospital-settings-changed', handleSettingsChange as EventListener);
    return () => window.removeEventListener('hospital-settings-changed', handleSettingsChange as EventListener);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter navigation sections based on user roles/permissions
  const isSuperAdmin = user?.roles?.includes('Super Admin');
  
  // Debug: Log user permissions once
  // Helper to check if user has permission for a nav item
  const hasItemPermission = (item: NavSubItem | NavLeafItem): boolean => {
    if (isSuperAdmin) return true;
    if (!item.permissions || item.permissions.length === 0) return true; // No restriction
    return hasAnyPermission(item.permissions);
  };

  // Filter items within a section and return filtered section
  const filterSectionItems = (section: NavSection): NavSection => {
    if (isSuperAdmin) return section;
    
    const filteredItems = section.items
      .map((item) => {
        // If item has children, filter children too
        if ('children' in item && item.children) {
          const filteredChildren = item.children.filter(hasItemPermission);
          if (filteredChildren.length === 0) return null;
          return { ...item, children: filteredChildren };
        }
        // Simple item - check its permission
        return hasItemPermission(item) ? item : null;
      })
      .filter((item): item is NavSubItem => item !== null);

    return { ...section, items: filteredItems };
  };
  
  const filteredNavigationSections = navigationSections
    .map(filterSectionItems)
    .filter((section) => {
      // Super Admin sees everything
      if (isSuperAdmin) return true;
      
      // Section must have at least one visible item
      if (section.items.length === 0) {
        return false;
      }
      
      // Check role restriction (if defined at section level)
      if (section.roles && section.roles.length > 0) {
        const hasRequiredRole = section.roles.some((role) => hasRole(role));
        if (!hasRequiredRole) {
          return false;
        }
      }
      
      // Check section-level permission restriction (for sections that still define them)
      if (section.permissions && section.permissions.length > 0) {
        const hasRequiredPermission = hasAnyPermission(section.permissions);
        if (!hasRequiredPermission) {
          return false;
        }
      }
      
      return true;
    });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile menu drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-lg transform transition-transform duration-200 ease-in-out lg:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-3 border-b bg-blue-600">
          <Logo size="xs" variant="icon" />
          <button
            className="text-white hover:text-blue-200"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="overflow-y-auto h-[calc(100vh-72px)]">
          {filteredNavigationSections.map((section) => (
            <MobileNavSection 
              key={section.title} 
              section={section} 
              onClose={() => setMobileMenuOpen(false)} 
            />
          ))}
        </nav>
      </aside>

      {/* Top Header with Navigation */}
      <header className="bg-white shadow-md border-b border-gray-200 relative z-50">
        {/* Top bar with logo and user menu */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              className="lg:hidden text-gray-600 hover:text-gray-900"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Logo */}
            <Logo size="sm" variant="full" className="hidden sm:flex" />
            <Logo size="xs" variant="icon" className="sm:hidden" />
          </div>

          {/* Facility & User */}
          <div className="flex items-center gap-4">
            {hospitalName && (
              <div className="hidden md:flex items-center gap-2 text-sm">
                <HospitalIcon className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-gray-700">{hospitalName}</span>
              </div>
            )}

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-medium text-sm">
                    {user?.fullName?.charAt(0) || 'U'}
                  </span>
                </div>
                <span className="hidden sm:inline text-sm font-medium">
                  {user?.fullName || 'User'}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[9999]"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-[10000]">
                    <div className="px-4 py-2 border-b">
                      <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigation bar - visible on all screens */}
        <nav className="flex items-center gap-0.5 px-4 py-1.5 bg-gray-50 border-t border-gray-100 flex-wrap">
          {filteredNavigationSections.map((section) => (
            <NavDropdown key={section.title} section={section} />
          ))}
        </nav>
      </header>

      {/* Page content */}
      <main className="p-4 lg:p-6">{children}</main>
    </div>
  );
}
