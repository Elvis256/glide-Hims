import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Edit2,
  Package,
  Calendar,
  Tag,
  ChevronDown,
  ChevronUp,
  Check,
  ToggleLeft,
  ToggleRight,
  Clock,
  Percent,
  Users,
  Loader2,
} from 'lucide-react';
import { servicesService, type ServicePackage as APIPackage } from '../../../services';

interface PackageService {
  name: string;
  originalPrice: number;
}

interface ServicePackage {
  id: string;
  name: string;
  description: string;
  category: string;
  services: PackageService[];
  packagePrice: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  usageCount: number;
}

const mockPackages: ServicePackage[] = [
  {
    id: '1',
    name: 'Executive Health Checkup',
    description: 'Comprehensive health screening for executives',
    category: 'Health Checkup',
    services: [
      { name: 'General Consultation', originalPrice: 500 },
      { name: 'Complete Blood Count', originalPrice: 350 },
      { name: 'Lipid Profile', originalPrice: 800 },
      { name: 'Liver Function Test', originalPrice: 600 },
      { name: 'Kidney Function Test', originalPrice: 550 },
      { name: 'Chest X-Ray', originalPrice: 600 },
      { name: 'ECG', originalPrice: 400 },
    ],
    packagePrice: 2999,
    validFrom: '2024-01-01',
    validTo: '2024-12-31',
    isActive: true,
    usageCount: 156,
  },
  {
    id: '2',
    name: 'Maternity Package - Normal',
    description: 'Complete normal delivery package',
    category: 'Maternity',
    services: [
      { name: 'Antenatal Visits (4)', originalPrice: 2000 },
      { name: 'Normal Delivery', originalPrice: 15000 },
      { name: 'Postnatal Care', originalPrice: 1500 },
      { name: 'Baby Immunization', originalPrice: 500 },
    ],
    packagePrice: 16500,
    validFrom: '2024-01-01',
    validTo: '2024-12-31',
    isActive: true,
    usageCount: 89,
  },
  {
    id: '3',
    name: 'Maternity Package - C-Section',
    description: 'Complete caesarean section package',
    category: 'Maternity',
    services: [
      { name: 'Antenatal Visits (4)', originalPrice: 2000 },
      { name: 'C-Section Delivery', originalPrice: 45000 },
      { name: 'Theatre Charges', originalPrice: 10000 },
      { name: 'Postnatal Care (5 days)', originalPrice: 7500 },
      { name: 'Baby Immunization', originalPrice: 500 },
    ],
    packagePrice: 55000,
    validFrom: '2024-01-01',
    validTo: '2024-12-31',
    isActive: true,
    usageCount: 45,
  },
  {
    id: '4',
    name: 'Diabetic Care Package',
    description: 'Quarterly diabetic monitoring and care',
    category: 'Chronic Care',
    services: [
      { name: 'Diabetologist Consultation', originalPrice: 1500 },
      { name: 'HbA1c Test', originalPrice: 1200 },
      { name: 'Fasting Blood Sugar', originalPrice: 200 },
      { name: 'Kidney Function Test', originalPrice: 550 },
      { name: 'Eye Examination', originalPrice: 800 },
    ],
    packagePrice: 3500,
    validFrom: '2024-01-01',
    validTo: '2024-06-30',
    isActive: true,
    usageCount: 234,
  },
  {
    id: '5',
    name: 'Basic Surgery Package',
    description: 'Minor surgical procedures package',
    category: 'Surgery',
    services: [
      { name: 'Surgeon Consultation', originalPrice: 1500 },
      { name: 'Theatre Charges', originalPrice: 5000 },
      { name: 'Anesthesia', originalPrice: 3000 },
      { name: 'Ward (1 day)', originalPrice: 2000 },
    ],
    packagePrice: 9999,
    validFrom: '2023-06-01',
    validTo: '2024-01-31',
    isActive: false,
    usageCount: 67,
  },
];

const categories = ['All', 'Health Checkup', 'Maternity', 'Chronic Care', 'Surgery'];

export default function ServicePackagesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch packages from API
  const { data: apiPackages, isLoading } = useQuery({
    queryKey: ['service-packages'],
    queryFn: () => servicesService.packages.list(),
    staleTime: 60000,
  });

  // Transform API data with fallback
  const packages: ServicePackage[] = useMemo(() => {
    if (!apiPackages) return [];
    return apiPackages.map((p: APIPackage) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      category: 'General',
      services: p.includedServices?.map(s => ({
        name: s.service?.name || `Service ${s.serviceId}`,
        originalPrice: s.service?.basePrice || 0,
      })) || [],
      packagePrice: p.packagePrice,
      validFrom: p.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
      validTo: new Date(Date.now() + (p.validDays || 365) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: p.isActive,
      usageCount: 0,
    }));
  }, [apiPackages]);

  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      const matchesSearch = pkg.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || pkg.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [packages, searchTerm, selectedCategory]);

  const togglePackageStatus = (id: string) => {
    // Would need toggle mutation - for now just log
    console.log('Toggle package:', id);
  };

  const stats = useMemo(() => ({
    total: packages.length,
    active: packages.filter(p => p.isActive).length,
    totalUsage: packages.reduce((sum, p) => sum + p.usageCount, 0),
  }), [packages]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Packages</h1>
            <p className="text-sm text-gray-500">Bundle services into attractive packages</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Create Package
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Packages</div>
              <div className="text-xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Active Packages</div>
              <div className="text-xl font-bold text-green-600">{stats.active}</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Usage</div>
              <div className="text-xl font-bold text-purple-600">{stats.totalUsage}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search packages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm ${
                  selectedCategory === cat
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Packages List */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          {filteredPackages.map(pkg => {
            const totalOriginal = pkg.services.reduce((sum, s) => sum + s.originalPrice, 0);
            const savings = totalOriginal - pkg.packagePrice;
            const savingsPercent = Math.round((savings / totalOriginal) * 100);
            const isExpanded = expandedId === pkg.id;

            return (
              <div key={pkg.id} className="bg-white rounded-lg border overflow-hidden">
                {/* Package Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${pkg.isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <Package className={`w-5 h-5 ${pkg.isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            pkg.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {pkg.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{pkg.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {pkg.category}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {pkg.validFrom} - {pkg.validTo}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {pkg.usageCount} uses
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        KES {pkg.packagePrice.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-400 line-through">
                        KES {totalOriginal.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <Percent className="w-3 h-3" />
                        Save {savingsPercent}%
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : pkg.id)}
                      className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {pkg.services.length} services included
                    </button>
                    <div className="flex items-center gap-2">
                      <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => togglePackageStatus(pkg.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg ${
                          pkg.isActive
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {pkg.isActive ? (
                          <>
                            <ToggleRight className="w-4 h-4" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4" />
                            Activate
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Services */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {pkg.services.map((service, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                          <span className="text-sm text-gray-700">{service.name}</span>
                          <span className="text-sm text-gray-500">KES {service.originalPrice.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end mt-3 pt-3 border-t">
                      <div className="text-sm">
                        <span className="text-gray-500">Total if purchased separately: </span>
                        <span className="font-medium">KES {totalOriginal.toLocaleString()}</span>
                        <span className="text-green-600 ml-2">(You save KES {savings.toLocaleString()})</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
