import { usePermissions } from '../../../components/PermissionGate';
import React, { useState, useMemo, useRef } from 'react';
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
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { patientsService } from '../../../services/patients';
import { printContent } from '../../../lib/print';

interface Patient {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  patientId: string;
}

const certificatePurposes = ['Fitness', 'Illness', 'Follow-up', 'Other'] as const;
type CertificatePurpose = (typeof certificatePurposes)[number];

const doctorDetails = {
  name: 'Dr. Sarah Williams',
  qualification: 'MBBS, MD',
  registrationNo: 'MED-2024-1234',
  hospital: 'Glide Medical Center',
  contact: '+254 700 123 456',
};

export default function MedicalCertificatePage() {
  const { hasPermission } = usePermissions();
  const certificateRef = useRef<HTMLDivElement>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [purpose, setPurpose] = useState<CertificatePurpose>('Fitness');
  const [examinationDate, setExaminationDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [findings, setFindings] = useState<string>('');
  const [recommendations, setRecommendations] = useState<string>('');
  const [validityPeriod, setValidityPeriod] = useState<string>('30');
  const [showPreview, setShowPreview] = useState<boolean>(false);

  const { data: patientsResponse, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients', 'certificates'],
    queryFn: () => patientsService.search({ limit: 100 }),
  });

  const patients: Patient[] = useMemo(() => {
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

  const validUntil = useMemo(() => {
    const date = new Date(examinationDate);
    date.setDate(date.getDate() + parseInt(validityPeriod || '0'));
    return date.toISOString().split('T')[0];
  }, [examinationDate, validityPeriod]);

  const handlePrint = () => {
    if (certificateRef.current) {
      printContent(certificateRef.current.innerHTML, 'Medical Certificate');
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Medical Certificate</h1>
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
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
            {/* Left Column - Form */}
            <div className="space-y-6">
              {/* Patient Selector */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-blue-600" />
                  <h2 className="font-medium text-gray-900">Patient Information</h2>
                </div>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <div className="mt-4 flex items-center justify-center text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    <span className="text-sm">Loading patients...</span>
                  </div>
                )}
                {selectedPatient && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                    <p><span className="text-gray-500">DOB:</span> {selectedPatient.dateOfBirth}</p>
                    <p><span className="text-gray-500">Gender:</span> {selectedPatient.gender}</p>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Certificate Purpose
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {certificatePurposes.map((p) => (
                        <button
                          key={p}
                          onClick={() => setPurpose(p)}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            purpose === p
                              ? 'bg-blue-50 border-blue-500 text-blue-700'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Examination
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Validity Period (days)
                    </label>
                    <input
                      type="number"
                      value={validityPeriod}
                      onChange={(e) => setValidityPeriod(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                      max="365"
                    />
                    <p className="text-xs text-gray-500 mt-1">Valid until: {validUntil}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Findings */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <Stethoscope className="w-5 h-5 text-blue-600" />
                  <h2 className="font-medium text-gray-900">Medical Findings</h2>
                </div>
                <textarea
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="Enter examination findings..."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Recommendations */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <h2 className="font-medium text-gray-900">Recommendations</h2>
                </div>
                <textarea
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  placeholder="Enter recommendations..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Doctor's Details */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <h2 className="font-medium text-gray-900">Certifying Physician</h2>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-sm space-y-1">
                  <p className="font-medium text-blue-900">{doctorDetails.name}</p>
                  <p className="text-blue-700">{doctorDetails.qualification}</p>
                  <p className="text-blue-700">Reg. No: {doctorDetails.registrationNo}</p>
                  <p className="text-blue-700">{doctorDetails.hospital}</p>
                </div>
                <div className="mt-4 p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                  <PenTool className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Digital Signature Placeholder</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Preview Mode */
          <div ref={certificateRef} className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8 border">
            <div className="text-center border-b pb-6 mb-6">
              <h1 className="text-2xl font-bold text-gray-900">MEDICAL CERTIFICATE</h1>
              <p className="text-gray-600 mt-1">{doctorDetails.hospital}</p>
            </div>

            <div className="space-y-4 text-sm">
              <p>
                This is to certify that{' '}
                <span className="font-semibold">{selectedPatient?.name || '________________'}</span>,{' '}
                {selectedPatient?.gender || 'Gender'}, Date of Birth:{' '}
                {selectedPatient?.dateOfBirth || '________________'}, was examined on{' '}
                <span className="font-semibold">{examinationDate}</span>.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium text-gray-700">Purpose: {purpose}</p>
              </div>

              <div>
                <p className="font-medium text-gray-700 mb-2">Findings:</p>
                <p className="text-gray-600">{findings || 'No findings recorded.'}</p>
              </div>

              <div>
                <p className="font-medium text-gray-700 mb-2">Recommendations:</p>
                <p className="text-gray-600">{recommendations || 'No recommendations.'}</p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800">
                  <span className="font-medium">Valid from:</span> {examinationDate}{' '}
                  <span className="font-medium">to:</span> {validUntil}
                </p>
              </div>

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
