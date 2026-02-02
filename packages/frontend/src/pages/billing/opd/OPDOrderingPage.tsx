import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart,
  Search,
  UserCircle,
  Trash2,
  Plus,
  Minus,
  Send,
  Stethoscope,
  TestTube,
  Scan,
  Syringe,
  Pill,
  AlertTriangle,
  Clock,
  CheckCircle,
  Package,
  Loader2,
} from 'lucide-react';
import { servicesService, type Service, type ServiceCategory } from '../../../services/services';
import { useAuthStore } from '../../../store/auth';

type ServiceCategoryType = 'consultation' | 'lab' | 'radiology' | 'procedures' | 'pharmacy';

interface OrderItem {
  item: Service;
  quantity: number;
  priority: 'normal' | 'urgent';
  notes?: string;
}

const categoryIcons: Record<string, React.ElementType> = {
  consultation: Stethoscope,
  lab: TestTube,
  radiology: Scan,
  procedures: Syringe,
  pharmacy: Pill,
};

// Helper component to render category icons
const CategoryIcon = ({ category, className = "w-4 h-4" }: { category: string; className?: string }) => {
  const Icon = categoryIcons[category] || Package;
  return <Icon className={className} />;
};

export default function OPDOrderingPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const facilityId = user?.facilityId || '';

  const [patientSearch, setPatientSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; mrn: string; fullName: string } | null>(null);
  const [activeCategory, setActiveCategory] = useState<ServiceCategoryType>('consultation');
  const [serviceSearch, setServiceSearch] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [cart, setCart] = useState<OrderItem[]>([]);

  // Patient search query
  const { data: patients = [] } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      const response = await fetch(`/api/v1/patients?search=${encodeURIComponent(searchTerm)}&limit=10`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('glide-hims-auth') ? JSON.parse(localStorage.getItem('glide-hims-auth') || '{}')?.state?.accessToken : ''}` }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.data || data || []).map((p: { id: string; mrn: string; fullName: string; firstName?: string; lastName?: string }) => ({
        id: p.id,
        mrn: p.mrn,
        fullName: p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim()
      }));
    },
    enabled: searchTerm.length >= 2,
  });

  // Recent orders - placeholder for now (would need orders API)
  const recentOrders: Array<{ id: string; status: string; patient: string; department: string; time: string }> = [];

  // Fetch services
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['services', facilityId],
    queryFn: () => servicesService.list({ facilityId }),
    enabled: !!facilityId,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['service-categories'],
    queryFn: () => servicesService.categories.list(),
  });

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesCategory = !activeCategory || (service.category?.name || '').toLowerCase().includes(activeCategory);
      const matchesSearch = service.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
        service.code.toLowerCase().includes(serviceSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [services, activeCategory, serviceSearch]);

  const quickOrderItems = useMemo(() => {
    return services.filter((s) => s.isPackage !== true).slice(0, 8);
  }, [services]);

  const categoryColors: Record<string, string> = {
    consultation: 'bg-blue-100 text-blue-700',
    lab: 'bg-green-100 text-green-700',
    radiology: 'bg-purple-100 text-purple-700',
    procedures: 'bg-orange-100 text-orange-700',
    pharmacy: 'bg-pink-100 text-pink-700',
  };

  const addToCart = (item: Service, priority: 'normal' | 'urgent' = 'normal') => {
    const existing = cart.find((c) => c.item.id === item.id);
    if (existing) {
      setCart(cart.map((c) => (c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { item, quantity: 1, priority }]);
    }
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter((c) => c.item.id !== itemId));
    } else {
      setCart(cart.map((c) => (c.item.id === itemId ? { ...c, quantity } : c)));
    }
  };

  const updatePriority = (itemId: string, priority: 'normal' | 'urgent') => {
    setCart(cart.map((c) => (c.item.id === itemId ? { ...c, priority } : c)));
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((c) => c.item.id !== itemId));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.item.basePrice * c.quantity, 0);

  const handleSendOrders = () => {
    // TODO: Implement order creation API call
    setCart([]);
    setShowSuccess(true);
    // Auto-hide success message after 2 seconds
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">OPD Ordering</h1>
            <p className="text-gray-500 text-sm">Create and track patient orders</p>
          </div>
        </div>
        {cart.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full">
            <ShoppingCart className="w-4 h-4" />
            <span className="font-semibold">{cart.length} items</span>
          </div>
        )}
      </div>

      {showSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Orders Sent!</h3>
            <p className="text-gray-500 text-sm">Orders have been sent to respective departments</p>
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0 overflow-hidden">
        {/* Left: Patient & Categories */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* Patient Selection */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-2">Patient</h2>
            {selectedPatient ? (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{selectedPatient.fullName}</p>
                      <p className="text-xs text-gray-500">
                        {selectedPatient.mrn} • {selectedPatient.age}y {selectedPatient.gender}
                      </p>
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

          {/* Categories */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-2">Categories</h2>
            <div className="space-y-1">
              {(['consultation', 'lab', 'radiology', 'procedures', 'pharmacy'] as ServiceCategory[]).map((cat) => {
                const Icon = categoryIcons[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeCategory === cat ? categoryColors[cat] : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="capitalize font-medium">{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Order Status */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold mb-2 flex-shrink-0">Recent Orders</h2>
            <div className="flex-1 overflow-y-auto space-y-2">
              {recentOrders.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm h-full">
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No recent orders</p>
                  </div>
                </div>
              ) : recentOrders.map((order) => (
                <div key={order.id} className="p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-gray-500">{order.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(order.status)}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{order.patient}</p>
                  <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                    <span>{order.department}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {order.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle: Services */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-4 flex flex-col min-h-0 overflow-hidden">
          {/* Quick Orders */}
          <div className="mb-4 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-2">Quick Order</h2>
            <div className="flex flex-wrap gap-2">
              {quickOrderItems.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border hover:shadow-sm transition-shadow ${categoryColors[item.category]}`}
                >
                  <CategoryIcon category={item.category} />
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          {/* Service List */}
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-sm font-semibold capitalize flex items-center gap-2">
              <span className={`p-1.5 rounded-lg ${categoryColors[activeCategory]}`}>
                <CategoryIcon category={activeCategory} />
              </span>
              {activeCategory} Services
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="pl-9 pr-4 py-1.5 border rounded-lg text-sm w-48"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="p-3 border rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{service.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{service.department}</p>
                      <p className="text-sm font-semibold text-blue-600 mt-1">UGX {service.price.toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => addToCart(service, 'normal')}
                        className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                        title="Add Normal"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => addToCart(service, 'urgent')}
                        className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                        title="Add Urgent"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Order Cart */}
        <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Order Cart
          </h2>

          {cart.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              <div className="text-center">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Cart is empty</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {cart.map((cartItem) => (
                  <div key={cartItem.item.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`p-1 rounded ${categoryColors[cartItem.item.category]}`}>
                            <CategoryIcon category={cartItem.item.category} />
                          </span>
                          <p className="text-sm font-medium text-gray-900">{cartItem.item.name}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{cartItem.item.department}</p>
                      </div>
                      <button onClick={() => removeFromCart(cartItem.item.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 border rounded-lg bg-white">
                        <button
                          onClick={() => updateQuantity(cartItem.item.id, cartItem.quantity - 1)}
                          className="p-1 hover:bg-gray-100 rounded-l-lg"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-3 text-sm font-medium">{cartItem.quantity}</span>
                        <button
                          onClick={() => updateQuantity(cartItem.item.id, cartItem.quantity + 1)}
                          className="p-1 hover:bg-gray-100 rounded-r-lg"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex gap-1">
                        <button
                          onClick={() => updatePriority(cartItem.item.id, 'normal')}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            cartItem.priority === 'normal' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          Normal
                        </button>
                        <button
                          onClick={() => updatePriority(cartItem.item.id, 'urgent')}
                          className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                            cartItem.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Urgent
                        </button>
                      </div>
                    </div>

                    <div className="text-right mt-2">
                      <span className="text-sm font-semibold text-blue-600">
                        UGX {(cartItem.item.price * cartItem.quantity).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cart Total */}
              <div className="border-t pt-3 flex-shrink-0">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Items</span>
                  <span>{cart.reduce((sum, c) => sum + c.quantity, 0)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-blue-600">UGX {cartTotal.toLocaleString()}</span>
                </div>

                <button
                  onClick={handleSendOrders}
                  disabled={!selectedPatient || cart.length === 0}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  Send to Departments
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
