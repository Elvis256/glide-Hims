import React, { useState, useMemo } from 'react';
import {
  Calendar,
  User,
  Briefcase,
  FileText,
  Printer,
  Eye,
  Mail,
  Clock,
  AlertCircle,
  Building,
  Activity,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { patientsService } from '../../../services/patients';

interface Patient {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  patientId: string;
  currentDiagnosis?: string;
}

const doctorDetails = {
  name: 'Dr. Sarah Williams',
  qualification: 'MBBS, MD',
  registrationNo: 'MED-2024-1234',
  hospital: 'Glide Medical Center',
  contact: '+254 700 123 456',
};

export default function SickLeavePage() {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>('');
  const [natureOfIllness, setNatureOfIllness] = useState<string>('');
  const [employerName, setEmployerName] = useState<string>('');
  const [employerEmail, setEmployerEmail] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(false);

  const { data: patientsData, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients', 'sick-leave'],
    queryFn: () => patientsService.search({ limit: 100 }),
  });

  const patients: Patient[] = useMemo(() => {
    if (!patientsData?.data) return [];
    return patientsData.data.map((p) => ({
      id: p.id,
      name: p.fullName,
      dateOfBirth: p.dateOfBirth,
      gender: p.gender.charAt(0).toUpperCase() + p.gender.slice(1),
      patientId: p.mrn,
    }));
  }, [patientsData]);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const numberOfDays = useMemo(() => {
    if (!fromDate || !toDate) return 0;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  }, [fromDate, toDate]);

  const resumeDate = useMemo(() => {
    if (!toDate) return '';
    const date = new Date(toDate);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  }, [toDate]);

  // Auto-fill diagnosis when patient is selected
  React.useEffect(() => {
    if (selectedPatient?.currentDiagnosis) {
      setDiagnosis(selectedPatient.currentDiagnosis);
    }
  }, [selectedPatient]);

  const handlePrint = () => {
    window.print();
  };

  const handleEmailEmployer = () => {
    if (employerEmail) {
      alert(`Email would be sent to: ${employerEmail}`);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6 text-orange-600" />
          <h1 className="text-xl font-semibold text-gray-900">Sick Leave Certificate</h1>
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
            onClick={handleEmailEmployer}
            disabled={!employerEmail}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="w-4 h-4" />
            Email
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {!showPreview ? (
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Patient Selector */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-orange-600" />
                  <h2 className="font-medium text-gray-900">Patient Information</h2>
                </div>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  disabled={isLoadingPatients}
                >
                  <option value="">
                    {isLoadingPatients ? 'Loading patients...' : 'Select a patient...'}
                  </option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} - {patient.patientId}
                    </option>
                  ))}
                </select>
                {isLoadingPatients && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading patients...
                  </div>
                )}
                {selectedPatient && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                    <p><span className="text-gray-500">DOB:</span> {selectedPatient.dateOfBirth}</p>
                    <p><span className="text-gray-500">Gender:</span> {selectedPatient.gender}</p>
                  </div>
                )}
              </div>

              {/* Diagnosis */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-orange-600" />
                  <h2 className="font-medium text-gray-900">Diagnosis</h2>
                </div>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Enter diagnosis..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                {selectedPatient?.currentDiagnosis && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Linked from current encounter
                  </p>
                )}
              </div>

              {/* Nature of Illness */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-orange-600" />
                  <h2 className="font-medium text-gray-900">Nature of Illness</h2>
                </div>
                <textarea
                  value={natureOfIllness}
                  onChange={(e) => setNatureOfIllness(e.target.value)}
                  placeholder="Brief description of the illness..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Sick Leave Period */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-orange-600" />
                  <h2 className="font-medium text-gray-900">Sick Leave Period</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      min={fromDate}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
                <div className="mt-4 p-4 bg-orange-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800">Total Days</span>
                    </div>
                    <span className="text-2xl font-bold text-orange-600">{numberOfDays}</span>
                  </div>
                  {resumeDate && (
                    <p className="text-sm text-orange-700 mt-2">
                      Fit to resume on: <span className="font-medium">{resumeDate}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Employer Details */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <Building className="w-5 h-5 text-orange-600" />
                  <h2 className="font-medium text-gray-900">Employer Details (Optional)</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employer Name
                    </label>
                    <input
                      type="text"
                      value={employerName}
                      onChange={(e) => setEmployerName(e.target.value)}
                      placeholder="Company/Organization name..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employer Email
                    </label>
                    <input
                      type="email"
                      value={employerEmail}
                      onChange={(e) => setEmployerEmail(e.target.value)}
                      placeholder="hr@company.com"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Certifying Physician */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-orange-600" />
                  <h2 className="font-medium text-gray-900">Certifying Physician</h2>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg text-sm space-y-1">
                  <p className="font-medium text-orange-900">{doctorDetails.name}</p>
                  <p className="text-orange-700">{doctorDetails.qualification}</p>
                  <p className="text-orange-700">Reg. No: {doctorDetails.registrationNo}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Preview Mode */
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8 border">
            <div className="text-center border-b pb-6 mb-6">
              <h1 className="text-2xl font-bold text-gray-900">SICK LEAVE CERTIFICATE</h1>
              <p className="text-gray-600 mt-1">{doctorDetails.hospital}</p>
            </div>

            <div className="space-y-4 text-sm">
              <p>
                This is to certify that{' '}
                <span className="font-semibold">{selectedPatient?.name || '________________'}</span>{' '}
                (Patient ID: {selectedPatient?.patientId || '________'}) has been examined and found
                to be suffering from:
              </p>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium text-gray-700">Diagnosis: {diagnosis || 'Not specified'}</p>
                {natureOfIllness && (
                  <p className="text-gray-600 mt-2">{natureOfIllness}</p>
                )}
              </div>

              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-orange-800">
                  The patient is advised sick leave from{' '}
                  <span className="font-semibold">{fromDate}</span> to{' '}
                  <span className="font-semibold">{toDate || '________'}</span>
                  {numberOfDays > 0 && (
                    <span> ({numberOfDays} day{numberOfDays > 1 ? 's' : ''})</span>
                  )}
                </p>
                {resumeDate && (
                  <p className="text-orange-800 mt-2">
                    Fit to resume duties on: <span className="font-semibold">{resumeDate}</span>
                  </p>
                )}
              </div>

              {employerName && (
                <div className="p-4 border rounded-lg">
                  <p className="text-gray-600">
                    <span className="font-medium">Employer:</span> {employerName}
                  </p>
                </div>
              )}

              <div className="pt-8 mt-8 border-t flex justify-between items-end">
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
        )}
      </div>
    </div>
  );
}
