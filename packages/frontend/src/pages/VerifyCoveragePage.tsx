import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ShieldCheck,
  UserCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface Patient {
  id: string;
  mrn: string;
  fullName: string;
  insuranceProvider: string;
  policyNumber: string;
  status: string;
  expiryDate: string;
}

// Empty patient data - to be populated from API
const mockPatients: Patient[] = [];

interface VerificationResult {
  status: 'verified' | 'expired' | 'invalid' | 'pending';
  provider: string;
  policyNumber: string;
  memberName: string;
  coverageType: string;
  coverageLimit: number;
  usedAmount: number;
  expiryDate: string;
  copay: number;
  coveredServices: string[];
  exclusions: string[];
}

export default function VerifyCoveragePage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const patients = useMemo(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    return mockPatients.filter(
      (p) => p.fullName.toLowerCase().includes(term) || p.mrn.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const handleVerify = () => {
    setVerifying(true);
    // Simulate API call
    setTimeout(() => {
      setVerificationResult({
        status: selectedPatient?.status === 'active' ? 'verified' : 'expired',
        provider: selectedPatient?.insuranceProvider || '',
        policyNumber: selectedPatient?.policyNumber || '',
        memberName: selectedPatient?.fullName || '',
        coverageType: 'Comprehensive',
        coverageLimit: 5000000,
        usedAmount: 1250000,
        expiryDate: selectedPatient?.expiryDate || '',
        copay: 10,
        coveredServices: ['Outpatient', 'Inpatient', 'Maternity', 'Dental', 'Optical'],
        exclusions: ['Cosmetic Surgery', 'Pre-existing conditions (6mo waiting)'],
      });
      setVerifying(false);
    }, 1500);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'expired': return <XCircle className="w-6 h-6 text-red-600" />;
      case 'invalid': return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      default: return <Clock className="w-6 h-6 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-50 border-green-200 text-green-700';
      case 'expired': return 'bg-red-50 border-red-200 text-red-700';
      case 'invalid': return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      default: return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Verify Coverage</h1>
            <p className="text-gray-500 text-sm">Check patient insurance eligibility</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 overflow-hidden">
        {/* Left: Patient Selection */}
        <div className="card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Select Patient</h2>
          
          {selectedPatient ? (
            <div className="bg-blue-50 rounded-lg p-4 mb-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedPatient.fullName}</p>
                    <p className="text-sm text-gray-500">{selectedPatient.mrn}</p>
                  </div>
                </div>
                <button onClick={() => { setSelectedPatient(null); setVerificationResult(null); }} className="text-xs text-blue-600 hover:underline">
                  Change
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Provider</p>
                  <p className="font-medium">{selectedPatient.insuranceProvider}</p>
                </div>
                <div>
                  <p className="text-gray-500">Policy #</p>
                  <p className="font-mono font-medium">{selectedPatient.policyNumber}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="relative mb-3 flex-shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or MRN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-9 py-2"
                  autoFocus
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => { setSelectedPatient(patient); setSearchTerm(''); }}
                    className="w-full flex items-center gap-3 p-3 rounded hover:bg-gray-50 text-left"
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{patient.fullName}</p>
                      <p className="text-sm text-gray-500">{patient.mrn}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      patient.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {patient.status}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {selectedPatient && !verificationResult && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="btn-primary mt-4 flex items-center justify-center gap-2"
            >
              {verifying ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Verify Coverage
                </>
              )}
            </button>
          )}
        </div>

        {/* Right: Verification Result */}
        <div className="card p-4 flex flex-col min-h-0">
          {!verificationResult ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select a patient and verify their coverage</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Status Badge */}
              <div className={`flex items-center gap-3 p-4 rounded-lg border mb-4 ${getStatusColor(verificationResult.status)}`}>
                {getStatusIcon(verificationResult.status)}
                <div>
                  <p className="font-semibold capitalize">{verificationResult.status}</p>
                  <p className="text-sm">
                    {verificationResult.status === 'verified'
                      ? 'Patient is eligible for coverage'
                      : 'Coverage has expired'}
                  </p>
                </div>
              </div>

              {/* Coverage Details */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Policy Information</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Provider</p>
                      <p className="font-medium">{verificationResult.provider}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Policy Number</p>
                      <p className="font-mono font-medium">{verificationResult.policyNumber}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Coverage Type</p>
                      <p className="font-medium">{verificationResult.coverageType}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Expiry Date</p>
                      <p className="font-medium">{verificationResult.expiryDate}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Coverage Limits</h3>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Used</span>
                      <span>UGX {verificationResult.usedAmount.toLocaleString()} / {verificationResult.coverageLimit.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(verificationResult.usedAmount / verificationResult.coverageLimit) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Available: UGX {(verificationResult.coverageLimit - verificationResult.usedAmount).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Co-pay</h3>
                  <p className="text-lg font-bold text-blue-600">{verificationResult.copay}%</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Covered Services</h3>
                  <div className="flex flex-wrap gap-1">
                    {verificationResult.coveredServices.map((service) => (
                      <span key={service} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Exclusions</h3>
                  <div className="space-y-1">
                    {verificationResult.exclusions.map((exclusion) => (
                      <p key={exclusion} className="text-sm text-gray-600 flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-400" />
                        {exclusion}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
