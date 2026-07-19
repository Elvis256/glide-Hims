import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { servicesService, type ServicePackage, type Service } from '../../../services/services';
import { useAuthStore } from '../../../store/auth';
import api from '../../../services/api';

const categoryIcons: Record<string, React.ElementType> = {
  health_checkup: Activity,
  maternity: Baby,
  surgery: Stethoscope,
  wellness: Heart,
};

// Helper to render category icon
const CategoryIcon = ({ category, className = "w-4 h-4" }: { category: string; className?: string }) => {
  const Icon = categoryIcons[category] || Package;
  return <Icon className={className} />;
};

export default function PackageBillingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const facilityId = user?.facilityId || '';

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; mrn: string; fullName: string } | null>(null);
  const [customServices, setCustomServices] = useState<Array<{ id: string; name: string; price: number; included: boolean }>>([]);

  // Calculate custom total from selected services
  const customTotal = useMemo(() => {
    return customServices.filter(s => s.included).reduce((sum, s) => sum + s.price, 0);
  }, [customServices]);

  // Fetch packages
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['service-packages'],
    queryFn: () => servicesService.packages.list(),
  });

  // Fetch services for customization
  const { data: allServices = [] } = useQuery({
    queryKey: ['services', facilityId],
    queryFn: () => servicesService.list({ facilityId }),
    enabled: !!facilityId,
  });

  // Patient search for the apply modal
  const { data: applyPatients = [] } = useQuery({
    queryKey: ['package-patient-search', patientSearch],
    queryFn: async () => {
      const res = await api.get('/patients', { params: { search: patientSearch, limit: 5 } });
      const raw: any = res.data;
      return Array.isArray(raw) ? raw : raw?.data || [];
    },
    enabled: showApplyModal && patientSearch.length >= 2 && !selectedPatient,
  });

  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const matchesSearch = pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pkg.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || (pkg as any).category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [packages, searchQuery, activeCategory]);

  const summaryStats = useMemo(() => {
    return {
      total: packages.length,
      active: packages.filter((p) => p.isActive).length,
      totalValue: packages.reduce((sum, p) => sum + p.packagePrice, 0),
    };
  }, [packages]);

  const categoryColors: Record<string, string> = {
    health_checkup: 'bg-blue-100 text-blue-700',
    maternity: 'bg-pink-100 text-pink-700',
    surgery: 'bg-orange-100 text-orange-700',
    wellness: 'bg-green-100 text-green-700',
  };

  const openPackageDetails = (pkg: ServicePackage) => {
    setSelectedPackage(pkg);
  };

  const [applying, setApplying] = useState(false);

  // Bill the package as a single line at the package price (same pattern as
  // Emergency Billing) — the old flow was unreachable and sent fields the
  // backend DTO rejects.
  const handleApplyPackage = async () => {
    if (!selectedPackage || !selectedPatient) return;
    setApplying(true);
    try {
      const res: any = await api.post('/billing/invoices', {
        patientId: selectedPatient.id,
        paymentType: 'cash',
        items: [{
          serviceCode: 'PACKAGE',
          description: `Package: ${selectedPackage.name}`,
          chargeType: 'other',
          quantity: 1,
          unitPrice: Number(selectedPackage.packagePrice),
        }],
        notes: `Service package: ${selectedPackage.name}`,
      });
      const invNo = res.data?.invoiceNumber || res.data?.data?.invoiceNumber || '';
      toast.success(`Package billed for ${selectedPatient.fullName} — invoice ${invNo} payable at cashier`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowApplyModal(false);
      setSelectedPackage(null);
      setSelectedPatient(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to apply package');
    } finally {
      setApplying(false);
    }
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
          onClick={() => navigate('/admin/services/packages')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Settings className="w-4 h-4" />
          Manage Packages
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
        {/* Left: Summary & Search */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* Summary Stats */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-3">Package Summary</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{summaryStats.total}</p>
                <p className="text-xs text-gray-600">Total Packages</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{summaryStats.active}</p>
                <p className="text-xs text-gray-600">Active</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-2">Search Packages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search packages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Recent Activity Placeholder */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Recent Enrollments</h2>
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              <div className="text-center py-8">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No recent enrollments</p>
              </div>
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
              {Object.entries(categoryIcons).map(([cat]) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeCategory === cat ? categoryColors[cat] : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <CategoryIcon category={cat} />
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
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${categoryColors['health_checkup']}`}>
                  <Activity className="w-5 h-5" />
                  <span className="text-sm font-medium capitalize">Health Package</span>
                </div>
              </div>

              <div className="mb-4 flex-shrink-0">
                <h2 className="text-xl font-bold text-gray-900">{selectedPackage.name}</h2>
                <p className="text-gray-500 text-sm mt-1">{selectedPackage.description}</p>
                <div className="flex items-center gap-4 mt-3">
                  <div>
                    <span className="text-2xl font-bold text-blue-600">UGX {selectedPackage.packagePrice.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <h3 className="text-sm font-semibold mb-2 flex-shrink-0 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Package Services
              </h3>

              <div className="flex-1 overflow-y-auto border rounded-lg">
                {(selectedPackage.includedServices || []).map((item: any) => (
                  <div
                    key={item.id || item.serviceId}
                    className="flex items-center justify-between p-3 border-b last:border-b-0 bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded border flex items-center justify-center bg-blue-600 border-blue-600 text-white">
                        <Check className="w-3 h-3" />
                      </div>
                      <span className="text-sm text-gray-900">{item.service?.name || 'Service'}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {item.quantity}x @ UGX {(item.unitPrice || item.service?.basePrice || 0).toLocaleString()}
                    </span>
                  </div>
                )) || (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No services in this package
                  </div>
                )}
              </div>

              <div className="border-t pt-4 mt-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-sm text-gray-500">Total:</span>
                    <span className="text-xl font-bold text-blue-600 ml-2">UGX {selectedPackage.packagePrice.toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedPackage.includedServices?.length || 0} services included
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedPatient(null); setPatientSearch(''); setShowApplyModal(true); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  Apply Package to Patient
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border p-4 flex-1 min-h-0 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : filteredPackages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Package className="w-12 h-12 mb-2 opacity-50" />
                  <p className="font-medium text-gray-600">No packages found</p>
                  <p className="text-sm text-gray-400 mt-1 text-center">
                    Packages are created in the Administration module
                  </p>
                  <button
                    onClick={() => navigate('/admin/services/packages')}
                    className="mt-4 flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Go to Admin → Service Packages
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filteredPackages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="border rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer relative"
                      onClick={() => openPackageDetails(pkg)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`p-2 rounded-lg ${categoryColors['health_checkup']}`}>
                          <Activity className="w-5 h-5" />
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-600">UGX {pkg.packagePrice.toLocaleString()}</p>
                        </div>
                      </div>
                      <h3 className="font-bold text-gray-900">{pkg.name}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{pkg.description}</p>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <span className={`text-xs px-2 py-1 rounded-full ${pkg.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {pkg.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          {pkg.includedServices?.length || 0} services
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Apply Package Modal */}
      {showApplyModal && selectedPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Confirm Package Application</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <UserCircle className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-sm">{selectedPatient.fullName}</p>
                      <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} className="text-xs text-blue-600">Change</button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search patient by name or MRN..."
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    autoFocus
                  />
                  {applyPatients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow max-h-32 overflow-y-auto">
                      {applyPatients.map((p: any) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPatient({ id: p.id, mrn: p.mrn, fullName: p.fullName })}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          {p.fullName} <span className="text-gray-400">{p.mrn}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="font-medium text-gray-900">{selectedPackage.name}</p>
              <p className="text-sm text-gray-500 mt-1">
                {selectedPackage.includedServices?.length || 0} services included
              </p>
              <p className="text-lg font-bold text-blue-600 mt-2">UGX {Number(selectedPackage.packagePrice).toLocaleString()}</p>
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
                disabled={!selectedPatient || applying}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {applying ? 'Billing…' : 'Confirm & Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}