import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileText, Award, DollarSign, Briefcase, AlertTriangle,
  TrendingUp, CreditCard, Search, Users, Download,
  Calendar, Building, Loader2, CheckCircle, X, Clock,
  Printer, ChevronRight,
} from 'lucide-react';
import { hrService } from '../../../services/hr';
import { facilitiesService } from '../../../services';
import { useInstitutionInfo } from '../../../lib/useInstitutionInfo';
import { formatCurrency } from '../../../lib/currency';
import {
  generatePayslipPDF,
  generateCertificateOfService,
  generateEmploymentLetter,
  generateSalaryCertificate,
  generateExperienceCertificate,
  generateWarningLetter,
  generatePromotionLetter,
  generateIdCard,
} from '../../../utils/hr-pdf-generator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Employee {
  id: string;
  fullName: string;
  employeeNumber?: string;
  jobTitle?: string;
  department?: { id: string; name: string } | string;
  email?: string;
  phone?: string;
  hireDate?: string;
  terminationDate?: string;
  employmentType?: string;
  basicSalary?: number;
  allowances?: { name: string; amount: number; taxable?: boolean }[];
  deductions?: { name: string; amount: number; type?: string }[];
  nationalId?: string;
  gender?: string;
  address?: string;
  bankName?: string;
  bankAccountNumber?: string;
  status?: string;
}

type DocumentTypeKey =
  | 'certificate-of-service'
  | 'employment-letter'
  | 'salary-certificate'
  | 'experience-certificate'
  | 'warning-letter'
  | 'promotion-letter'
  | 'id-card';

interface DocumentType {
  key: DocumentTypeKey;
  name: string;
  description: string;
  icon: React.ElementType;
}

interface RecentDocument {
  id: string;
  type: string;
  employeeName: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOCUMENT_TYPES: DocumentType[] = [
  {
    key: 'certificate-of-service',
    name: 'Certificate of Service',
    description: 'Official certificate confirming employment period and role',
    icon: Award,
  },
  {
    key: 'employment-letter',
    name: 'Employment Letter',
    description: 'Formal appointment/employment confirmation letter',
    icon: FileText,
  },
  {
    key: 'salary-certificate',
    name: 'Salary Certificate',
    description: 'Salary verification for bank/loan purposes',
    icon: DollarSign,
  },
  {
    key: 'experience-certificate',
    name: 'Experience Certificate',
    description: 'Detailed experience and service certificate',
    icon: Briefcase,
  },
  {
    key: 'warning-letter',
    name: 'Warning Letter',
    description: 'Formal disciplinary warning letter',
    icon: AlertTriangle,
  },
  {
    key: 'promotion-letter',
    name: 'Promotion Letter',
    description: 'Promotion announcement and new terms',
    icon: TrendingUp,
  },
  {
    key: 'id-card',
    name: 'Employee ID Card',
    description: 'Generate printable employee ID card',
    icon: CreditCard,
  },
];

const WARNING_TYPES = [
  'Verbal Warning',
  'First Written Warning',
  'Second Written Warning',
  'Final Warning',
] as const;

const WARNING_TYPE_MAP: Record<string, 'verbal' | 'first_written' | 'second_written' | 'final'> = {
  'Verbal Warning': 'verbal',
  'First Written Warning': 'first_written',
  'Second Written Warning': 'second_written',
  'Final Warning': 'final',
};

const PROBATION_OPTIONS = [
  { value: '1', label: '1 Month' },
  { value: '2', label: '2 Months' },
  { value: '3', label: '3 Months' },
  { value: '6', label: '6 Months' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDepartmentName(dept: Employee['department']): string {
  if (!dept) return 'N/A';
  return typeof dept === 'string' ? dept : dept.name;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(date: string | Date | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmployeeCard({
  employee,
  isSelected,
  onClick,
}: {
  employee: Employee;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        isSelected
          ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
          {getInitials(employee.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {employee.fullName}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {employee.jobTitle || 'No title'} &middot;{' '}
            {getDepartmentName(employee.department)}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>
    </button>
  );
}

function SelectedEmployeeInfo({ employee }: { employee: Employee }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold">
          {getInitials(employee.fullName)}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{employee.fullName}</h3>
          <p className="text-sm text-blue-700">{employee.jobTitle || 'N/A'}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div>
          <span className="font-medium text-gray-700">Dept:</span>{' '}
          {getDepartmentName(employee.department)}
        </div>
        <div>
          <span className="font-medium text-gray-700">Emp #:</span>{' '}
          {employee.employeeNumber || 'N/A'}
        </div>
        <div>
          <span className="font-medium text-gray-700">Hired:</span>{' '}
          {formatDate(employee.hireDate)}
        </div>
        <div>
          <span className="font-medium text-gray-700">Status:</span>{' '}
          <span
            className={`capitalize ${
              employee.status === 'active' ? 'text-green-600' : 'text-gray-500'
            }`}
          >
            {employee.status || 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}

function DocumentTypeCard({
  doc,
  isSelected,
  disabled,
  onClick,
}: {
  doc: DocumentType;
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = doc.icon;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow text-left ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer'
      } ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900">{doc.name}</h4>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {doc.description}
          </p>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Form field helpers
// ---------------------------------------------------------------------------

function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none';

const selectClass = inputClass;

const textareaClass = `${inputClass} min-h-[80px] resize-y`;

// ---------------------------------------------------------------------------
// Document-specific forms
// ---------------------------------------------------------------------------

interface FormProps {
  form: Record<string, string>;
  onChange: (key: string, value: string) => void;
  employee: Employee;
}

function CertificateOfServiceForm({ form, onChange }: FormProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="End Date (leave empty for active employees)">
        <input
          type="date"
          className={inputClass}
          value={form.endDate || ''}
          onChange={(e) => onChange('endDate', e.target.value)}
        />
      </FormField>
      <div />
      <FormField label="Signatory Name">
        <input
          type="text"
          className={inputClass}
          value={form.signatoryName || ''}
          onChange={(e) => onChange('signatoryName', e.target.value)}
          placeholder="e.g. Jane Doe"
        />
      </FormField>
      <FormField label="Signatory Title">
        <input
          type="text"
          className={inputClass}
          value={form.signatoryTitle || ''}
          onChange={(e) => onChange('signatoryTitle', e.target.value)}
          placeholder="Human Resources Manager"
        />
      </FormField>
    </div>
  );
}

function EmploymentLetterForm({ form, onChange, employee }: FormProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Start Date">
        <input
          type="date"
          className={inputClass}
          value={form.startDate || employee.hireDate?.slice(0, 10) || ''}
          onChange={(e) => onChange('startDate', e.target.value)}
        />
      </FormField>
      <FormField label="Probation Period">
        <select
          className={selectClass}
          value={form.probationPeriod || '3'}
          onChange={(e) => onChange('probationPeriod', e.target.value)}
        >
          {PROBATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Reporting To">
        <input
          type="text"
          className={inputClass}
          value={form.reportingTo || ''}
          onChange={(e) => onChange('reportingTo', e.target.value)}
          placeholder="e.g. Head of Department"
        />
      </FormField>
      <FormField label="Work Location">
        <input
          type="text"
          className={inputClass}
          value={form.workLocation || ''}
          onChange={(e) => onChange('workLocation', e.target.value)}
          placeholder="Defaults to institution name"
        />
      </FormField>
      <FormField label="Signatory Name">
        <input
          type="text"
          className={inputClass}
          value={form.signatoryName || ''}
          onChange={(e) => onChange('signatoryName', e.target.value)}
          placeholder="e.g. Jane Doe"
        />
      </FormField>
      <FormField label="Signatory Title">
        <input
          type="text"
          className={inputClass}
          value={form.signatoryTitle || ''}
          onChange={(e) => onChange('signatoryTitle', e.target.value)}
          placeholder="Human Resources Manager"
        />
      </FormField>
    </div>
  );
}

function SalaryCertificateForm({ form, onChange }: FormProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Signatory Name">
        <input
          type="text"
          className={inputClass}
          value={form.signatoryName || ''}
          onChange={(e) => onChange('signatoryName', e.target.value)}
          placeholder="e.g. Jane Doe"
        />
      </FormField>
      <FormField label="Signatory Title">
        <input
          type="text"
          className={inputClass}
          value={form.signatoryTitle || ''}
          onChange={(e) => onChange('signatoryTitle', e.target.value)}
          placeholder="Human Resources Manager"
        />
      </FormField>
    </div>
  );
}

function ExperienceCertificateForm({ form, onChange }: FormProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="End Date">
        <input
          type="date"
          className={inputClass}
          value={form.endDate || ''}
          onChange={(e) => onChange('endDate', e.target.value)}
        />
      </FormField>
      <div />
      <FormField label="Key Achievements" className="sm:col-span-2">
        <textarea
          className={textareaClass}
          value={form.keyAchievements || ''}
          onChange={(e) => onChange('keyAchievements', e.target.value)}
          placeholder="List the employee's key achievements and contributions…"
        />
      </FormField>
      <FormField label="Signatory Name">
        <input
          type="text"
          className={inputClass}
          value={form.signatoryName || ''}
          onChange={(e) => onChange('signatoryName', e.target.value)}
          placeholder="e.g. Jane Doe"
        />
      </FormField>
      <FormField label="Signatory Title">
        <input
          type="text"
          className={inputClass}
          value={form.signatoryTitle || ''}
          onChange={(e) => onChange('signatoryTitle', e.target.value)}
          placeholder="Human Resources Manager"
        />
      </FormField>
    </div>
  );
}

function WarningLetterForm({ form, onChange }: FormProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Warning Type">
        <select
          className={selectClass}
          value={form.warningType || WARNING_TYPES[0]}
          onChange={(e) => onChange('warningType', e.target.value)}
        >
          {WARNING_TYPES.map((wt) => (
            <option key={wt} value={wt}>
              {wt}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Incident Date">
        <input
          type="date"
          className={inputClass}
          value={form.incidentDate || ''}
          onChange={(e) => onChange('incidentDate', e.target.value)}
        />
      </FormField>
      <FormField label="Reason for Warning" className="sm:col-span-2">
        <input
          type="text"
          className={inputClass}
          value={form.reason || ''}
          onChange={(e) => onChange('reason', e.target.value)}
          placeholder="Brief reason for the warning"
        />
      </FormField>
      <FormField label="Details / Description" className="sm:col-span-2">
        <textarea
          className={textareaClass}
          value={form.details || ''}
          onChange={(e) => onChange('details', e.target.value)}
          placeholder="Detailed description of the incident or behaviour…"
        />
      </FormField>
      <FormField label="Expected Improvement" className="sm:col-span-2">
        <textarea
          className={textareaClass}
          value={form.expectedImprovement || ''}
          onChange={(e) => onChange('expectedImprovement', e.target.value)}
          placeholder="What is expected from the employee going forward…"
        />
      </FormField>
      <FormField label="Consequences if Not Improved" className="sm:col-span-2">
        <textarea
          className={textareaClass}
          value={form.consequences || ''}
          onChange={(e) => onChange('consequences', e.target.value)}
          placeholder="Actions that will be taken if the employee fails to improve…"
        />
      </FormField>
      <FormField label="Signatory Name">
        <input
          type="text"
          className={inputClass}
          value={form.signatoryName || ''}
          onChange={(e) => onChange('signatoryName', e.target.value)}
          placeholder="e.g. Jane Doe"
        />
      </FormField>
      <FormField label="Signatory Title">
        <input
          type="text"
          className={inputClass}
          value={form.signatoryTitle || ''}
          onChange={(e) => onChange('signatoryTitle', e.target.value)}
          placeholder="Human Resources Manager"
        />
      </FormField>
    </div>
  );
}

function PromotionLetterForm({ form, onChange }: FormProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="New Job Title">
        <input
          type="text"
          className={inputClass}
          value={form.newJobTitle || ''}
          onChange={(e) => onChange('newJobTitle', e.target.value)}
          placeholder="e.g. Senior Software Engineer"
        />
      </FormField>
      <FormField label="New Department (optional)">
        <input
          type="text"
          className={inputClass}
          value={form.newDepartment || ''}
          onChange={(e) => onChange('newDepartment', e.target.value)}
          placeholder="Leave blank if unchanged"
        />
      </FormField>
      <FormField label="New Salary (optional)">
        <input
          type="number"
          className={inputClass}
          value={form.newSalary || ''}
          onChange={(e) => onChange('newSalary', e.target.value)}
          placeholder="0.00"
          min={0}
          step="0.01"
        />
      </FormField>
      <FormField label="Effective Date">
        <input
          type="date"
          className={inputClass}
          value={form.effectiveDate || ''}
          onChange={(e) => onChange('effectiveDate', e.target.value)}
        />
      </FormField>
      <FormField label="Signatory Name">
        <input
          type="text"
          className={inputClass}
          value={form.signatoryName || ''}
          onChange={(e) => onChange('signatoryName', e.target.value)}
          placeholder="e.g. Jane Doe"
        />
      </FormField>
      <FormField label="Signatory Title">
        <input
          type="text"
          className={inputClass}
          value={form.signatoryTitle || ''}
          onChange={(e) => onChange('signatoryTitle', e.target.value)}
          placeholder="Human Resources Manager"
        />
      </FormField>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HRLettersPage() {
  // ---------- data queries ----------
  const institutionInfo = useInstitutionInfo();

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      try {
        return await facilitiesService.list();
      } catch {
        return [];
      }
    },
  });
  const facilityId = (facilities as { id: string }[])[0]?.id;

  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees', facilityId],
    queryFn: async () => {
      try {
        const res = await hrService.employees.list({ facilityId: facilityId! });
        return Array.isArray(res) ? res : ((res as unknown as { data: Employee[] }).data || []);
      } catch {
        return [];
      }
    },
    enabled: !!facilityId,
  });
  const employees: Employee[] = (employeesData as Employee[]) || [];

  // ---------- local state ----------
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<DocumentTypeKey | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({
    signatoryTitle: 'Human Resources Manager',
  });
  const [generating, setGenerating] = useState(false);
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([]);

  // ---------- derived ----------
  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return employees.filter((emp) => {
      const dept = getDepartmentName(emp.department).toLowerCase();
      return (
        emp.fullName?.toLowerCase().includes(term) ||
        emp.employeeNumber?.toLowerCase().includes(term) ||
        emp.jobTitle?.toLowerCase().includes(term) ||
        dept.includes(term)
      );
    });
  }, [employees, searchTerm]);

  const selectedDocMeta = useMemo(
    () => DOCUMENT_TYPES.find((d) => d.key === selectedDocType) ?? null,
    [selectedDocType],
  );

  // ---------- handlers ----------
  const handleFieldChange = useCallback((key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData({ signatoryTitle: 'Human Resources Manager' });
    setSelectedDocType(null);
  }, []);

  const handleSelectDocType = useCallback((key: DocumentTypeKey) => {
    setSelectedDocType(key);
    setFormData({ signatoryTitle: 'Human Resources Manager' });
  }, []);

  const addRecentDoc = useCallback(
    (type: string) => {
      if (!selectedEmployee) return;
      setRecentDocs((prev) => [
        {
          id: `${Date.now()}`,
          type,
          employeeName: selectedEmployee.fullName,
          timestamp: new Date(),
        },
        ...prev.slice(0, 19), // keep last 20
      ]);
    },
    [selectedEmployee],
  );

  const handleGenerate = useCallback(async () => {
    if (!selectedEmployee || !selectedDocType) return;
    setGenerating(true);

    const docName = selectedDocMeta?.name ?? selectedDocType;
    const inst = institutionInfo;
    const emp = selectedEmployee;
    const sigName = formData.signatoryName || '';
    const sigTitle = formData.signatoryTitle || 'Human Resources Manager';

    try {
      switch (selectedDocType) {
        case 'certificate-of-service':
          generateCertificateOfService(
            emp, inst, formData.endDate || undefined, sigName, sigTitle,
          );
          break;

        case 'employment-letter':
          generateEmploymentLetter(emp, inst, {
            startDate: formData.startDate || selectedEmployee.hireDate || '',
            probationMonths: Number(formData.probationPeriod) || 3,
            reportingTo: formData.reportingTo || '',
            workLocation: formData.workLocation || inst.name,
            signatoryName: sigName,
            signatoryTitle: sigTitle,
          });
          break;

        case 'salary-certificate':
          generateSalaryCertificate(emp, inst, sigName, sigTitle);
          break;

        case 'experience-certificate':
          generateExperienceCertificate(
            emp, inst, formData.endDate || undefined,
            formData.keyAchievements || '', sigName, sigTitle,
          );
          break;

        case 'warning-letter':
          generateWarningLetter(emp, inst, {
            warningType: WARNING_TYPE_MAP[formData.warningType || 'Verbal Warning'] || 'verbal',
            reason: formData.reason || '',
            incident_date: formData.incidentDate || '',
            details: formData.details || '',
            expectedImprovement: formData.expectedImprovement || '',
            consequenceIfNotImproved: formData.consequences || '',
            signatoryName: sigName,
            signatoryTitle: sigTitle,
          });
          break;

        case 'promotion-letter':
          generatePromotionLetter(emp, inst, {
            newTitle: formData.newJobTitle || '',
            newDepartment: formData.newDepartment || undefined,
            newSalary: formData.newSalary ? Number(formData.newSalary) : undefined,
            effectiveDate: formData.effectiveDate || '',
            signatoryName: sigName,
            signatoryTitle: sigTitle,
          });
          break;

        case 'id-card':
          generateIdCard(emp, inst);
          break;
      }

      toast.success(`${docName} generated successfully`);
      addRecentDoc(docName);
      resetForm();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error(`Failed to generate ${docName}: ${message}`);
    } finally {
      setGenerating(false);
    }
  }, [
    selectedEmployee,
    selectedDocType,
    selectedDocMeta,
    formData,
    institutionInfo,
    addRecentDoc,
    resetForm,
  ]);

  // ---------- form modal close on backdrop click ----------
  const handleModalClose = useCallback(() => {
    if (!generating) resetForm();
  }, [generating, resetForm]);

  // ---------- render ----------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-7 h-7 text-blue-600" />
          HR Letters &amp; Documents
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate official HR documents and certificates
        </p>
      </div>

      {/* Main grid: sidebar + content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left sidebar — employee selector */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-gray-500" />
              Select Employee
            </h2>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Employee list */}
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {loadingEmployees ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading…
                </div>
              ) : filteredEmployees.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  {searchTerm ? 'No employees match your search' : 'No employees found'}
                </p>
              ) : (
                filteredEmployees.map((emp) => (
                  <EmployeeCard
                    key={emp.id}
                    employee={emp}
                    isSelected={selectedEmployee?.id === emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                  />
                ))
              )}
            </div>

            {/* Selected employee info */}
            {selectedEmployee && (
              <SelectedEmployeeInfo employee={selectedEmployee} />
            )}
          </div>
        </div>

        {/* Right content */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedEmployee ? (
            /* No employee selected */
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-700">
                Select an employee to generate documents
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Choose an employee from the panel on the left to get started.
              </p>
            </div>
          ) : (
            <>
              {/* Document type cards */}
              <div>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">
                  Choose Document Type
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {DOCUMENT_TYPES.map((doc) => (
                    <DocumentTypeCard
                      key={doc.key}
                      doc={doc}
                      isSelected={selectedDocType === doc.key}
                      disabled={false}
                      onClick={() => handleSelectDocType(doc.key)}
                    />
                  ))}
                </div>
              </div>

              {/* Quick generate for ID card (no form needed) */}
              {selectedDocType === 'id-card' && (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Generate Employee ID Card
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    A printable ID card will be generated for{' '}
                    <strong>{selectedEmployee.fullName}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {generating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {generating ? 'Generating…' : 'Generate ID Card'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Recent documents */}
          {recentDocs.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-gray-500" />
                Recent Documents
              </h2>
              <div className="divide-y divide-gray-100">
                {recentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="font-medium text-gray-800">
                        {doc.type}
                      </span>
                      <span className="text-gray-400">—</span>
                      <span className="text-gray-600">{doc.employeeName}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatTimestamp(doc.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal for document-specific forms (everything except id-card) */}
      {selectedDocType && selectedDocType !== 'id-card' && selectedEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={handleModalClose}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-3">
                {selectedDocMeta && (
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <selectedDocMeta.icon className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {selectedDocMeta?.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    For {selectedEmployee.fullName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleModalClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5">
              {selectedDocType === 'certificate-of-service' && (
                <CertificateOfServiceForm
                  form={formData}
                  onChange={handleFieldChange}
                  employee={selectedEmployee}
                />
              )}
              {selectedDocType === 'employment-letter' && (
                <EmploymentLetterForm
                  form={formData}
                  onChange={handleFieldChange}
                  employee={selectedEmployee}
                />
              )}
              {selectedDocType === 'salary-certificate' && (
                <SalaryCertificateForm
                  form={formData}
                  onChange={handleFieldChange}
                  employee={selectedEmployee}
                />
              )}
              {selectedDocType === 'experience-certificate' && (
                <ExperienceCertificateForm
                  form={formData}
                  onChange={handleFieldChange}
                  employee={selectedEmployee}
                />
              )}
              {selectedDocType === 'warning-letter' && (
                <WarningLetterForm
                  form={formData}
                  onChange={handleFieldChange}
                  employee={selectedEmployee}
                />
              )}
              {selectedDocType === 'promotion-letter' && (
                <PromotionLetterForm
                  form={formData}
                  onChange={handleFieldChange}
                  employee={selectedEmployee}
                />
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
              <button
                type="button"
                onClick={handleModalClose}
                disabled={generating}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                {generating ? 'Generating…' : 'Generate Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
