import React, { useState, useMemo, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import { useAuthStore } from '../../../store/auth';
import {
  FileText,
  User,
  Calendar,
  Stethoscope,
  ClipboardList,
  Shield,
  Printer,
  Eye,
  PenTool,
  CheckCircle,
  Loader2,
  Search,
  X,
  Clock,
  Hash,
  Save,
  AlertCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { patientsService } from '../../../services/patients';
import { printService } from '../../../lib/print';
import { useInstitutionInfo } from '../../../lib/useInstitutionInfo';
import { useDoctorCertPrefs } from '../../../lib/useDoctorCertPrefs';
import { escapeHtml, safeImageUrl } from '../../../lib/sanitize';

interface Patient {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  patientId: string;
}

const certificatePurposes = ['Fitness', 'Illness', 'Follow-up', 'School/Work', 'Travel', 'Sports', 'Other'] as const;
type CertificatePurpose = (typeof certificatePurposes)[number];

const certificateTemplates: Record<CertificatePurpose, { findings: string; recommendations: string; validity: string }> = {
  'Fitness': {
    findings: 'Patient examined and found to be in good physical and mental health. No contraindications to normal activities.',
    recommendations: 'Fit for normal duties/activities. Regular health checkups recommended.',
    validity: '90',
  },
  'Illness': {
    findings: 'Patient is currently unwell and requires rest and medical treatment.',
    recommendations: 'Rest advised. Follow prescribed medication. Follow-up if symptoms persist.',
    validity: '7',
  },
  'Follow-up': {
    findings: 'Patient attended follow-up consultation. Condition is improving/stable.',
    recommendations: 'Continue current treatment plan. Next follow-up as scheduled.',
    validity: '30',
  },
  'School/Work': {
    findings: 'Patient was examined and found to be recovering from recent illness.',
    recommendations: 'May resume school/work activities. Light duties advised initially.',
    validity: '3',
  },
  'Travel': {
    findings: 'Patient is fit to travel. No communicable diseases or conditions that would preclude travel.',
    recommendations: 'Fit for travel. Standard travel health precautions recommended.',
    validity: '30',
  },
  'Sports': {
    findings: 'Patient has been examined and is physically fit for sports participation. Cardiovascular and musculoskeletal systems normal.',
    recommendations: 'Cleared for sports activities. Proper warm-up and hydration recommended.',
    validity: '180',
  },
  'Other': {
    findings: '',
    recommendations: '',
    validity: '30',
  },
};

function calculateAge(dob: string): string {
  if (!dob) return '';
  const birth = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) years--;
  if (years < 1) {
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
    return months <= 0 ? 'Less than 1 month' : `${months} month${months !== 1 ? 's' : ''}`;
  }
  return `${years} year${years !== 1 ? 's' : ''}`;
}

function generateSerial(): string {
  return `CERT-${new Date().getFullYear()}-MED-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export default function MedicalCertificatePage() {
  const { user } = useAuthStore();
  const inst = useInstitutionInfo();
  const { doctorName, prefs: doctorPrefs, updatePrefs: setDoctorPrefs, savePrefs: saveDoctorPrefs } = useDoctorCertPrefs();
  const certificateRef = useRef<HTMLDivElement>(null);

  // Patient search
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // Certificate fields
  const [purpose, setPurpose] = useState<CertificatePurpose>('Fitness');
  const [examinationDate, setExaminationDate] = useState(new Date().toISOString().split('T')[0]);
  const [findings, setFindings] = useState(certificateTemplates['Fitness'].findings);
  const [recommendations, setRecommendations] = useState(certificateTemplates['Fitness'].recommendations);
  const [validityPeriod, setValidityPeriod] = useState(certificateTemplates['Fitness'].validity);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Doctor editable prefs
  const [editingDoctor, setEditingDoctor] = useState(false);

  // Certificate serial — generated once per session / on save
  const [serial, setSerial] = useState('');

  // Patient search query (debounced via queryKey change)
  const { data: patientsResponse, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients', 'certificates', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch || undefined, limit: 50 }),
  });

  const patients: Patient[] = useMemo(() => {
    const raw = patientsResponse?.data ?? patientsResponse;
    if (!Array.isArray(raw)) return [];
    return (raw as any[]).map((p: any) => ({
      id: p.id,
      name: p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      dateOfBirth: p.dateOfBirth,
      gender: (p.gender || '').charAt(0).toUpperCase() + (p.gender || '').slice(1),
      patientId: p.mrn,
    }));
  }, [patientsResponse]);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const patientAge = useMemo(
    () => selectedPatient ? calculateAge(selectedPatient.dateOfBirth) : '',
    [selectedPatient]
  );

  const validUntil = useMemo(() => {
    const date = new Date(examinationDate);
    date.setDate(date.getDate() + parseInt(validityPeriod || '0'));
    return date.toISOString().split('T')[0];
  }, [examinationDate, validityPeriod]);

  const handlePurposeChange = (newPurpose: CertificatePurpose) => {
    setPurpose(newPurpose);
    const template = certificateTemplates[newPurpose];
    setFindings(template.findings);
    setRecommendations(template.recommendations);
    setValidityPeriod(template.validity);
  };

  const selectPatient = useCallback((p: Patient) => {
    setSelectedPatientId(p.id);
    setPatientSearch(p.name);
    setShowPatientDropdown(false);
  }, []);

  const clearPatient = useCallback(() => {
    setSelectedPatientId('');
    setPatientSearch('');
  }, []);

  const handleSaveDoctorPrefs = () => {
    saveDoctorPrefs();
    setEditingDoctor(false);
    toast.success('Physician details saved');
  };

  const canPrint = !!selectedPatientId && !!findings.trim();

  const buildCertificateHtml = (): string => {
    const certSerial = serial || generateSerial();
    if (!serial) setSerial(certSerial);

    const logoHtml = safeImageUrl(inst.logo)
      ? `<img src="${safeImageUrl(inst.logo)}" alt="" style="height:80px;object-fit:contain;margin:0 auto 8px;" />`
      : '';

    return `
      <div style="font-family:'Times New Roman',Times,serif;max-width:700px;margin:0 auto;padding:24px;color:#111;">
        <!-- Header -->
        <div style="text-align:center;border-bottom:3px double #1e40af;padding-bottom:16px;margin-bottom:20px;">
          ${logoHtml}
          <h1 style="font-size:22px;font-weight:bold;color:#1e3a5f;margin:0;letter-spacing:1px;">
            ${escapeHtml(inst.name) || 'Medical Facility'}
          </h1>
          ${inst.address ? `<p style="margin:4px 0 0;font-size:12px;color:#555;">${escapeHtml(inst.address)}</p>` : ''}
          ${inst.phone || inst.email ? `<p style="margin:2px 0 0;font-size:12px;color:#555;">${[inst.phone, inst.email].filter(Boolean).map(v => escapeHtml(v)).join(' • ')}</p>` : ''}
        </div>

        <!-- Title -->
        <div style="text-align:center;margin-bottom:24px;">
          <h2 style="font-size:20px;font-weight:bold;text-decoration:underline;color:#1e3a5f;margin:0;">
            MEDICAL CERTIFICATE
          </h2>
          <p style="font-size:11px;color:#888;margin:6px 0 0;">Ref: ${escapeHtml(certSerial)}</p>
        </div>

        <!-- Patient & Exam Info -->
        <table style="width:100%;font-size:13px;margin-bottom:16px;border-collapse:collapse;">
          <tr>
            <td style="padding:4px 8px;font-weight:bold;width:140px;color:#333;">Patient Name:</td>
            <td style="padding:4px 8px;border-bottom:1px dotted #999;">${escapeHtml(selectedPatient?.name) || '—'}</td>
            <td style="padding:4px 8px;font-weight:bold;width:50px;color:#333;">MRN:</td>
            <td style="padding:4px 8px;border-bottom:1px dotted #999;">${escapeHtml(selectedPatient?.patientId) || '—'}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;font-weight:bold;color:#333;">Date of Birth:</td>
            <td style="padding:4px 8px;border-bottom:1px dotted #999;">${escapeHtml(selectedPatient?.dateOfBirth) || '—'}</td>
            <td style="padding:4px 8px;font-weight:bold;color:#333;">Age:</td>
            <td style="padding:4px 8px;border-bottom:1px dotted #999;">${escapeHtml(patientAge) || '—'}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;font-weight:bold;color:#333;">Gender:</td>
            <td style="padding:4px 8px;border-bottom:1px dotted #999;">${escapeHtml(selectedPatient?.gender) || '—'}</td>
            <td style="padding:4px 8px;font-weight:bold;color:#333;">Examined:</td>
            <td style="padding:4px 8px;border-bottom:1px dotted #999;">${escapeHtml(examinationDate)}</td>
          </tr>
        </table>

        <!-- Purpose -->
        <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:6px;padding:10px 14px;margin-bottom:16px;">
          <strong style="color:#1e40af;">Purpose:</strong> ${escapeHtml(purpose)}
        </div>

        <!-- Findings -->
        <div style="margin-bottom:16px;">
          <h3 style="font-size:14px;font-weight:bold;color:#1e3a5f;border-bottom:1px solid #ddd;padding-bottom:4px;margin:0 0 8px;">
            Medical Findings
          </h3>
          <p style="font-size:13px;color:#333;line-height:1.6;margin:0;white-space:pre-wrap;">${escapeHtml(findings) || 'No findings recorded.'}</p>
        </div>

        <!-- Recommendations -->
        <div style="margin-bottom:16px;">
          <h3 style="font-size:14px;font-weight:bold;color:#1e3a5f;border-bottom:1px solid #ddd;padding-bottom:4px;margin:0 0 8px;">
            Recommendations
          </h3>
          <p style="font-size:13px;color:#333;line-height:1.6;margin:0;white-space:pre-wrap;">${escapeHtml(recommendations) || 'No recommendations.'}</p>
        </div>

        <!-- Validity -->
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:10px 14px;margin-bottom:24px;">
          <strong style="color:#065f46;">Valid from:</strong> ${escapeHtml(examinationDate)}
          &nbsp;&nbsp;<strong style="color:#065f46;">to:</strong> ${escapeHtml(validUntil)}
          &nbsp;&nbsp;<span style="color:#666;">(${escapeHtml(validityPeriod)} days)</span>
        </div>

        <!-- Signature -->
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:40px;padding-top:20px;border-top:1px solid #ddd;">
          <div>
            <p style="font-size:12px;color:#666;margin:0;">Date: ${escapeHtml(new Date().toLocaleDateString())}</p>
          </div>
          <div style="text-align:center;">
            <div style="width:200px;border-bottom:1px solid #333;margin-bottom:6px;">&nbsp;</div>
            <p style="font-size:13px;font-weight:bold;margin:0;">${escapeHtml(doctorName)}</p>
            ${doctorPrefs.qualification ? `<p style="font-size:11px;color:#555;margin:2px 0 0;">${escapeHtml(doctorPrefs.qualification)}</p>` : ''}
            ${doctorPrefs.registrationNo ? `<p style="font-size:11px;color:#555;margin:2px 0 0;">Reg. No: ${escapeHtml(doctorPrefs.registrationNo)}</p>` : ''}
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align:center;margin-top:32px;padding-top:12px;border-top:1px solid #eee;">
          <p style="font-size:10px;color:#999;margin:0;">
            This certificate is issued at the request of the patient and is valid for the period stated above.
          </p>
          ${inst.taxId ? `<p style="font-size:10px;color:#999;margin:4px 0 0;">TIN: ${escapeHtml(inst.taxId)}</p>` : ''}
        </div>
      </div>
    `;
  };

  const handlePrint = () => {
    if (!canPrint) {
      toast.error('Please select a patient and add findings before printing');
      return;
    }
    const html = buildCertificateHtml();
    printService.printDocument(html, { title: 'Medical Certificate' });
  };

  const handleSaveAndPrint = async () => {
    if (!canPrint) {
      toast.error('Please select a patient and add findings before saving');
      return;
    }
    setIsSaving(true);
    try {
      const certSerial = serial || generateSerial();
      if (!serial) setSerial(certSerial);

      const content = `[Medical Certificate] Serial: ${certSerial} | Purpose: ${purpose} | Examined: ${examinationDate} | Valid until: ${validUntil} | Findings: ${findings} | Recommendations: ${recommendations} | Certifying physician: ${doctorName}`;
      await patientsService.createNote(selectedPatientId, { type: 'administrative', content });
      toast.success(`Certificate saved (${certSerial})`);

      const html = buildCertificateHtml();
      printService.printDocument(html, { title: 'Medical Certificate' });
    } catch {
      toast.error('Failed to save certificate. Printing anyway...');
      const html = buildCertificateHtml();
      printService.printDocument(html, { title: 'Medical Certificate' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewCertificate = () => {
    setSelectedPatientId('');
    setPatientSearch('');
    setPurpose('Fitness');
    setExaminationDate(new Date().toISOString().split('T')[0]);
    setFindings(certificateTemplates['Fitness'].findings);
    setRecommendations(certificateTemplates['Fitness'].recommendations);
    setValidityPeriod(certificateTemplates['Fitness'].validity);
    setShowPreview(false);
    setSerial('');
  };

  // Fetch recent certificates for selected patient
  const { data: patientNotes } = useQuery({
    queryKey: ['patient-notes', selectedPatientId],
    queryFn: () => patientsService.getNotes(selectedPatientId),
    enabled: !!selectedPatientId,
  });

  const recentCertificates = useMemo(() => {
    if (!patientNotes) return [];
    const notes = Array.isArray(patientNotes) ? patientNotes : (patientNotes as any)?.data;
    if (!Array.isArray(notes)) return [];
    return notes
      .filter((n: any) => n.type === 'administrative' && n.content?.startsWith('[Medical Certificate]'))
      .slice(0, 5)
      .map((n: any) => {
        const match = n.content.match(/Serial: ([\w-]+)/);
        const purposeMatch = n.content.match(/Purpose: (\w[\w/\-]*)/);
        return {
          id: n.id,
          serial: match?.[1] || 'N/A',
          purpose: purposeMatch?.[1] || '',
          date: new Date(n.createdAt).toLocaleDateString(),
        };
      });
  }, [patientNotes]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Medical Certificate</h1>
            {serial && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Hash className="w-3 h-3" /> {serial}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewCertificate}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            New
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? 'Edit' : 'Preview'}
          </button>
          <button
            onClick={handlePrint}
            disabled={!canPrint}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleSaveAndPrint}
            disabled={!canPrint || isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save & Print
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {!showPreview ? (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column — Patient + Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Patient Search */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-blue-600" />
                  <h2 className="font-medium text-gray-900">Patient Information</h2>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value);
                      setShowPatientDropdown(true);
                      if (!e.target.value) setSelectedPatientId('');
                    }}
                    onFocus={() => setShowPatientDropdown(true)}
                    placeholder="Search by name or MRN..."
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {selectedPatientId && (
                    <button onClick={clearPatient} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {showPatientDropdown && !selectedPatientId && (
                    <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                      {isLoadingPatients ? (
                        <div className="p-4 text-center text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                          Searching...
                        </div>
                      ) : patients.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">No patients found</div>
                      ) : (
                        patients.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => selectPatient(p)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0 transition-colors"
                          >
                            <div className="font-medium text-gray-900">{p.name}</div>
                            <div className="text-xs text-gray-500">
                              {p.patientId} • {p.gender} • {p.dateOfBirth ? `DOB: ${p.dateOfBirth}` : ''}
                              {p.dateOfBirth ? ` (${calculateAge(p.dateOfBirth)})` : ''}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {selectedPatient && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">MRN</p>
                      <p className="text-sm font-semibold text-gray-900">{selectedPatient.patientId}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Age</p>
                      <p className="text-sm font-semibold text-gray-900">{patientAge}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Gender</p>
                      <p className="text-sm font-semibold text-gray-900">{selectedPatient.gender}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">DOB</p>
                      <p className="text-sm font-semibold text-gray-900">{selectedPatient.dateOfBirth || '—'}</p>
                    </div>
                  </div>
                )}

                {!selectedPatientId && (
                  <div className="mt-3 flex items-center gap-2 text-amber-600 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Select a patient to issue a certificate</span>
                  </div>
                )}
              </div>

              {/* Certificate Details */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  <h2 className="font-medium text-gray-900">Certificate Details</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Purpose</label>
                    <div className="flex flex-wrap gap-2">
                      {certificatePurposes.map((p) => (
                        <button
                          key={p}
                          onClick={() => handlePurposeChange(p)}
                          className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                            purpose === p
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Examination</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="date"
                          value={examinationDate}
                          onChange={(e) => setExaminationDate(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Validity (days)</label>
                      <input
                        type="number"
                        value={validityPeriod}
                        onChange={(e) => setValidityPeriod(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                        max="365"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Valid until: {validUntil}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Findings & Recommendations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-5 shadow-sm border">
                  <div className="flex items-center gap-2 mb-3">
                    <Stethoscope className="w-5 h-5 text-blue-600" />
                    <h2 className="font-medium text-gray-900">Medical Findings</h2>
                  </div>
                  <textarea
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                    placeholder="Enter examination findings..."
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                  />
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <h2 className="font-medium text-gray-900">Recommendations</h2>
                  </div>
                  <textarea
                    value={recommendations}
                    onChange={(e) => setRecommendations(e.target.value)}
                    placeholder="Enter recommendations..."
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Right Column — Doctor + History */}
            <div className="space-y-6">
              {/* Certifying Physician */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <h2 className="font-medium text-gray-900">Certifying Physician</h2>
                  </div>
                  <button
                    onClick={() => setEditingDoctor(!editingDoctor)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {editingDoctor ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {!editingDoctor ? (
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg space-y-2">
                    <p className="font-semibold text-blue-900 text-lg">{doctorName}</p>
                    {doctorPrefs.qualification && (
                      <p className="text-blue-700 text-sm">{doctorPrefs.qualification}</p>
                    )}
                    {doctorPrefs.registrationNo && (
                      <p className="text-blue-700 text-sm">Reg. No: {doctorPrefs.registrationNo}</p>
                    )}
                    {!doctorPrefs.qualification && !doctorPrefs.registrationNo && (
                      <p className="text-blue-500 text-xs italic">Click Edit to add your qualifications</p>
                    )}
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <div className="flex items-center gap-2 text-blue-600">
                        <PenTool className="w-4 h-4" />
                        <span className="text-xs">Digital signature</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Name (from login)</label>
                      <input
                        type="text"
                        value={doctorName}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Qualification</label>
                      <input
                        type="text"
                        value={doctorPrefs.qualification}
                        onChange={(e) => setDoctorPrefs({ qualification: e.target.value })}
                        placeholder="e.g. MBChB, MMed"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Registration No.</label>
                      <input
                        type="text"
                        value={doctorPrefs.registrationNo}
                        onChange={(e) => setDoctorPrefs({ registrationNo: e.target.value })}
                        placeholder="e.g. MED-2024-XXXXX"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={handleSaveDoctorPrefs}
                      className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save Details
                    </button>
                  </div>
                )}
              </div>

              {/* Recent Certificates */}
              {selectedPatientId && (
                <div className="bg-white rounded-xl p-5 shadow-sm border">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <h2 className="font-medium text-gray-900">Recent Certificates</h2>
                  </div>
                  {recentCertificates.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No previous certificates</p>
                  ) : (
                    <div className="space-y-2">
                      {recentCertificates.map((cert) => (
                        <div key={cert.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-xs font-mono text-gray-700">{cert.serial}</p>
                            <p className="text-xs text-gray-500">{cert.purpose}</p>
                          </div>
                          <p className="text-xs text-gray-500">{cert.date}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Info */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Tips</h3>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Select a purpose to auto-fill template text</li>
                  <li>• Edit findings and recommendations as needed</li>
                  <li>• Use Preview to review before printing</li>
                  <li>• Save & Print records the certificate and prints it</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* Preview Mode */
          <div className="max-w-3xl mx-auto">
            <div
              ref={certificateRef}
              className="bg-white rounded-xl shadow-lg border overflow-hidden"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(buildCertificateHtml()) }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
