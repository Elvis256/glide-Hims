import { useState, useMemo } from 'react';
import {
  Package,
  Search,
  UserCircle,
  Plus,
  Minus,
  Check,
  X,
  Edit3,
  Eye,
  Trash2,
  Heart,
  Baby,
  Stethoscope,
  Activity,
  Calendar,
  Clock,
  CheckCircle,
  ChevronRight,
  Settings,
} from 'lucide-react';

interface Patient {
  id: string;
  mrn: string;
  fullName: string;
  phone: string;
}

const mockPatients: Patient[] = [
  { id: '1', mrn: 'MRN-2024-0001', fullName: 'Sarah Nakimera', phone: '+256 700 123 456' },
  { id: '2', mrn: 'MRN-2024-0002', fullName: 'James Okello', phone: '+256 755 987 654' },
  { id: '3', mrn: 'MRN-2024-0003', fullName: 'Grace Atim', phone: '+256 780 456 789' },
  { id: '4', mrn: 'MRN-2024-0004', fullName: 'Peter Wasswa', phone: '+256 701 234 567' },
];

interface PackageService {
  id: string;
  name: string;
  price: number;
  included: boolean;
}

interface HealthPackage {
  id: string;
  name: string;
  description: string;
  category: 'health_checkup' | 'maternity' | 'surgery' | 'wellness';
  price: number;
  originalPrice: number;
  validity: string;
  services: PackageService[];
  popular?: boolean;
}

const healthPackages: HealthPackage[] = [
  {
    id: 'pkg1',
    name: 'Executive Health Checkup',
    description: 'Comprehensive health screening for executives and professionals',
    category: 'health_checkup',
    price: 850000,
    originalPrice: 1200000,
    validity: '1 year',
    popular: true,
    services: [
      { id: 's1', name: 'Complete Blood Count', price: 45000, included: true },
      { id: 's2', name: 'Liver Function Test', price: 85000, included: true },
      { id: 's3', name: 'Renal Function Test', price: 75000, included: true },
      { id: 's4', name: 'Lipid Profile', price: 65000, included: true },
      { id: 's5', name: 'Blood Sugar (Fasting)', price: 15000, included: true },
      { id: 's6', name: 'Chest X-Ray', price: 120000, included: true },
      { id: 's7', name: 'ECG', price: 80000, included: true },
      { id: 's8', name: 'Abdominal Ultrasound', price: 180000, included: true },
      { id: 's9', name: 'Consultation', price: 50000, included: true },
      { id: 's10', name: 'Eye Examination', price: 40000, included: true },
    ],
  },
  {
    id: 'pkg2',
    name: 'Basic Health Checkup',
    description: 'Essential health screening package',
    category: 'health_checkup',
    price: 350000,
    originalPrice: 450000,
    validity: '1 year',
    services: [
      { id: 's1', name: 'Complete Blood Count', price: 45000, included: true },
      { id: 's2', name: 'Blood Sugar', price: 15000, included: true },
      { id: 's3', name: 'Urinalysis', price: 20000, included: true },
      { id: 's4', name: 'Consultation', price: 50000, included: true },
      { id: 's5', name: 'Blood Pressure Check', price: 5000, included: true },
    ],
  },
  {
    id: 'pkg3',
    name: 'Maternity Package - Normal',
    description: 'Complete care for normal delivery',
    category: 'maternity',
    price: 2500000,
    originalPrice: 3200000,
    validity: '9 months',
    popular: true,
    services: [
      { id: 's1', name: 'Antenatal Visits (8)', price: 400000, included: true },
      { id: 's2', name: 'Ultrasound Scans (3)', price: 450000, included: true },
      { id: 's3', name: 'Lab Tests Package', price: 350000, included: true },
      { id: 's4', name: 'Normal Delivery', price: 800000, included: true },
      { id: 's5', name: 'Hospital Stay (2 nights)', price: 400000, included: true },
      { id: 's6', name: 'Newborn Care', price: 200000, included: true },
    ],
  },
  {
    id: 'pkg4',
    name: 'Maternity Package - C-Section',
    description: 'Complete care for cesarean delivery',
    category: 'maternity',
    price: 4500000,
    originalPrice: 5500000,
    validity: '9 months',
    services: [
      { id: 's1', name: 'Antenatal Visits (8)', price: 400000, included: true },
      { id: 's2', name: 'Ultrasound Scans (4)', price: 600000, included: true },
      { id: 's3', name: 'Lab Tests Package', price: 450000, included: true },
      { id: 's4', name: 'C-Section Surgery', price: 2000000, included: true },
      { id: 's5', name: 'Hospital Stay (4 nights)', price: 800000, included: true },
      { id: 's6', name: 'Newborn Care', price: 250000, included: true },
    ],
  },
  {
    id: 'pkg5',
    name: 'Minor Surgery Package',
    description: 'Day-case minor surgical procedures',
    category: 'surgery',
    price: 1200000,
    originalPrice: 1500000,
    validity: '6 months',
    services: [
      { id: 's1', name: 'Pre-operative Assessment', price: 150000, included: true },
      { id: 's2', name: 'Lab Tests', price: 200000, included: true },
      { id: 's3', name: 'Surgery (Minor)', price: 500000, included: true },
      { id: 's4', name: 'Anesthesia', price: 200000, included: true },
      { id: 's5', name: 'Post-op Care', price: 150000, included: true },
    ],
  },
  {
    id: 'pkg6',
    name: 'Wellness Package',
    description: 'Preventive care and wellness program',
    category: 'wellness',
    price: 500000,
    originalPrice: 650000,
    validity: '1 year',
    services: [
      { id: 's1', name: 'Health Consultation (4)', price: 200000, included: true },
      { id: 's2', name: 'Nutritionist Sessions (2)', price: 100000, included: true },
      { id: 's3', name: 'Basic Lab Tests', price: 100000, included: true },
      { id: 's4', name: 'Fitness Assessment', price: 50000, included: true },
      { id: 's5', name: 'Vaccination Update', price: 50000, included: true },
    ],
  },
];

interface PatientPackage {
  id: string;
  patient: string;
  package: string;
  enrolledDate: string;
  expiryDate: string;
  usedServices: number;
  totalServices: number;
  status: 'active' | 'expired' | 'completed';
}

const patientPackages: PatientPackage[] = [
  { id: '1', patient: 'Sarah Nakimera', package: 'Maternity Package - Normal', enrolledDate: '2024-01-15', expiryDate: '2024-10-15', usedServices: 5, totalServices: 6, status: 'active' },
  { id: '2', patient: 'James Okello', package: 'Executive Health Checkup', enrolledDate: '2024-02-01', expiryDate: '2025-02-01', usedServices: 10, totalServices: 10, status: 'completed' },
  { id: '3', patient: 'Grace Atim', package: 'Basic Health Checkup', enrolledDate: '2023-06-01', expiryDate: '2024-06-01', usedServices: 3, totalServices: 5, status: 'expired' },
];

const categoryIcons: Record<string, React.ReactNode> = {
  health_checkup: <Activity className="w-5 h-5" />,
  maternity: <Baby className="w-5 h-5" />,
  surgery: <Stethoscope className="w-5 h-5" />,
  wellness: <Heart className="w-5 h-5" />,
};

const categoryColors: Record<string, string> = {
  health_checkup: 'bg-blue-100 text-blue-700',
  maternity: 'bg-pink-100 text-pink-700',
  surgery: 'bg-orange-100 text-orange-700',
  wellness: 'bg-green-100 text-green-700',
};

export default function PackageBillingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedPackage, setSelectedPackage] = useState<HealthPackage | null>(null);
  const [customServices, setCustomServices] = useState<PackageService[]>([]);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);

  const patients = useMemo(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    return mockPatients.filter(
      (p) => p.fullName.toLowerCase().includes(term) || p.mrn.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const filteredPackages = useMemo(() => {
    if (activeCategory === 'all') return healthPackages;
    return healthPackages.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const openPackageDetails = (pkg: HealthPackage) => {
    setSelectedPackage(pkg);
    setCustomServices([...pkg.services]);
  };

  const toggleService = (serviceId: string) => {
    setCustomServices(
      customServices.map((s) => (s.id === serviceId ? { ...s, included: !s.included } : s))
    );
  };

  const customTotal = useMemo(() => {
    return customServices.filter((s) => s.included).reduce((sum, s) => sum + s.price, 0);
  }, [customServices]);

  const handleApplyPackage = () => {
    if (!selectedPatient || !selectedPackage) return;
    setShowApplyModal(false);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setSelectedPackage(null);
    }, 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'completed':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Package Billing</h1>
            <p className="text-gray-500 text-sm">Manage health packages and subscriptions</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateTemplate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create Package
        </button>
      </div>

      {showSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Package Applied!</h3>
            <p className="text-gray-500 text-sm">Package has been assigned to patient</p>
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Left: Patient & Tracking */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* Patient Selection */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-2">Select Patient</h2>
            {selectedPatient ? (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{selectedPatient.fullName}</p>
                      <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} className="text-xs text-blue-600">
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search patient..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                    autoFocus
                  />
                </div>
                {patients.length > 0 && (
                  <div className="border rounded-lg mt-2 max-h-32 overflow-y-auto">
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => {
                          setSelectedPatient(patient);
                          setSearchTerm('');
                        }}
                        className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left"
                      >
                        <UserCircle className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{patient.fullName}</p>
                          <p className="text-xs text-gray-500">{patient.mrn}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Package Usage Tracking */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Active Packages</h2>
            <div className="flex-1 overflow-y-auto space-y-3">
              {patientPackages.map((pp) => (
                <div key={pp.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getStatusColor(pp.status)}`}>
                      {pp.status}
                    </span>
                    <button className="text-blue-600 hover:bg-blue-50 p-1 rounded">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="font-medium text-gray-900 text-sm">{pp.patient}</p>
                  <p className="text-xs text-gray-500 mt-1">{pp.package}</p>
                  
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Usage</span>
                      <span>{pp.usedServices}/{pp.totalServices} services</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pp.status === 'completed' ? 'bg-blue-500' : 'bg-green-500'}`}
                        style={{ width: `${(pp.usedServices / pp.totalServices) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {pp.enrolledDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Expires: {pp.expiryDate}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle: Package List */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* Category Filter */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex-shrink-0">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All Packages
              </button>
              {Object.entries(categoryIcons).map(([cat, icon]) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeCategory === cat ? categoryColors[cat] : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {icon}
                  <span className="capitalize">{cat.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Package Cards */}
          {selectedPackage ? (
            <div className="bg-white rounded-xl shadow-sm border p-4 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <button
                  onClick={() => setSelectedPackage(null)}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                  <X className="w-4 h-4" />
                  Back to Packages
                </button>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${categoryColors[selectedPackage.category]}`}>
                  {categoryIcons[selectedPackage.category]}
                  <span className="text-sm font-medium capitalize">{selectedPackage.category.replace('_', ' ')}</span>
                </div>
              </div>

              <div className="mb-4 flex-shrink-0">
                <h2 className="text-xl font-bold text-gray-900">{selectedPackage.name}</h2>
                <p className="text-gray-500 text-sm mt-1">{selectedPackage.description}</p>
                <div className="flex items-center gap-4 mt-3">
                  <div>
                    <span className="text-2xl font-bold text-blue-600">UGX {selectedPackage.price.toLocaleString()}</span>
                    <span className="text-sm text-gray-400 line-through ml-2">
                      UGX {selectedPackage.originalPrice.toLocaleString()}
                    </span>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    Save {Math.round(((selectedPackage.originalPrice - selectedPackage.price) / selectedPackage.originalPrice) * 100)}%
                  </span>
                  <span className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    Valid: {selectedPackage.validity}
                  </span>
                </div>
              </div>

              <h3 className="text-sm font-semibold mb-2 flex-shrink-0 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Customize Package Services
              </h3>

              <div className="flex-1 overflow-y-auto border rounded-lg">
                {customServices.map((service) => (
                  <div
                    key={service.id}
                    className={`flex items-center justify-between p-3 border-b last:border-b-0 ${
                      service.included ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleService(service.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center ${
                          service.included ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'
                        }`}
                      >
                        {service.included && <Check className="w-3 h-3" />}
                      </button>
                      <span className={`text-sm ${service.included ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                        {service.name}
                      </span>
                    </div>
                    <span className={`text-sm font-medium ${service.included ? 'text-gray-900' : 'text-gray-400'}`}>
                      UGX {service.price.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 mt-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-sm text-gray-500">Customized Total:</span>
                    <span className="text-xl font-bold text-blue-600 ml-2">UGX {customTotal.toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {customServices.filter((s) => s.included).length} of {customServices.length} services selected
                  </div>
                </div>
                <button
                  onClick={() => setShowApplyModal(true)}
                  disabled={!selectedPatient}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Apply Package to Patient
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border p-4 flex-1 min-h-0 overflow-y-auto">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="border rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer relative"
                    onClick={() => openPackageDetails(pkg)}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                        Popular
                      </span>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2 rounded-lg ${categoryColors[pkg.category]}`}>
                        {categoryIcons[pkg.category]}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600">UGX {pkg.price.toLocaleString()}</p>
                        <p className="text-xs text-gray-400 line-through">
                          UGX {pkg.originalPrice.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-900">{pkg.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-4 h-4" />
                        {pkg.validity}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        {pkg.services.length} services
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Apply Package Modal */}
      {showApplyModal && selectedPackage && selectedPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Confirm Package Application</h3>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{selectedPatient.fullName}</p>
                  <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="font-medium text-gray-900">{selectedPackage.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {customServices.filter((s) => s.included).length} services included
                </p>
                <p className="text-lg font-bold text-blue-600 mt-2">UGX {customTotal.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowApplyModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyPackage}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Package Template Modal */}
      {showCreateTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Create New Package Template</h3>
              <button onClick={() => setShowCreateTemplate(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Package Name</label>
                <input
                  type="text"
                  placeholder="e.g., Premium Health Checkup"
                  className="w-full px-4 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select className="w-full px-4 py-2 border rounded-lg text-sm">
                  <option value="health_checkup">Health Checkup</option>
                  <option value="maternity">Maternity</option>
                  <option value="surgery">Surgery</option>
                  <option value="wellness">Wellness</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (UGX)</label>
                  <input type="number" placeholder="0" className="w-full px-4 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Validity</label>
                  <input type="text" placeholder="e.g., 1 year" className="w-full px-4 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  placeholder="Package description..."
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg text-sm resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateTemplate(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCreateTemplate(false);
                  alert('Package template created!');
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Package
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}