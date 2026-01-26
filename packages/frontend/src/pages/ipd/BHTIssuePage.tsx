import { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Printer,
  User,
  Calendar,
  Bed,
  Stethoscope,
  ClipboardList,
  Activity,
  Pill,
  AlertCircle,
  Download,
  Eye,
  CheckCircle,
} from 'lucide-react';

interface Patient {
  id: string;
  bhtNumber: string;
  name: string;
  age: number;
  gender: string;
  idNumber: string;
  phone: string;
  address: string;
  nextOfKin: string;
  nextOfKinPhone: string;
}

interface Admission {
  id: string;
  patient: Patient;
  admissionDate: string;
  admissionTime: string;
  admissionType: 'Emergency' | 'Elective' | 'Transfer';
  ward: string;
  bed: string;
  attendingDoctor: string;
  diagnosis: string;
  treatmentPlan: string[];
  allergies: string[];
  specialInstructions: string;
  bhtIssued: boolean;
}

const mockAdmissions: Admission[] = [
  {
    id: 'ADM001',
    patient: {
      id: 'P001',
      bhtNumber: 'BHT-2024-001',
      name: 'John Mwangi',
      age: 45,
      gender: 'Male',
      idNumber: '12345678',
      phone: '0712345678',
      address: '123 Kenyatta Avenue, Nairobi',
      nextOfKin: 'Mary Mwangi',
      nextOfKinPhone: '0723456789',
    },
    admissionDate: '2024-01-15',
    admissionTime: '08:30',
    admissionType: 'Emergency',
    ward: 'General Ward A',
    bed: 'A-102',
    attendingDoctor: 'Dr. Sarah Kimani',
    diagnosis: 'Acute Appendicitis',
    treatmentPlan: [
      'NPO (Nothing by mouth)',
      'IV fluids - Normal Saline 1L 8 hourly',
      'IV Antibiotics - Ceftriaxone 1g BD',
      'Pain management - Paracetamol 1g QID',
      'Prepare for appendectomy',
    ],
    allergies: ['Penicillin', 'Sulfa drugs'],
    specialInstructions: 'Monitor vital signs every 2 hours. Prepare for emergency surgery.',
    bhtIssued: false,
  },
  {
    id: 'ADM002',
    patient: {
      id: 'P002',
      bhtNumber: 'BHT-2024-002',
      name: 'Mary Wanjiku',
      age: 32,
      gender: 'Female',
      idNumber: '23456789',
      phone: '0723456789',
      address: '456 Moi Avenue, Mombasa',
      nextOfKin: 'Peter Wanjiku',
      nextOfKinPhone: '0734567890',
    },
    admissionDate: '2024-01-14',
    admissionTime: '14:00',
    admissionType: 'Elective',
    ward: 'Maternity Ward',
    bed: 'MAT-01',
    attendingDoctor: 'Dr. James Otieno',
    diagnosis: 'Term pregnancy, scheduled C-section',
    treatmentPlan: [
      'Pre-operative preparation',
      'Blood group and crossmatch',
      'Pre-op antibiotics',
      'Fasting from midnight',
    ],
    allergies: [],
    specialInstructions: 'C-section scheduled for 2024-01-16 at 08:00',
    bhtIssued: true,
  },
  {
    id: 'ADM003',
    patient: {
      id: 'P003',
      bhtNumber: 'BHT-2024-003',
      name: 'Peter Ochieng',
      age: 58,
      gender: 'Male',
      idNumber: '34567890',
      phone: '0734567890',
      address: '789 Oginga Odinga Street, Kisumu',
      nextOfKin: 'Jane Ochieng',
      nextOfKinPhone: '0745678901',
    },
    admissionDate: '2024-01-13',
    admissionTime: '10:15',
    admissionType: 'Transfer',
    ward: 'ICU',
    bed: 'ICU-01',
    attendingDoctor: 'Dr. Anne Mutua',
    diagnosis: 'Cardiac arrest, post-resuscitation care',
    treatmentPlan: [
      'Continuous cardiac monitoring',
      'Ventilator support',
      'IV Inotropes as needed',
      'Cardiology consultation',
      'Neurological assessment',
    ],
    allergies: ['Aspirin'],
    specialInstructions: 'Critical care. Family has been counselled. DNR not signed.',
    bhtIssued: true,
  },
];

export default function BHTIssuePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const filteredAdmissions = useMemo(() => {
    return mockAdmissions.filter(
      (adm) =>
        adm.patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adm.patient.bhtNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adm.patient.idNumber.includes(searchTerm)
    );
  }, [searchTerm]);

  const pendingBHTs = mockAdmissions.filter((a) => !a.bhtIssued).length;
  const issuedBHTs = mockAdmissions.filter((a) => a.bhtIssued).length;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <FileText className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bed Head Ticket (BHT)</h1>
            <p className="text-sm text-gray-500">Generate and manage BHT documents</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <span className="text-yellow-700 font-medium">{pendingBHTs} Pending</span>
          </div>
          <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
            <span className="text-green-700 font-medium">{issuedBHTs} Issued</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Admissions List */}
        <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or BHT number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-3">
              {filteredAdmissions.map((admission) => (
                <div
                  key={admission.id}
                  onClick={() => {
                    setSelectedAdmission(admission);
                    setShowPreview(false);
                  }}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedAdmission?.id === admission.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{admission.patient.name}</p>
                      <p className="text-sm text-indigo-600">{admission.patient.bhtNumber}</p>
                    </div>
                    {admission.bhtIssued ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Issued
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                        Pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Bed className="w-4 h-4" />
                      {admission.bed}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {admission.admissionDate}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BHT Details/Preview */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {selectedAdmission ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPreview(false)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      !showPreview ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <ClipboardList className="w-4 h-4 inline mr-2" />
                    Details
                  </button>
                  <button
                    onClick={() => setShowPreview(true)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      showPreview ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Eye className="w-4 h-4 inline mr-2" />
                    Preview
                  </button>
                </div>
                <div className="flex gap-2">
                  {!selectedAdmission.bhtIssued && (
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                      <FileText className="w-4 h-4 inline mr-2" />
                      Issue BHT
                    </button>
                  )}
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Download className="w-4 h-4 inline mr-2" />
                    Download
                  </button>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Printer className="w-4 h-4 inline mr-2" />
                    Print
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6">
                {!showPreview ? (
                  <div className="grid grid-cols-2 gap-6">
                    {/* Patient Information */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-600" />
                        Patient Information
                      </h3>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Full Name</p>
                            <p className="font-medium">{selectedAdmission.patient.name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">BHT Number</p>
                            <p className="font-medium text-indigo-600">{selectedAdmission.patient.bhtNumber}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Age</p>
                            <p className="font-medium">{selectedAdmission.patient.age} years</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Gender</p>
                            <p className="font-medium">{selectedAdmission.patient.gender}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">ID Number</p>
                            <p className="font-medium">{selectedAdmission.patient.idNumber}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Address</p>
                          <p className="font-medium">{selectedAdmission.patient.address}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Phone</p>
                            <p className="font-medium">{selectedAdmission.patient.phone}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Next of Kin</p>
                            <p className="font-medium">{selectedAdmission.patient.nextOfKin}</p>
                            <p className="text-sm text-gray-500">{selectedAdmission.patient.nextOfKinPhone}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Admission Information */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Bed className="w-5 h-5 text-indigo-600" />
                        Admission Information
                      </h3>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Admission Date</p>
                            <p className="font-medium">{selectedAdmission.admissionDate}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Admission Time</p>
                            <p className="font-medium">{selectedAdmission.admissionTime}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Admission Type</p>
                            <p className="font-medium">{selectedAdmission.admissionType}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Ward / Bed</p>
                            <p className="font-medium">{selectedAdmission.ward} - {selectedAdmission.bed}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Attending Doctor</p>
                          <p className="font-medium flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-gray-500" />
                            {selectedAdmission.attendingDoctor}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Diagnosis</p>
                          <p className="font-medium">{selectedAdmission.diagnosis}</p>
                        </div>
                      </div>
                    </div>

                    {/* Treatment Plan */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-600" />
                        Treatment Plan
                      </h3>
                      <ul className="space-y-2">
                        {selectedAdmission.treatmentPlan.map((item, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                              {index + 1}
                            </span>
                            <span className="text-gray-700">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Allergies & Instructions */}
                    <div className="space-y-4">
                      <div className="bg-red-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          Allergies
                        </h3>
                        {selectedAdmission.allergies.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedAdmission.allergies.map((allergy, index) => (
                              <span
                                key={index}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium"
                              >
                                {allergy}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">No known allergies</p>
                        )}
                      </div>

                      <div className="bg-yellow-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Pill className="w-5 h-5 text-yellow-600" />
                          Special Instructions
                        </h3>
                        <p className="text-gray-700">{selectedAdmission.specialInstructions}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* BHT Preview - Print Format */
                  <div className="max-w-3xl mx-auto bg-white border-2 border-gray-300 p-8">
                    {/* Header */}
                    <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
                      <h1 className="text-2xl font-bold text-gray-900">GLIDE HOSPITAL</h1>
                      <p className="text-sm text-gray-600">P.O. Box 12345, Nairobi, Kenya</p>
                      <p className="text-sm text-gray-600">Tel: +254 20 123 4567</p>
                      <h2 className="text-xl font-bold text-gray-900 mt-4 underline">BED HEAD TICKET</h2>
                    </div>

                    {/* BHT Number */}
                    <div className="flex justify-between mb-6">
                      <div>
                        <span className="font-bold">BHT No:</span>{' '}
                        <span className="text-lg font-mono">{selectedAdmission.patient.bhtNumber}</span>
                      </div>
                      <div>
                        <span className="font-bold">Date:</span> {selectedAdmission.admissionDate}
                      </div>
                    </div>

                    {/* Patient Details */}
                    <div className="border border-gray-400 p-4 mb-4">
                      <h3 className="font-bold border-b border-gray-400 pb-2 mb-3">PATIENT DETAILS</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="font-bold">Name:</span> {selectedAdmission.patient.name}</div>
                        <div><span className="font-bold">ID No:</span> {selectedAdmission.patient.idNumber}</div>
                        <div><span className="font-bold">Age:</span> {selectedAdmission.patient.age} years</div>
                        <div><span className="font-bold">Gender:</span> {selectedAdmission.patient.gender}</div>
                        <div className="col-span-2"><span className="font-bold">Address:</span> {selectedAdmission.patient.address}</div>
                        <div><span className="font-bold">Phone:</span> {selectedAdmission.patient.phone}</div>
                        <div><span className="font-bold">Next of Kin:</span> {selectedAdmission.patient.nextOfKin} ({selectedAdmission.patient.nextOfKinPhone})</div>
                      </div>
                    </div>

                    {/* Admission Details */}
                    <div className="border border-gray-400 p-4 mb-4">
                      <h3 className="font-bold border-b border-gray-400 pb-2 mb-3">ADMISSION DETAILS</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="font-bold">Ward:</span> {selectedAdmission.ward}</div>
                        <div><span className="font-bold">Bed:</span> {selectedAdmission.bed}</div>
                        <div><span className="font-bold">Admission Type:</span> {selectedAdmission.admissionType}</div>
                        <div><span className="font-bold">Time:</span> {selectedAdmission.admissionTime}</div>
                        <div className="col-span-2"><span className="font-bold">Attending Doctor:</span> {selectedAdmission.attendingDoctor}</div>
                        <div className="col-span-2"><span className="font-bold">Diagnosis:</span> {selectedAdmission.diagnosis}</div>
                      </div>
                    </div>

                    {/* Allergies */}
                    <div className="border border-gray-400 p-4 mb-4 bg-red-50">
                      <h3 className="font-bold text-red-700">⚠️ ALLERGIES:</h3>
                      <p className="text-red-700 font-medium">
                        {selectedAdmission.allergies.length > 0
                          ? selectedAdmission.allergies.join(', ')
                          : 'NKDA (No Known Drug Allergies)'}
                      </p>
                    </div>

                    {/* Treatment Plan */}
                    <div className="border border-gray-400 p-4 mb-4">
                      <h3 className="font-bold border-b border-gray-400 pb-2 mb-3">TREATMENT PLAN</h3>
                      <ol className="list-decimal list-inside text-sm space-y-1">
                        {selectedAdmission.treatmentPlan.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ol>
                    </div>

                    {/* Special Instructions */}
                    <div className="border border-gray-400 p-4 mb-6">
                      <h3 className="font-bold border-b border-gray-400 pb-2 mb-3">SPECIAL INSTRUCTIONS</h3>
                      <p className="text-sm">{selectedAdmission.specialInstructions}</p>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-3 gap-8 mt-8 pt-4">
                      <div className="text-center">
                        <div className="border-b border-gray-400 mb-1 h-8"></div>
                        <p className="text-sm">Admitting Officer</p>
                      </div>
                      <div className="text-center">
                        <div className="border-b border-gray-400 mb-1 h-8"></div>
                        <p className="text-sm">Attending Doctor</p>
                      </div>
                      <div className="text-center">
                        <div className="border-b border-gray-400 mb-1 h-8"></div>
                        <p className="text-sm">Nurse In-Charge</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <FileText className="w-16 h-16 text-gray-300 mb-4" />
              <p className="font-medium text-lg">Select an admission</p>
              <p className="text-sm">Choose a patient from the list to view or generate BHT</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
