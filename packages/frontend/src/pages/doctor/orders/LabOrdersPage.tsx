import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FlaskConical,
  Search,
  User,
  Clock,
  AlertTriangle,
  CheckSquare,
  Square,
  FileText,
  DollarSign,
  Send,
  Info,
  Loader2,
} from 'lucide-react';
import { patientsService } from '../../../services/patients';

const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

interface Patient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gender: string;
}

interface LabTest {
  id: string;
  name: string;
  code: string;
  category: string;
  cost: number;
  turnaround: string;
  requiresFasting?: boolean;
}

const labTests: LabTest[] = [
  { id: '1', name: 'Complete Blood Count (CBC)', code: 'CBC', category: 'Hematology', cost: 25, turnaround: '2-4 hours' },
  { id: '2', name: 'Hemoglobin A1C', code: 'HBA1C', category: 'Hematology', cost: 35, turnaround: '24 hours', requiresFasting: true },
  { id: '3', name: 'Prothrombin Time (PT/INR)', code: 'PTINR', category: 'Hematology', cost: 30, turnaround: '2 hours' },
  { id: '4', name: 'Basic Metabolic Panel', code: 'BMP', category: 'Chemistry', cost: 45, turnaround: '4 hours', requiresFasting: true },
  { id: '5', name: 'Comprehensive Metabolic Panel', code: 'CMP', category: 'Chemistry', cost: 65, turnaround: '4 hours', requiresFasting: true },
  { id: '6', name: 'Lipid Panel', code: 'LIPID', category: 'Chemistry', cost: 40, turnaround: '4 hours', requiresFasting: true },
  { id: '7', name: 'Liver Function Tests', code: 'LFT', category: 'Chemistry', cost: 55, turnaround: '4 hours' },
  { id: '8', name: 'Thyroid Panel (TSH, T3, T4)', code: 'THYROID', category: 'Chemistry', cost: 75, turnaround: '24 hours' },
  { id: '9', name: 'Blood Culture', code: 'BCULT', category: 'Microbiology', cost: 85, turnaround: '48-72 hours' },
  { id: '10', name: 'Urine Culture', code: 'UCULT', category: 'Microbiology', cost: 60, turnaround: '48 hours' },
  { id: '11', name: 'Wound Culture', code: 'WCULT', category: 'Microbiology', cost: 70, turnaround: '48-72 hours' },
  { id: '12', name: 'Urinalysis', code: 'UA', category: 'Urinalysis', cost: 20, turnaround: '1 hour' },
  { id: '13', name: 'Urine Drug Screen', code: 'UDS', category: 'Urinalysis', cost: 45, turnaround: '2 hours' },
  { id: '14', name: '24-Hour Urine Collection', code: '24HR', category: 'Urinalysis', cost: 55, turnaround: '48 hours' },
  { id: '15', name: 'HIV Antibody Test', code: 'HIV', category: 'Serology', cost: 50, turnaround: '24 hours' },
  { id: '16', name: 'Hepatitis Panel', code: 'HEPPNL', category: 'Serology', cost: 120, turnaround: '24-48 hours' },
  { id: '17', name: 'Rheumatoid Factor', code: 'RF', category: 'Serology', cost: 40, turnaround: '24 hours' },
  { id: '18', name: 'ANA (Antinuclear Antibody)', code: 'ANA', category: 'Serology', cost: 65, turnaround: '48 hours' },
];

const categories = ['Hematology', 'Chemistry', 'Microbiology', 'Urinalysis', 'Serology'];
const priorities = ['Routine', 'Urgent', 'STAT'];

export default function LabOrdersPage() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Hematology');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [priority, setPriority] = useState('Routine');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [testSearch, setTestSearch] = useState('');

  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 10 }),
    enabled: patientSearch.length > 1,
  });
  const patients = patientsData?.data || [];

  const patientList: Patient[] = patients.map((p) => ({
    id: p.id,
    name: p.fullName,
    mrn: p.mrn,
    age: calculateAge(p.dateOfBirth),
    gender: p.gender.charAt(0).toUpperCase() + p.gender.slice(1),
  }));

  const filteredTests = useMemo(() => {
    return labTests.filter(
      (test) =>
        test.category === activeCategory &&
        (test.name.toLowerCase().includes(testSearch.toLowerCase()) ||
          test.code.toLowerCase().includes(testSearch.toLowerCase()))
    );
  }, [activeCategory, testSearch]);

  const selectedTestDetails = useMemo(() => {
    return labTests.filter((test) => selectedTests.includes(test.id));
  }, [selectedTests]);

  const totalCost = useMemo(() => {
    return selectedTestDetails.reduce((sum, test) => sum + test.cost, 0);
  }, [selectedTestDetails]);

  const requiresFasting = useMemo(() => {
    return selectedTestDetails.some((test) => test.requiresFasting);
  }, [selectedTestDetails]);

  const toggleTest = (testId: string) => {
    setSelectedTests((prev) =>
      prev.includes(testId) ? prev.filter((id) => id !== testId) : [...prev, testId]
    );
  };

  const handleSubmit = () => {
    if (!selectedPatient) {
      alert('Please select a patient');
      return;
    }
    if (selectedTests.length === 0) {
      alert('Please select at least one test');
      return;
    }
    alert(`Lab order submitted for ${selectedPatient.name}\nTests: ${selectedTestDetails.map((t) => t.code).join(', ')}\nPriority: ${priority}`);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FlaskConical className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Lab Orders</h1>
              <p className="text-sm text-gray-500">Order laboratory tests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedTests.length > 0 && (
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                {selectedTests.length} test{selectedTests.length > 1 ? 's' : ''} selected
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Test Selection */}
        <div className="flex-1 flex flex-col overflow-hidden border-r bg-white">
          {/* Patient Selector */}
          <div className="p-4 border-b">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or MRN..."
                value={selectedPatient ? selectedPatient.name : patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setSelectedPatient(null);
                  setShowPatientDropdown(true);
                }}
                onFocus={() => setShowPatientDropdown(true)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              {showPatientDropdown && !selectedPatient && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto">
                  {patientsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                    </div>
                  ) : patientList.length === 0 && patientSearch.length > 1 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">No patients found</div>
                  ) : (
                    patientList.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => {
                        setSelectedPatient(patient);
                        setShowPatientDropdown(false);
                        setPatientSearch('');
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span className="font-medium">{patient.name}</span>
                      <span className="text-sm text-gray-500">{patient.mrn}</span>
                    </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedPatient && (
              <div className="mt-2 text-sm text-gray-600">
                {selectedPatient.age}y {selectedPatient.gender} • {selectedPatient.mrn}
              </div>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex border-b overflow-x-auto">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeCategory === category
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Test Search */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tests..."
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Test List */}
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-2">
              {filteredTests.map((test) => (
                <button
                  key={test.id}
                  onClick={() => toggleTest(test.id)}
                  className={`w-full p-3 rounded-lg border text-left flex items-start gap-3 transition-colors ${
                    selectedTests.includes(test.id)
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {selectedTests.includes(test.id) ? (
                    <CheckSquare className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{test.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">{test.code}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {test.turnaround}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${test.cost}
                      </span>
                      {test.requiresFasting && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="w-3 h-3" />
                          Fasting
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Order Details */}
        <div className="w-96 flex flex-col overflow-hidden bg-gray-50">
          {/* Priority */}
          <div className="p-4 border-b bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <div className="flex gap-2">
              {priorities.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    priority === p
                      ? p === 'STAT'
                        ? 'bg-red-600 text-white'
                        : p === 'Urgent'
                        ? 'bg-amber-500 text-white'
                        : 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Clinical Indication */}
          <div className="p-4 border-b bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clinical Indication / Diagnosis
            </label>
            <textarea
              value={clinicalIndication}
              onChange={(e) => setClinicalIndication(e.target.value)}
              placeholder="Enter diagnosis or reason for testing..."
              rows={2}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
            />
          </div>

          {/* Special Instructions */}
          <div className="p-4 border-b bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">Special Instructions</label>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Timing, collection notes..."
              rows={2}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
            />
          </div>

          {/* Fasting Warning */}
          {requiresFasting && (
            <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Fasting Required</p>
                  <p className="text-xs text-amber-700 mt-1">
                    One or more selected tests require 8-12 hours fasting.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Selected Tests Summary */}
          <div className="flex-1 overflow-auto p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Selected Tests ({selectedTests.length})
            </h3>
            {selectedTestDetails.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tests selected</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedTestDetails.map((test) => (
                  <div key={test.id} className="p-2 bg-white rounded-lg border flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{test.code}</span>
                      <span className="text-xs text-gray-500 ml-2">{test.name}</span>
                    </div>
                    <span className="text-sm text-gray-600">${test.cost}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with Total and Submit */}
          <div className="p-4 border-t bg-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-600">Estimated Total</span>
              <span className="text-xl font-bold text-gray-900">${totalCost.toFixed(2)}</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!selectedPatient || selectedTests.length === 0}
              className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              Submit Order
            </button>
            <p className="text-xs text-gray-500 text-center mt-2 flex items-center justify-center gap-1">
              <Info className="w-3 h-3" />
              Order will be sent to laboratory
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
