import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  User,
  Eye,
  Ear,
  Heart,
  Scale,
  Calendar,
  Printer,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileCheck,
  Loader2,
} from 'lucide-react';
import { patientsService } from '../../../services/patients';

interface Patient {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  patientId: string;
}

const fitnessTypes = [
  'Pre-employment',
  'Sports',
  'School',
  'Driving',
  'Swimming',
  'Aviation',
  'Military',
  'Other',
] as const;
type FitnessType = (typeof fitnessTypes)[number];

const conclusionOptions = ['Fit', 'Fit with restrictions', 'Unfit'] as const;
type Conclusion = (typeof conclusionOptions)[number];

const doctorDetails = {
  name: 'Dr. Sarah Williams',
  qualification: 'MBBS, MD',
  registrationNo: 'MED-2024-1234',
  hospital: 'Glide Medical Center',
  contact: '+254 700 123 456',
};

export default function FitnessCertificatePage() {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [patientSearch, setPatientSearch] = useState<string>('');

  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 50 }),
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
  const [fitnessType, setFitnessType] = useState<FitnessType>('Pre-employment');
  const [physicalFindings, setPhysicalFindings] = useState<string>('');
  const [visionLeft, setVisionLeft] = useState<string>('6/6');
  const [visionRight, setVisionRight] = useState<string>('6/6');
  const [visionCorrected, setVisionCorrected] = useState<boolean>(false);
  const [hearingLeft, setHearingLeft] = useState<string>('Normal');
  const [hearingRight, setHearingRight] = useState<string>('Normal');
  const [systolicBP, setSystolicBP] = useState<string>('120');
  const [diastolicBP, setDiastolicBP] = useState<string>('80');
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [conclusion, setConclusion] = useState<Conclusion>('Fit');
  const [restrictions, setRestrictions] = useState<string>('');
  const [validityMonths, setValidityMonths] = useState<string>('12');
  const [showPreview, setShowPreview] = useState<boolean>(false);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const bmi = useMemo(() => {
    const h = parseFloat(height) / 100;
    const w = parseFloat(weight);
    if (h > 0 && w > 0) {
      return (w / (h * h)).toFixed(1);
    }
    return null;
  }, [height, weight]);

  const bmiCategory = useMemo(() => {
    const bmiVal = parseFloat(bmi || '0');
    if (!bmiVal) return null;
    if (bmiVal < 18.5) return { label: 'Underweight', color: 'text-yellow-600' };
    if (bmiVal < 25) return { label: 'Normal', color: 'text-green-600' };
    if (bmiVal < 30) return { label: 'Overweight', color: 'text-orange-600' };
    return { label: 'Obese', color: 'text-red-600' };
  }, [bmi]);

  const validUntil = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + parseInt(validityMonths || '0'));
    return date.toISOString().split('T')[0];
  }, [validityMonths]);

  const handlePrint = () => {
    window.print();
  };

  const getConclusionIcon = (c: Conclusion) => {
    switch (c) {
      case 'Fit':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'Fit with restrictions':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'Unfit':
        return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getConclusionColor = (c: Conclusion) => {
    switch (c) {
      case 'Fit':
        return 'bg-green-50 border-green-500 text-green-700';
      case 'Fit with restrictions':
        return 'bg-yellow-50 border-yellow-500 text-yellow-700';
      case 'Unfit':
        return 'bg-red-50 border-red-500 text-red-700';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-green-600" />
          <h1 className="text-xl font-semibold text-gray-900">Fitness Certificate</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileCheck className="w-4 h-4" />
            {showPreview ? 'Edit' : 'Preview'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
            {/* Column 1 - Patient & Type */}
            <div className="space-y-6">
              {/* Patient Selector */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-green-600" />
                  <h2 className="font-medium text-gray-900">Patient</h2>
                </div>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search patients..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 mb-2"
                />
                <div className="relative">
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    disabled={patientsLoading}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                  >
                    <option value="">Select a patient...</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name} - {patient.patientId}
                      </option>
                    ))}
                  </select>
                  {patientsLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  )}
                </div>
                {selectedPatient && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                    <p><span className="text-gray-500">DOB:</span> {selectedPatient.dateOfBirth}</p>
                    <p><span className="text-gray-500">Gender:</span> {selectedPatient.gender}</p>
                  </div>
                )}
              </div>

              {/* Fitness Type */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <FileCheck className="w-5 h-5 text-green-600" />
                  <h2 className="font-medium text-gray-900">Certificate Type</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {fitnessTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setFitnessType(type)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        fitnessType === type
                          ? 'bg-green-50 border-green-500 text-green-700'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Physical Findings */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-green-600" />
                  <h2 className="font-medium text-gray-900">Physical Examination</h2>
                </div>
                <textarea
                  value={physicalFindings}
                  onChange={(e) => setPhysicalFindings(e.target.value)}
                  placeholder="General physical examination findings..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                />
              </div>
            </div>

            {/* Column 2 - Tests */}
            <div className="space-y-6">
              {/* Vision Test */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="w-5 h-5 text-green-600" />
                  <h2 className="font-medium text-gray-900">Vision Test</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Left Eye</label>
                    <input
                      type="text"
                      value={visionLeft}
                      onChange={(e) => setVisionLeft(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Right Eye</label>
                    <input
                      type="text"
                      value={visionRight}
                      onChange={(e) => setVisionRight(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 mt-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={visionCorrected}
                    onChange={(e) => setVisionCorrected(e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  With corrective lenses
                </label>
              </div>

              {/* Hearing Test */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <Ear className="w-5 h-5 text-green-600" />
                  <h2 className="font-medium text-gray-900">Hearing Test</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Left Ear</label>
                    <select
                      value={hearingLeft}
                      onChange={(e) => setHearingLeft(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option>Normal</option>
                      <option>Mild Loss</option>
                      <option>Moderate Loss</option>
                      <option>Severe Loss</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Right Ear</label>
                    <select
                      value={hearingRight}
                      onChange={(e) => setHearingRight(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option>Normal</option>
                      <option>Mild Loss</option>
                      <option>Moderate Loss</option>
                      <option>Severe Loss</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Vitals */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <Heart className="w-5 h-5 text-green-600" />
                  <h2 className="font-medium text-gray-900">Blood Pressure</h2>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={systolicBP}
                    onChange={(e) => setSystolicBP(e.target.value)}
                    className="w-20 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center"
                    placeholder="120"
                  />
                  <span className="text-gray-500">/</span>
                  <input
                    type="number"
                    value={diastolicBP}
                    onChange={(e) => setDiastolicBP(e.target.value)}
                    className="w-20 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center"
                    placeholder="80"
                  />
                  <span className="text-gray-500">mmHg</span>
                </div>
              </div>

              {/* BMI */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <Scale className="w-5 h-5 text-green-600" />
                  <h2 className="font-medium text-gray-900">BMI Calculation</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="170"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="70"
                    />
                  </div>
                </div>
                {bmi && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-gray-600">BMI:</span>
                    <div className="text-right">
                      <span className="text-lg font-semibold">{bmi}</span>
                      {bmiCategory && (
                        <span className={`ml-2 text-sm ${bmiCategory.color}`}>
                          ({bmiCategory.label})
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Column 3 - Conclusion */}
            <div className="space-y-6">
              {/* Conclusion */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h2 className="font-medium text-gray-900">Conclusion</h2>
                </div>
                <div className="space-y-2">
                  {conclusionOptions.map((c) => (
                    <button
                      key={c}
                      onClick={() => setConclusion(c)}
                      className={`w-full px-4 py-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-3 ${
                        conclusion === c
                          ? getConclusionColor(c)
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {getConclusionIcon(c)}
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Restrictions */}
              {conclusion === 'Fit with restrictions' && (
                <div className="bg-white rounded-xl p-5 shadow-sm border">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <h2 className="font-medium text-gray-900">Restrictions</h2>
                  </div>
                  <textarea
                    value={restrictions}
                    onChange={(e) => setRestrictions(e.target.value)}
                    placeholder="Specify restrictions..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none"
                  />
                </div>
              )}

              {/* Validity */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-green-600" />
                  <h2 className="font-medium text-gray-900">Validity Period</h2>
                </div>
                <select
                  value={validityMonths}
                  onChange={(e) => setValidityMonths(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                  <option value="24">24 months</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">Valid until: {validUntil}</p>
              </div>

              {/* Doctor Info */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-green-600" />
                  <h2 className="font-medium text-gray-900">Certifying Physician</h2>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-sm space-y-1">
                  <p className="font-medium text-green-900">{doctorDetails.name}</p>
                  <p className="text-green-700">{doctorDetails.qualification}</p>
                  <p className="text-green-700">Reg. No: {doctorDetails.registrationNo}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Preview Mode */
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8 border">
            <div className="text-center border-b pb-6 mb-6">
              <h1 className="text-2xl font-bold text-gray-900">FITNESS CERTIFICATE</h1>
              <p className="text-gray-600 mt-1">{doctorDetails.hospital}</p>
              <p className="text-sm text-gray-500 mt-1">Type: {fitnessType}</p>
            </div>

            <div className="space-y-4 text-sm">
              <p>
                This is to certify that{' '}
                <span className="font-semibold">{selectedPatient?.name || '________________'}</span>,{' '}
                {selectedPatient?.gender || 'Gender'}, Date of Birth:{' '}
                {selectedPatient?.dateOfBirth || '________________'}, has been examined.
              </p>

              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-700">Vision</p>
                  <p className="text-gray-600">
                    L: {visionLeft}, R: {visionRight}
                    {visionCorrected && ' (corrected)'}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Hearing</p>
                  <p className="text-gray-600">L: {hearingLeft}, R: {hearingRight}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Blood Pressure</p>
                  <p className="text-gray-600">{systolicBP}/{diastolicBP} mmHg</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">BMI</p>
                  <p className="text-gray-600">
                    {bmi || 'N/A'} {bmiCategory && `(${bmiCategory.label})`}
                  </p>
                </div>
              </div>

              {physicalFindings && (
                <div>
                  <p className="font-medium text-gray-700 mb-2">Physical Examination:</p>
                  <p className="text-gray-600">{physicalFindings}</p>
                </div>
              )}

              <div className={`p-4 rounded-lg border-2 ${getConclusionColor(conclusion)}`}>
                <div className="flex items-center gap-2">
                  {getConclusionIcon(conclusion)}
                  <span className="font-semibold text-lg">{conclusion}</span>
                </div>
                {conclusion === 'Fit with restrictions' && restrictions && (
                  <p className="mt-2 text-sm">{restrictions}</p>
                )}
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-green-800">
                  <span className="font-medium">Valid until:</span> {validUntil}
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
