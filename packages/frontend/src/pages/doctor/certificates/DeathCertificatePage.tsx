import { usePermissions } from '../../../components/PermissionGate';
import React, { useState, useMemo, useRef } from 'react';
import { toast } from 'sonner';
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
import { printContent } from '../../../lib/print';

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

const doctorDetails = {
  name: 'Dr. Sarah Williams',
  qualification: 'MBBS, MD',
  registrationNo: 'MED-2024-1234',
  hospital: 'Glide Medical Center',
  contact: '+254 700 123 456',
};

export default function DeathCertificatePage() {
  const { hasPermission } = usePermissions();
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

  const handlePrint = () => {
    if (certificateRef.current) {
      printContent(certificateRef.current.innerHTML, 'Death Certificate');
    } else {
      toast.error('Please switch to Preview mode before printing');
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
                  <p className="text-gray-700">{doctorDetails.qualification}</p>
                  <p className="text-gray-700">Reg. No: {doctorDetails.registrationNo}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Preview Mode */
          <div ref={certificateRef} className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8 border">
            <div className="text-center border-b pb-6 mb-6">
              <h1 className="text-2xl font-bold text-gray-900">CERTIFICATE OF DEATH</h1>
              <p className="text-gray-600 mt-1">{doctorDetails.hospital}</p>
            </div>

            <div className="space-y-5 text-sm">
              {/* Deceased Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-gray-500 text-xs">Name of Deceased</p>
                  <p className="font-semibold">{selectedPatient?.name || '________________'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Patient ID</p>
                  <p className="font-semibold">{selectedPatient?.patientId || '________'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Date of Birth</p>
                  <p className="font-semibold">{selectedPatient?.dateOfBirth || '________'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Age at Death</p>
                  <p className="font-semibold">{calculateAge !== null ? `${calculateAge} years` : '________'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Gender</p>
                  <p className="font-semibold">{selectedPatient?.gender || '________'}</p>
                </div>
              </div>

              {/* Death Details */}
              <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                <div>
                  <p className="text-gray-500 text-xs">Date of Death</p>
                  <p className="font-semibold">{dateOfDeath}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Time of Death</p>
                  <p className="font-semibold">{timeOfDeath || 'Not recorded'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 text-xs">Place of Death</p>
                  <p className="font-semibold">{placeOfDeath || 'Not specified'}</p>
                </div>
              </div>

              {/* Cause of Death */}
              <div className="p-4 border rounded-lg">
                <p className="font-medium text-gray-700 mb-3">CAUSE OF DEATH</p>
                <div className="space-y-3">
                  <div className="flex">
                    <span className="w-24 text-gray-500 text-xs">Immediate:</span>
                    <span className="flex-1">{immediateCause || 'Not specified'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-gray-500 text-xs">Antecedent:</span>
                    <span className="flex-1">{antecedentCause || 'Not specified'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-gray-500 text-xs">Underlying:</span>
                    <span className="flex-1">{underlyingCause || 'Not specified'}</span>
                  </div>
                </div>
              </div>

              {/* Manner and Contributing */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg border ${getMannerColor(mannerOfDeath)}`}>
                  <p className="text-xs opacity-75">Manner of Death</p>
                  <p className="font-semibold">{mannerOfDeath}</p>
                </div>
                <div className="p-4 rounded-lg border bg-gray-50">
                  <p className="text-xs text-gray-500">Autopsy</p>
                  <p className="font-semibold">{autopsyStatus}</p>
                </div>
              </div>

              {contributingConditions && (
                <div className="p-4 border rounded-lg">
                  <p className="text-gray-500 text-xs mb-2">Contributing Conditions</p>
                  <p>{contributingConditions}</p>
                </div>
              )}

              {/* Certification */}
              <div className="pt-8 mt-8 border-t">
                <p className="text-gray-500 text-xs mb-4">Certified by: {certifiedBy}</p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-gray-600">Date: {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <div className="w-48 border-b border-gray-400 mb-2"></div>
                    <p className="font-medium">{doctorDetails.name}</p>
                    <p className="text-gray-600 text-xs">{doctorDetails.qualification}</p>
                    <p className="text-gray-600 text-xs">Reg. No: {doctorDetails.registrationNo}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}