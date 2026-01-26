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
} from 'lucide-react';

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
}

// Level 2 navigation item (may have children)
interface NavSubItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavLeafItem[];
}

// Level 1 navigation section (top-level menu)
interface NavSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavSubItem[];
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
        children: [
          { name: 'Patient Search', href: '/patients/search', icon: Search },
          { name: 'New Patient', href: '/patients/new', icon: UserPlus },
          { name: 'Update Patient', href: '/patients', icon: UserCircle },
          { name: 'Patient Documents', href: '/patients/documents', icon: FileText },
          { name: 'Patient History', href: '/patients/history', icon: ClipboardList },
        ],
      },
      {
        name: 'Queue & Tokens',
        icon: ListOrdered,
        children: [
          { name: 'Issue OPD Token', href: '/opd/token', icon: Receipt },
          { name: 'Queue Monitor', href: '/queue/monitor', icon: Activity },
          { name: 'Call Next Patient', href: '/queue/call', icon: Bell },
          { name: 'Queue Analytics', href: '/queue/analytics', icon: BarChart3 },
        ],
      },
      {
        name: 'Channelling',
        icon: CalendarDays,
        children: [
          { name: 'Book Appointment', href: '/appointments/new', icon: CalendarCheck },
          { name: 'View Appointments', href: '/appointments', icon: CalendarDays },
          { name: 'Doctor Schedules', href: '/schedules/doctors', icon: Clock },
          { name: 'Reschedule/Cancel', href: '/appointments/manage', icon: RefreshCw },
        ],
      },
      {
        name: 'Reception Billing',
        icon: CreditCard,
        children: [
          { name: 'New Bill', href: '/billing/reception/new', icon: Receipt },
          { name: 'Collect Payment', href: '/billing/reception/payment', icon: Banknote },
          { name: 'Print Receipt', href: '/billing/reception/receipt', icon: Printer },
          { name: 'Pending Payments', href: '/billing/reception/pending', icon: Clock },
          { name: 'Refunds', href: '/billing/reception/refunds', icon: RotateCcw },
        ],
      },
      {
        name: 'Insurance Desk',
        icon: ShieldCheck,
        children: [
          { name: 'Verify Coverage', href: '/insurance/verify', icon: Search },
          { name: 'Pre-Authorization', href: '/insurance/preauth', icon: FileCheck },
          { name: 'Claim Submission', href: '/insurance/submit', icon: FileText },
          { name: 'Insurance Cards', href: '/insurance/cards', icon: CreditCard },
        ],
      },
      {
        name: 'Registration Reports',
        icon: BarChart3,
        children: [
          { name: 'Daily Summary', href: '/reports/registration/daily', icon: FileText },
          { name: 'Patient Statistics', href: '/reports/registration/patients', icon: Users },
          { name: 'Revenue Report', href: '/reports/registration/revenue', icon: DollarSign },
          { name: 'Queue Performance', href: '/reports/registration/queue', icon: Activity },
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
        children: [
          { name: 'Record Vitals', href: '/nursing/vitals/new', icon: Heart },
          { name: 'Vitals History', href: '/nursing/vitals/history', icon: ClipboardList },
          { name: 'Vital Trends', href: '/nursing/vitals/trends', icon: TrendingUp },
          { name: 'Abnormal Alerts', href: '/nursing/vitals/alerts', icon: AlertTriangle },
        ],
      },
      {
        name: 'Triage & Assessment',
        icon: Thermometer,
        children: [
          { name: 'Triage Queue', href: '/nursing/triage', icon: ListOrdered },
          { name: 'Nursing Assessment', href: '/nursing/assessment', icon: ClipboardCheck },
          { name: 'Pain Assessment', href: '/nursing/pain', icon: Activity },
          { name: 'Fall Risk', href: '/nursing/fall-risk', icon: AlertTriangle },
        ],
      },
      {
        name: 'Medication',
        icon: Pill,
        children: [
          { name: 'Medication Schedule', href: '/nursing/meds/schedule', icon: Clock },
          { name: 'Administer Meds', href: '/nursing/meds/administer', icon: Pill },
          { name: 'Medication Chart', href: '/nursing/meds/chart', icon: ClipboardList },
          { name: 'Drug Allergies', href: '/nursing/meds/allergies', icon: AlertTriangle },
        ],
      },
      {
        name: 'Wound Care',
        icon: Bandage,
        children: [
          { name: 'Wound Assessment', href: '/nursing/wounds/assess', icon: ClipboardCheck },
          { name: 'Dressing Log', href: '/nursing/wounds/dressing', icon: FileText },
          { name: 'Wound Progress', href: '/nursing/wounds/progress', icon: TrendingUp },
        ],
      },
      {
        name: 'Patient Care',
        icon: Users,
        children: [
          { name: 'Care Plans', href: '/nursing/care-plans', icon: ClipboardList },
          { name: 'Nursing Notes', href: '/nursing/notes', icon: FileText },
          { name: 'Shift Handover', href: '/nursing/handover', icon: ArrowRightLeft },
          { name: 'Patient Education', href: '/nursing/education', icon: BookOpen },
        ],
      },
      {
        name: 'Procedures',
        icon: Syringe,
        children: [
          { name: 'IV Cannulation', href: '/nursing/procedures/iv', icon: Syringe },
          { name: 'Catheterization', href: '/nursing/procedures/catheter', icon: ClipboardCheck },
          { name: 'Specimen Collection', href: '/nursing/procedures/specimen', icon: FlaskConical },
          { name: 'Procedure Log', href: '/nursing/procedures/log', icon: FileText },
        ],
      },
      {
        name: 'Monitoring',
        icon: Monitor,
        children: [
          { name: 'Patient Monitor', href: '/nursing/monitor', icon: Monitor },
          { name: 'Intake/Output', href: '/nursing/io', icon: ArrowDownUp },
          { name: 'Blood Sugar', href: '/nursing/glucose', icon: Activity },
          { name: 'Observation Chart', href: '/nursing/observations', icon: ClipboardList },
        ],
      },
      {
        name: 'Nursing Reports',
        icon: BarChart3,
        children: [
          { name: 'Daily Report', href: '/nursing/reports/daily', icon: FileText },
          { name: 'Shift Summary', href: '/nursing/reports/shift', icon: Clock },
          { name: 'Incident Report', href: '/nursing/reports/incident', icon: AlertTriangle },
          { name: 'Workload Stats', href: '/nursing/reports/workload', icon: BarChart3 },
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
        children: [
          { name: 'Waiting Patients', href: '/doctor/queue', icon: ListOrdered },
          { name: 'Call Next', href: '/doctor/queue/call', icon: Bell },
          { name: 'Today\'s Schedule', href: '/doctor/schedule', icon: CalendarDays },
          { name: 'Pending Reviews', href: '/doctor/pending', icon: Clock },
        ],
      },
      {
        name: 'Consultation',
        icon: ClipboardPlus,
        children: [
          { name: 'New Consultation', href: '/encounters/new', icon: ClipboardPlus },
          { name: 'SOAP Notes', href: '/doctor/soap', icon: FileText },
          { name: 'Clinical Notes', href: '/doctor/notes', icon: ClipboardList },
          { name: 'Past Visits', href: '/encounters', icon: ClipboardCheck },
        ],
      },
      {
        name: 'Diagnosis',
        icon: Search,
        children: [
          { name: 'ICD-10 Coding', href: '/doctor/diagnosis/icd', icon: Search },
          { name: 'Differential Dx', href: '/doctor/diagnosis/differential', icon: ClipboardList },
          { name: 'Problem List', href: '/doctor/diagnosis/problems', icon: AlertTriangle },
        ],
      },
      {
        name: 'Prescriptions',
        icon: Pill,
        children: [
          { name: 'Write Prescription', href: '/doctor/prescriptions/new', icon: Pill },
          { name: 'Prescription History', href: '/doctor/prescriptions', icon: ClipboardList },
          { name: 'Drug Interactions', href: '/doctor/prescriptions/interactions', icon: AlertTriangle },
          { name: 'Favorites', href: '/doctor/prescriptions/favorites', icon: Heart },
        ],
      },
      {
        name: 'Orders',
        icon: ShoppingCart,
        children: [
          { name: 'Lab Orders', href: '/doctor/orders/lab', icon: FlaskConical },
          { name: 'Radiology Orders', href: '/doctor/orders/radiology', icon: Scan },
          { name: 'Procedure Orders', href: '/doctor/orders/procedures', icon: Scissors },
          { name: 'Order Sets', href: '/doctor/orders/sets', icon: Package },
        ],
      },
      {
        name: 'Results Review',
        icon: FileSpreadsheet,
        children: [
          { name: 'Lab Results', href: '/doctor/results/lab', icon: FlaskConical },
          { name: 'Imaging Results', href: '/doctor/results/imaging', icon: Scan },
          { name: 'Critical Values', href: '/doctor/results/critical', icon: AlertTriangle },
        ],
      },
      {
        name: 'Referrals',
        icon: ArrowRightLeft,
        children: [
          { name: 'New Referral', href: '/referrals/new', icon: ArrowRightLeft },
          { name: 'Sent Referrals', href: '/referrals/sent', icon: FileText },
          { name: 'Received Referrals', href: '/referrals/received', icon: ClipboardList },
        ],
      },
      {
        name: 'Certificates',
        icon: BadgeCheck,
        children: [
          { name: 'Medical Certificate', href: '/doctor/certificates/medical', icon: FileText },
          { name: 'Sick Leave', href: '/doctor/certificates/sick-leave', icon: CalendarCheck },
          { name: 'Fitness Certificate', href: '/doctor/certificates/fitness', icon: BadgeCheck },
          { name: 'Death Certificate', href: '/doctor/certificates/death', icon: FileText },
        ],
      },
      {
        name: 'Follow-up',
        icon: CalendarCheck,
        children: [
          { name: 'Schedule Follow-up', href: '/follow-ups/new', icon: CalendarCheck },
          { name: 'My Follow-ups', href: '/follow-ups', icon: CalendarDays },
          { name: 'Overdue', href: '/follow-ups/overdue', icon: AlertTriangle },
        ],
      },
    ],
  },
  // 4. Emergency
  {
    title: 'Emergency',
    icon: Siren,
    items: [
      { name: 'Emergency Queue', href: '/emergency', icon: Siren },
      { name: 'Ambulance Tracking', href: '/emergency/ambulance', icon: Ambulance },
      { name: 'Triage Assessment', href: '/emergency/triage', icon: Thermometer },
      { name: 'Emergency Billing', href: '/emergency/billing', icon: CreditCard },
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
        children: [
          { name: 'Lab Queue', href: '/lab/queue', icon: ListOrdered },
          { name: 'Sample Collection', href: '/lab/samples', icon: FlaskConical },
          { name: 'Results Entry', href: '/lab/results', icon: ClipboardCheck },
          { name: 'Lab Reports', href: '/lab/reports', icon: FileText },
          { name: 'Lab Analytics', href: '/lab/analytics', icon: BarChart3 },
        ],
      },
      {
        name: 'Radiology',
        icon: Scan,
        children: [
          { name: 'Radiology Queue', href: '/radiology/queue', icon: ListOrdered },
          { name: 'Imaging Orders', href: '/radiology/orders', icon: ClipboardList },
          { name: 'Results & Reports', href: '/radiology/results', icon: FileText },
          { name: 'Radiology Analytics', href: '/radiology/analytics', icon: BarChart3 },
        ],
      },
    ],
  },
  // 6. Pharmacy
  {
    title: 'Pharmacy',
    icon: Pill,
    items: [
      { name: 'Dispense Medication', href: '/pharmacy/dispense', icon: Pill },
      { name: 'Pharmacy Queue', href: '/pharmacy/queue', icon: ListOrdered },
      { name: 'Pharmacy Stock', href: '/pharmacy/stock', icon: Package },
      {
        name: 'Transactions',
        icon: ArrowDownUp,
        children: [
          { name: 'Retail Sales', href: '/pharmacy/retail', icon: ShoppingCart },
          { name: 'Wholesale', href: '/pharmacy/wholesale', icon: Boxes },
          { name: 'Inpatient Meds', href: '/pharmacy/inpatient', icon: Bed },
        ],
      },
      {
        name: 'Expiry Management',
        icon: AlertTriangle,
        children: [
          { name: 'Expiring Soon', href: '/pharmacy/expiry/soon', icon: Clock },
          { name: 'Expired Items', href: '/pharmacy/expiry/expired', icon: AlertTriangle },
          { name: 'Expiry Alerts', href: '/pharmacy/expiry/alerts', icon: Bell },
          { name: 'Disposal Log', href: '/pharmacy/expiry/disposal', icon: Trash2 },
          { name: 'Return to Supplier', href: '/pharmacy/expiry/return', icon: RotateCcw },
        ],
      },
      {
        name: 'Procurement',
        icon: Truck,
        children: [
          { name: 'Requisitions', href: '/pharmacy/requisitions', icon: ClipboardList },
          { name: 'Request Quotation', href: '/pharmacy/rfq', icon: FileText },
          { name: 'Compare Quotes', href: '/pharmacy/quotes/compare', icon: FileSpreadsheet },
          { name: 'Purchase Orders', href: '/pharmacy/po', icon: ShoppingCart },
          { name: 'Goods Received', href: '/pharmacy/grn', icon: PackageCheck },
          { name: 'Invoice Matching', href: '/pharmacy/invoices/match', icon: FileCheck },
          { name: 'Supplier Payments', href: '/pharmacy/supplier-payments', icon: DollarSign },
        ],
      },
      {
        name: 'Suppliers',
        icon: Building,
        children: [
          { name: 'Supplier List', href: '/pharmacy/suppliers', icon: Building },
          { name: 'Contracts', href: '/pharmacy/suppliers/contracts', icon: ScrollText },
          { name: 'Supplier Ratings', href: '/pharmacy/suppliers/ratings', icon: TrendingUp },
          { name: 'Price Lists', href: '/pharmacy/suppliers/prices', icon: DollarSign },
        ],
      },
      { name: 'Returns', href: '/pharmacy/returns', icon: RotateCcw },
      { name: 'Adjustments', href: '/pharmacy/adjustments', icon: ClipboardMinus },
      { name: 'Pharmacy Analytics', href: '/pharmacy/analytics', icon: BarChart3 },
    ],
  },
  // 7. IPD - Inpatient
  {
    title: 'IPD',
    icon: Bed,
    items: [
      { name: 'Admissions', href: '/ipd/admissions', icon: ClipboardPlus },
      { name: 'Wards & Beds', href: '/wards', icon: Bed },
      { name: 'BHT Issue', href: '/ipd/bht', icon: FileText },
      { name: 'Inpatient Billing', href: '/ipd/billing', icon: CreditCard },
      { name: 'Nursing Notes', href: '/ipd/nursing', icon: ClipboardList },
      { name: 'Theatre', href: '/theatre', icon: Scissors },
      { name: 'Maternity', href: '/maternity', icon: Baby },
      { name: 'Discharge', href: '/discharge', icon: ClipboardCheck },
      { name: 'IPD Analytics', href: '/ipd/analytics', icon: BarChart3 },
    ],
  },
  // 8. Billing & Finance
  {
    title: 'Billing',
    icon: CreditCard,
    items: [
      { name: 'Cashier', href: '/cashier', icon: CreditCard },
      {
        name: 'OPD Billing',
        icon: Receipt,
        children: [
          { name: 'New OPD Bill', href: '/billing/opd/new', icon: Receipt },
          { name: 'OPD Ordering', href: '/billing/opd/orders', icon: ShoppingCart },
          { name: 'Package Billing', href: '/billing/opd/packages', icon: Package },
          { name: 'Search OPD Bills', href: '/billing/opd/search', icon: Search },
        ],
      },
      { name: 'Invoices', href: '/billing/invoices', icon: Receipt },
      { name: 'Payments', href: '/billing/payments', icon: Banknote },
      {
        name: 'Insurance',
        icon: ShieldCheck,
        children: [
          { name: 'Claims', href: '/insurance/claims', icon: FileText },
          { name: 'Pre-auth', href: '/insurance/preauth', icon: FileCheck },
          { name: 'Providers', href: '/insurance/providers', icon: Building },
        ],
      },
      { name: 'Membership', href: '/membership', icon: Crown },
      {
        name: 'Procurement',
        icon: Truck,
        children: [
          { name: 'Requisitions', href: '/procurement/requisitions', icon: ClipboardList },
          { name: 'Request Quotation', href: '/procurement/rfq', icon: FileText },
          { name: 'Compare Quotes', href: '/procurement/quotes/compare', icon: FileSpreadsheet },
          { name: 'Approve Quotations', href: '/procurement/quotes/approve', icon: FileCheck },
          { name: 'Purchase Orders', href: '/procurement/orders', icon: ShoppingCart },
          { name: 'Goods Received', href: '/procurement/grn', icon: PackageCheck },
          { name: 'Invoice Matching', href: '/procurement/invoices/match', icon: FileCheck },
        ],
      },
      {
        name: 'Vendors',
        icon: Building,
        children: [
          { name: 'Vendor List', href: '/procurement/vendors', icon: Building },
          { name: 'Vendor Contracts', href: '/procurement/vendors/contracts', icon: ScrollText },
          { name: 'Vendor Ratings', href: '/procurement/vendors/ratings', icon: TrendingUp },
          { name: 'Price Agreements', href: '/procurement/vendors/prices', icon: DollarSign },
          { name: 'Vendor Payments', href: '/procurement/vendors/payments', icon: Banknote },
        ],
      },
      {
        name: 'Finance',
        icon: Calculator,
        children: [
          { name: 'Accounts', href: '/finance/accounts', icon: Calculator },
          { name: 'Journal Entries', href: '/finance/journals', icon: BookOpen },
          { name: 'Expenses', href: '/finance/expenses', icon: DollarSign },
          { name: 'Revenue', href: '/finance/revenue', icon: TrendingUp },
          { name: 'Financial Reports', href: '/finance/reports', icon: PieChart },
        ],
      },
    ],
  },
  // 9. Stores / Inventory
  {
    title: 'Stores',
    icon: Warehouse,
    items: [
      { name: 'Inventory', href: '/inventory', icon: Package },
      { name: 'Unit Issue', href: '/stores/issue', icon: ArrowRightLeft },
      { name: 'Store Transfers', href: '/stores/transfers', icon: ArrowDownUp },
      {
        name: 'Procurement',
        icon: Truck,
        children: [
          { name: 'Requisitions', href: '/stores/requisitions', icon: ClipboardList },
          { name: 'Request Quotation', href: '/stores/rfq', icon: FileText },
          { name: 'Compare Quotes', href: '/stores/quotes/compare', icon: FileSpreadsheet },
          { name: 'Purchase Orders', href: '/stores/po', icon: ShoppingCart },
          { name: 'Goods Received', href: '/stores/grn', icon: PackageCheck },
          { name: 'Invoice Matching', href: '/stores/invoices/match', icon: FileCheck },
        ],
      },
      {
        name: 'Suppliers',
        icon: Building,
        children: [
          { name: 'Supplier List', href: '/stores/suppliers', icon: Building },
          { name: 'Contracts', href: '/stores/suppliers/contracts', icon: ScrollText },
          { name: 'Supplier Payments', href: '/stores/payments', icon: DollarSign },
        ],
      },
      {
        name: 'Expiry & Disposal',
        icon: AlertTriangle,
        children: [
          { name: 'Expiring Items', href: '/stores/expiry/soon', icon: Clock },
          { name: 'Expired Items', href: '/stores/expiry/expired', icon: AlertTriangle },
          { name: 'Disposal Log', href: '/stores/disposal', icon: Trash2 },
        ],
      },
      { name: 'Adjustments', href: '/stores/adjustments', icon: ClipboardMinus },
      { name: 'Stock Takes', href: '/stores/stocktake', icon: ClipboardCheck },
      { name: 'Stores Analytics', href: '/stores/analytics', icon: BarChart3 },
    ],
  },
  // 10. Reports
  {
    title: 'Reports',
    icon: BarChart3,
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
      {
        name: 'Clinical Reports',
        icon: Stethoscope,
        children: [
          { name: 'Patient Statistics', href: '/reports/patients', icon: UserCircle },
          { name: 'Visit Reports', href: '/reports/visits', icon: ClipboardList },
          { name: 'Disease Statistics', href: '/reports/diseases', icon: Activity },
          { name: 'Mortality Reports', href: '/reports/mortality', icon: FileText },
        ],
      },
      {
        name: 'Financial Reports',
        icon: DollarSign,
        children: [
          { name: 'Revenue Reports', href: '/reports/revenue', icon: TrendingUp },
          { name: 'Collection Reports', href: '/reports/collections', icon: Banknote },
          { name: 'Outstanding', href: '/reports/outstanding', icon: AlertTriangle },
        ],
      },
      {
        name: 'Inventory Reports',
        icon: Package,
        children: [
          { name: 'Stock Reports', href: '/reports/stock', icon: Boxes },
          { name: 'Expiry Reports', href: '/reports/expiry', icon: AlertTriangle },
          { name: 'Consumption', href: '/reports/consumption', icon: BarChart3 },
        ],
      },
    ],
  },
  // 11. HR
  {
    title: 'HR',
    icon: Briefcase,
    items: [
      { name: 'Staff Records', href: '/hr/staff', icon: Users },
      { name: 'Payroll', href: '/hr/payroll', icon: Banknote },
      { name: 'Leave Management', href: '/hr/leave', icon: CalendarDays },
      { name: 'Attendance', href: '/hr/attendance', icon: Clock },
      { name: 'Recruitment', href: '/hr/recruitment', icon: UserPlus },
      { name: 'Appraisals', href: '/hr/appraisals', icon: BadgeCheck },
      { name: 'Training', href: '/hr/training', icon: BookOpen },
      { name: 'HR Analytics', href: '/hr/analytics', icon: BarChart3 },
    ],
  },
  // 12. Asset Management
  {
    title: 'Assets',
    icon: FolderKanban,
    items: [
      { name: 'Asset Register', href: '/assets', icon: FolderKanban },
      { name: 'Asset Allocation', href: '/assets/allocation', icon: ArrowRightLeft },
      { name: 'Maintenance', href: '/assets/maintenance', icon: Wrench },
      { name: 'Depreciation', href: '/assets/depreciation', icon: TrendingUp },
      { name: 'Asset Reports', href: '/assets/reports', icon: FileText },
    ],
  },
  // 13. Administration
  {
    title: 'Admin',
    icon: Settings,
    items: [
      {
        name: 'Users & Access',
        icon: Lock,
        children: [
          { name: 'User List', href: '/admin/users', icon: Users },
          { name: 'Roles & Permissions', href: '/admin/roles', icon: Shield },
          { name: 'Department Access', href: '/admin/users/departments', icon: Layers },
          { name: 'Activity Log', href: '/admin/users/activity', icon: ScrollText },
          { name: 'Active Sessions', href: '/admin/users/sessions', icon: MonitorSmartphone },
        ],
      },
      {
        name: 'Services & Pricing',
        icon: DollarSign,
        children: [
          { name: 'Service Catalog', href: '/admin/services', icon: Layers },
          { name: 'Pricing Management', href: '/admin/services/pricing', icon: DollarSign },
          { name: 'Service Packages', href: '/admin/services/packages', icon: Package },
          { name: 'Discount Schemes', href: '/admin/services/discounts', icon: Percent },
          { name: 'Tax Configuration', href: '/admin/services/tax', icon: Calculator },
        ],
      },
      {
        name: 'HR Management',
        icon: UserCog,
        children: [
          { name: 'Staff Directory', href: '/admin/hr/staff', icon: Users },
          { name: 'Departments', href: '/admin/hr/departments', icon: Building },
          { name: 'Designations', href: '/admin/hr/designations', icon: Briefcase },
          { name: 'Shift Management', href: '/admin/hr/shifts', icon: Clock },
          { name: 'Leave Management', href: '/admin/hr/leave', icon: Calendar },
          { name: 'Staff Credentials', href: '/admin/hr/credentials', icon: Award },
        ],
      },
      {
        name: 'Lab Services',
        icon: FlaskConical,
        children: [
          { name: 'Test Catalog', href: '/admin/lab/tests', icon: TestTube },
          { name: 'Lab Equipment', href: '/admin/lab/equipment', icon: MonitorSmartphone },
          { name: 'Reagents Inventory', href: '/admin/lab/reagents', icon: Beaker },
          { name: 'Test Panels', href: '/admin/lab/panels', icon: LayoutGrid },
        ],
      },
      {
        name: 'Procurement Settings',
        icon: ShoppingCart,
        children: [
          { name: 'Approval Workflows', href: '/admin/procurement/approvals', icon: GitBranch },
          { name: 'Budget Management', href: '/admin/procurement/budgets', icon: Wallet },
          { name: 'Procurement Policies', href: '/admin/procurement/policies', icon: FileText },
          { name: 'Item Categories', href: '/admin/procurement/categories', icon: FolderTree },
        ],
      },
      {
        name: 'Stores Management',
        icon: Warehouse,
        children: [
          { name: 'Store Locations', href: '/admin/stores/locations', icon: MapPin },
          { name: 'Item Master', href: '/admin/stores/items', icon: Package },
          { name: 'Units of Measure', href: '/admin/inventory/units', icon: Ruler },
          { name: 'Expiry Policies', href: '/admin/inventory/expiry', icon: AlertTriangle },
        ],
      },
      {
        name: 'Pharmacy Settings',
        icon: Pill,
        children: [
          { name: 'Drug Formulary', href: '/admin/pharmacy/formulary', icon: BookOpen },
          { name: 'Drug Categories', href: '/admin/pharmacy/categories', icon: FolderTree },
        ],
      },
      {
        name: 'Institution',
        icon: Building,
        children: [
          { name: 'Institution Profile', href: '/admin/site/profile', icon: Building },
          { name: 'Branches', href: '/admin/site/branches', icon: GitBranch },
          { name: 'Buildings & Floors', href: '/admin/site/buildings', icon: Landmark },
          { name: 'System Settings', href: '/admin/site/settings', icon: Settings },
          { name: 'Integrations', href: '/admin/site/integrations', icon: Link2 },
        ],
      },
      {
        name: 'Membership',
        icon: CreditCard,
        children: [
          { name: 'Membership Plans', href: '/admin/membership/plans', icon: Award },
          { name: 'Benefits', href: '/admin/membership/benefits', icon: Gift },
          { name: 'Corporate Plans', href: '/admin/membership/corporate', icon: Briefcase },
          { name: 'Membership Rules', href: '/admin/membership/rules', icon: FileText },
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
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
        <div className="flex items-center justify-between p-4 border-b bg-blue-600">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-white" />
            <div>
              <h1 className="font-bold text-white">Glide HIMS</h1>
              <p className="text-xs text-blue-200">Healthcare Management</p>
            </div>
          </div>
          <button
            className="text-white hover:text-blue-200"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="overflow-y-auto h-[calc(100vh-72px)]">
          {navigationSections.map((section) => (
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
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-gray-900 text-lg leading-tight">Glide HIMS</h1>
                <p className="text-xs text-gray-500">Healthcare Management System</p>
              </div>
            </div>
          </div>

          {/* Facility & User */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
              <HospitalIcon className="w-4 h-4" />
              <span>Main Hospital</span>
            </div>

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
          {navigationSections.map((section) => (
            <NavDropdown key={section.title} section={section} />
          ))}
        </nav>
      </header>

      {/* Page content */}
      <main className="p-4 lg:p-6">{children}</main>
    </div>
  );
}
