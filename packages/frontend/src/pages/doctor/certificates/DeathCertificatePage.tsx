import { usePermissions } from '../../../components/PermissionGate';
import React, { useState, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/auth';
import {
  Skull,
  User,
  Calendar,
  Clock,
  MapPin,
  FileText,
  Printer,
  Eye,
  Send,
  AlertTriangle,
  ClipboardList,
  Stethoscope,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { patientsService } from '../../../services/patients';
import { printContent, printService } from '../../../lib/print';
import { useInstitutionInfo } from '../../../lib/useInstitutionInfo';
import { useDoctorCertPrefs } from '../../../lib/useDoctorCertPrefs';
import { escapeHtml } from '../../../lib/sanitize';

interface LocalPatient {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  patientId: string;
}

const mannerOfDeathOptions = ['Natural', 'Accident', 'Suicide', 'Homicide', 'Pending Investigation'] as const;
type MannerOfDeath = (typeof mannerOfDeathOptions)[number];

const autopsyOptions = ['Performed', 'Pending', 'Not performed'] as const;
type AutopsyStatus = (typeof autopsyOptions)[number];

// Doctor details loaded from shared hook (see useDoctorCertPrefs)

export default function DeathCertificatePage() {
  const { hasPermission } = usePermissions();
  const { user } = useAuthStore();
  const inst = useInstitutionInfo();
  const { doctorName: certDoctorName, prefs: doctorPrefs } = useDoctorCertPrefs();
  const doctorDetails = {
    name: certDoctorName,
    qualification: doctorPrefs.qualification,
    registrationNo: doctorPrefs.registrationNo,
  };
  const certificateRef = useRef<HTMLDivElement>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [dateOfDeath, setDateOfDeath] = useState<string>(new Date().toISOString().split('T')[0]);
  const [timeOfDeath, setTimeOfDeath] = useState<string>('');
  const [placeOfDeath, setPlaceOfDeath] = useState<string>('');
  const [immediateCause, setImmediateCause] = useState<string>('');
  const [antecedentCause, setAntecedentCause] = useState<string>('');
  const [underlyingCause, setUnderlyingCause] = useState<string>('');
  const [mannerOfDeath, setMannerOfDeath] = useState<MannerOfDeath>('Natural');
  const [contributingConditions, setContributingConditions] = useState<string>('');
  const [autopsyStatus, setAutopsyStatus] = useState<AutopsyStatus>('Not performed');
  const [certifiedBy, setCertifiedBy] = useState<string>('Attending Physician');
  const [showPreview, setShowPreview] = useState<boolean>(false);

  const { data: patientsResponse, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients', 'death-certificate'],
    queryFn: () => patientsService.search({ limit: 100 }),
  });

  const patients: LocalPatient[] = useMemo(() => {
    if (!patientsResponse?.data) return [];
    return patientsResponse.data.map((p) => ({
      id: p.id,
      name: p.fullName,
      dateOfBirth: p.dateOfBirth,
      gender: p.gender.charAt(0).toUpperCase() + p.gender.slice(1),
      patientId: p.mrn,
    }));
  }, [patientsResponse]);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const calculateAge = useMemo(() => {
    if (!selectedPatient) return null;
    const birth = new Date(selectedPatient.dateOfBirth);
    const death = new Date(dateOfDeath);
    let age = death.getFullYear() - birth.getFullYear();
    const monthDiff = death.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && death.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }, [selectedPatient, dateOfDeath]);

  const buildCertificateHtml = (): string => {
    const logoHtml = inst.logo
      ? `<img src="${inst.logo}" alt="" style="height:80px;object-fit:contain;margin:0 auto 8px;" />`
      : '';
    return `
      <div style="font-family:'Times New Roman',Times,serif;max-width:700px;margin:0 auto;padding:24px;color:#111;">
        <div style="text-align:center;border-bottom:3px double #555;padding-bottom:16px;margin-bottom:20px;">
          ${logoHtml}
          <h1 style="font-size:22px;font-weight:bold;color:#1a1a2e;margin:0;letter-spacing:1px;">${escapeHtml(inst.name) || 'Medical Facility'}</h1>
          ${inst.address ? `<p style="margin:4px 0 0;font-size:12px;color:#555;">${escapeHtml(inst.address)}</p>` : ''}
          ${inst.phone || inst.email ? `<p style="margin:2px 0 0;font-size:12px;color:#555;">${[inst.phone, inst.email].filter(Boolean).map(v => escapeHtml(v)).join(' • ')}</p>` : ''}
        </div>
        <div style="text-align:center;margin-bottom:24px;">
          <h2 style="font-size:20px;font-weight:bold;text-decoration:underline;color:#1a1a2e;margin:0;">CERTIFICATE OF DEATH</h2>
        </div>
        <div style="font-size:13px;line-height:1.7;">
          <table style="width:100%;border-collapse:collapse;margin:0 0 16px;background:#f9fafb;border-radius:6px;">
            <tr>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;width:35%;color:#6b7280;font-size:11px;">Name of Deceased</td>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(selectedPatient?.name) || '________________'}</td>
            </tr>
            <tr>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:11px;">Patient ID</td>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(selectedPatient?.patientId) || '________'}</td>
            </tr>
            <tr>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:11px;">Date of Birth</td>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(selectedPatient?.dateOfBirth) || '________'}</td>
            </tr>
            <tr>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:11px;">Age at Death</td>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;">${calculateAge !== null ? `${escapeHtml(calculateAge)} years` : '________'}</td>
            </tr>
            <tr>
              <td style="padding:8px 14px;color:#6b7280;font-size:11px;">Gender</td>
              <td style="padding:8px 14px;font-weight:600;">${escapeHtml(selectedPatient?.gender) || '________'}</td>
            </tr>
          </table>
          <table style="width:100%;border-collapse:collapse;margin:0 0 16px;border:1px solid #e5e7eb;border-radius:6px;">
            <tr>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;width:35%;color:#6b7280;font-size:11px;">Date of Death</td>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(dateOfDeath)}</td>
            </tr>
            <tr>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:11px;">Time of Death</td>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(timeOfDeath) || 'Not recorded'}</td>
            </tr>
            <tr>
              <td style="padding:8px 14px;color:#6b7280;font-size:11px;">Place of Death</td>
              <td style="padding:8px 14px;font-weight:600;">${escapeHtml(placeOfDeath) || 'Not specified'}</td>
            </tr>
          </table>
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:14px;margin:0 0 16px;">
            <p style="font-weight:600;color:#374151;margin:0 0 10px;font-size:14px;">CAUSE OF DEATH</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0;width:100px;color:#6b7280;font-size:11px;vertical-align:top;">Immediate:</td>
                <td style="padding:6px 0;">${escapeHtml(immediateCause) || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6b7280;font-size:11px;vertical-align:top;">Antecedent:</td>
                <td style="padding:6px 0;">${escapeHtml(antecedentCause) || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6b7280;font-size:11px;vertical-align:top;">Underlying:</td>
                <td style="padding:6px 0;">${escapeHtml(underlyingCause) || 'Not specified'}</td>
              </tr>
            </table>
          </div>
          <div style="display:flex;gap:12px;margin:0 0 16px;">
            <div style="flex:1;padding:12px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;">
              <p style="margin:0 0 4px;color:#6b7280;font-size:11px;">Manner of Death</p>
              <p style="margin:0;font-weight:600;">${escapeHtml(mannerOfDeath)}</p>
            </div>
            <div style="flex:1;padding:12px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;">
              <p style="margin:0 0 4px;color:#6b7280;font-size:11px;">Autopsy</p>
              <p style="margin:0;font-weight:600;">${escapeHtml(autopsyStatus)}</p>
            </div>
          </div>
          ${contributingConditions ? `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px;margin:0 0 16px;"><p style="margin:0 0 6px;color:#6b7280;font-size:11px;">Contributing Conditions</p><p style="margin:0;">${escapeHtml(contributingConditions)}</p></div>` : ''}
          <div style="margin-top:40px;padding-top:20px;border-top:1px solid #ddd;">
            <p style="font-size:11px;color:#6b7280;margin:0 0 16px;">Certified by: ${escapeHtml(certifiedBy)}</p>
            <div style="display:flex;justify-content:space-between;align-items:flex-end;">
              <div><p style="font-size:12px;color:#666;margin:0;">Date: ${escapeHtml(new Date().toLocaleDateString())}</p></div>
              <div style="text-align:center;">
                <div style="width:200px;border-bottom:1px solid #333;margin-bottom:6px;">&nbsp;</div>
                <p style="font-size:13px;font-weight:bold;margin:0;">${escapeHtml(doctorDetails.name)}</p>
                ${doctorDetails.qualification ? `<p style="font-size:11px;color:#555;margin:2px 0 0;">${escapeHtml(doctorDetails.qualification)}</p>` : ''}
                ${doctorDetails.registrationNo ? `<p style="font-size:11px;color:#555;margin:2px 0 0;">Reg. No: ${escapeHtml(doctorDetails.registrationNo)}</p>` : ''}
              </div>
            </div>
          </div>
        </div>
        <div style="text-align:center;margin-top:32px;padding-top:12px;border-top:1px solid #eee;">
          <p style="font-size:10px;color:#999;margin:0;">This certificate is issued for official record and legal purposes.</p>
        </div>
      </div>`;
  };

  const handlePrint = () => {
    const html = buildCertificateHtml();
    printService.printDocument(html, { title: 'Death Certificate' });
    if (selectedPatientId) {
      const serial = `CERT-${new Date().getFullYear()}-DEATH-${Date.now().toString(36).toUpperCase().slice(-6)}`;
      const doctorName = user?.fullName || doctorDetails.name;
      const content = `[Death Certificate] Serial: ${serial} | Date of death: ${dateOfDeath}${timeOfDeath ? ` ${timeOfDeath}` : ''} | Place: ${placeOfDeath || 'Not specified'} | Immediate cause: ${immediateCause} | Underlying cause: ${underlyingCause} | Manner: ${mannerOfDeath} | Autopsy: ${autopsyStatus} | Certified by: ${certifiedBy} (${doctorName})`;
      patientsService
        .createNote(selectedPatientId, { type: 'administrative', content })
        .then(() => toast.success(`Death certificate saved (${serial})`))
        .catch(() => {/* best-effort: certificate already printed */});
    }
  };

  const handleSubmitToRegistry = () => {
    toast.success('Death certificate would be submitted to the registry.');
  };

  const getMannerColor = (manner: MannerOfDeath) => {
    switch (manner) {
      case 'Natural':
        return 'bg-gray-100 border-gray-400 text-gray-700';
      case 'Accident':
        return 'bg-yellow-50 border-yellow-400 text-yellow-700';
      case 'Suicide':
        return 'bg-orange-50 border-orange-400 text-orange-700';
      case 'Homicide':
        return 'bg-red-50 border-red-400 text-red-700';
      case 'Pending Investigation':
        return 'bg-purple-50 border-purple-400 text-purple-700';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skull className="w-6 h-6 text-gray-700" />
          <h1 className="text-xl font-semibold text-gray-900">Death Certificate</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? 'Edit' : 'Preview'}
          </button>
          <button
            onClick={handleSubmitToRegistry}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Send className="w-4 h-4" />
            Submit to Registry
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {!showPreview ? (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1 - Deceased Info */}
            <div className="space-y-6">
              {/* Patient Selector */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-gray-600" />
                  <h2 className="font-medium text-gray-900">Deceased Information</h2>
                </div>
                {isLoadingPatients ? (
                  <div className="flex items-center justify-center py-2.5">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                    <span className="ml-2 text-gray-500">Loading patients...</span>
                  </div>
                ) : (
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  >
                    <option value="">Select deceased patient...</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name} - {patient.patientId}
                      </option>
                    ))}
                  </select>
                )}
                {selectedPatient && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                    <p><span className="text-gray-500">DOB:</span> {selectedPatient.dateOfBirth}</p>
                    <p><span className="text-gray-500">Gender:</span> {selectedPatient.gender}</p>
                    <p><span className="text-gray-500">Age at death:</span> {calculateAge} years</p>
                  </div>
                )}
              </div>

              {/* Date and Time of Death */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  <h2 className="font-medium text-gray-900">Date & Time of Death</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={dateOfDeath}
                      onChange={(e) => setDateOfDeath(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="time"
                        value={timeOfDeath}
                        onChange={(e) => setTimeOfDeath(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Place of Death */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-gray-600" />
                  <h2 className="font-medium text-gray-900">Place of Death</h2>
                </div>
                <input
                  type="text"
                  value={placeOfDeath}
                  onChange={(e) => setPlaceOfDeath(e.target.value)}
                  placeholder="Hospital, Home, Other..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                />
              </div>
            </div>

            {/* Column 2 - Cause of Death */}
            <div className="space-y-6">
              {/* Cause of Death */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <h2 className="font-medium text-gray-900">Cause of Death</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Immediate Cause
                    </label>
                    <input
                      type="text"
                      value={immediateCause}
                      onChange={(e) => setImmediateCause(e.target.value)}
                      placeholder="Disease or condition directly leading to death"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Final disease or condition</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Antecedent Cause
                    </label>
                    <input
                      type="text"
                      value={antecedentCause}
                      onChange={(e) => setAntecedentCause(e.target.value)}
                      placeholder="Condition leading to immediate cause"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Due to or as a consequence of</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Underlying Cause
                    </label>
                    <input
                      type="text"
                      value={underlyingCause}
                      onChange={(e) => setUnderlyingCause(e.target.value)}
                      placeholder="Disease that initiated the chain of events"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Original cause</p>
                  </div>
                </div>
              </div>

              {/* Contributing Conditions */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="w-5 h-5 text-gray-600" />
                  <h2 className="font-medium text-gray-900">Contributing Conditions</h2>
                </div>
                <textarea
                  value={contributingConditions}
                  onChange={(e) => setContributingConditions(e.target.value)}
                  placeholder="Other significant conditions contributing to death..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 resize-none"
                />
              </div>
            </div>

            {/* Column 3 - Classification & Certification */}
            <div className="space-y-6">
              {/* Manner of Death */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-gray-600" />
                  <h2 className="font-medium text-gray-900">Manner of Death</h2>
                </div>
                <div className="space-y-2">
                  {mannerOfDeathOptions.map((manner) => (
                    <button
                      key={manner}
                      onClick={() => setMannerOfDeath(manner)}
                      className={`w-full px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left ${
                        mannerOfDeath === manner
                          ? getMannerColor(manner)
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {manner}
                    </button>
                  ))}
                </div>
              </div>

              {/* Autopsy Status */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <Stethoscope className="w-5 h-5 text-gray-600" />
                  <h2 className="font-medium text-gray-900">Autopsy</h2>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {autopsyOptions.map((status) => (
                    <button
                      key={status}
                      onClick={() => setAutopsyStatus(status)}
                      className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        autopsyStatus === status
                          ? 'bg-gray-100 border-gray-500 text-gray-800'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Certification */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-gray-600" />
                  <h2 className="font-medium text-gray-900">Certification</h2>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Certified By
                  </label>
                  <select
                    value={certifiedBy}
                    onChange={(e) => setCertifiedBy(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  >
                    <option>Attending Physician</option>
                    <option>Medical Examiner</option>
                    <option>Coroner</option>
                  </select>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                  <p className="font-medium text-gray-900">{doctorDetails.name}</p>
                  {doctorDetails.qualification && <p className="text-gray-700">{doctorDetails.qualification}</p>}
                  {doctorDetails.registrationNo && <p className="text-gray-700">Reg. No: {doctorDetails.registrationNo}</p>}
                  {!doctorDetails.qualification && !doctorDetails.registrationNo && (
                    <p className="text-gray-500 text-xs italic">Set your details on the Medical Certificate page</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Preview Mode */
          <div ref={certificateRef} className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg border overflow-hidden"
            dangerouslySetInnerHTML={{ __html: buildCertificateHtml() }}
          />
        )}
      </div>
    </div>
  );
}