import React, { useState, useMemo } from 'react';
import {
  Search,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Calendar,
  Package,
  Building2,
  Check,
  ArrowUpDown,
  Filter,
  Download,
  RefreshCw,
  Award,
  Percent,
} from 'lucide-react';

interface PriceItem {
  id: string;
  productName: string;
  genericName: string;
  category: string;
  unit: string;
  suppliers: SupplierPrice[];
  bestPrice: number;
  bestPriceSupplier: string;
  lastUpdated: string;
}

interface SupplierPrice {
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  volumeDiscounts: VolumeDiscount[];
  lastUpdated: string;
  isBestPrice: boolean;
}

interface VolumeDiscount {
  minQuantity: number;
  discount: number;
  priceAfterDiscount: number;
}

const mockPriceList: PriceItem[] = [
  {
    id: 'MED001',
    productName: 'Amoxicillin 500mg',
    genericName: 'Amoxicillin',
    category: 'Antibiotics',
    unit: 'Box (100 caps)',
    suppliers: [
      {
        supplierId: 'SUP001',
        supplierName: 'PharmaCorp Kenya',
        unitPrice: 1500,
        volumeDiscounts: [
          { minQuantity: 10, discount: 5, priceAfterDiscount: 1425 },
          { minQuantity: 50, discount: 10, priceAfterDiscount: 1350 },
          { minQuantity: 100, discount: 15, priceAfterDiscount: 1275 },
        ],
        lastUpdated: '2024-01-15',
        isBestPrice: true,
      },
      {
        supplierId: 'SUP002',
        supplierName: 'MediSupply Ltd',
        unitPrice: 1650,
        volumeDiscounts: [
          { minQuantity: 20, discount: 8, priceAfterDiscount: 1518 },
          { minQuantity: 100, discount: 12, priceAfterDiscount: 1452 },
        ],
        lastUpdated: '2024-01-10',
        isBestPrice: false,
      },
      {
        supplierId: 'SUP003',
        supplierName: 'HealthCare Distributors',
        unitPrice: 1580,
        volumeDiscounts: [
          { minQuantity: 25, discount: 7, priceAfterDiscount: 1469 },
        ],
        lastUpdated: '2024-01-08',
        isBestPrice: false,
      },
    ],
    bestPrice: 1275,
    bestPriceSupplier: 'PharmaCorp Kenya',
    lastUpdated: '2024-01-15',
  },
  {
    id: 'MED002',
    productName: 'Paracetamol 1g',
    genericName: 'Acetaminophen',
    category: 'Analgesics',
    unit: 'Box (500 tabs)',
    suppliers: [
      {
        supplierId: 'SUP001',
        supplierName: 'PharmaCorp Kenya',
        unitPrice: 800,
        volumeDiscounts: [
          { minQuantity: 20, discount: 10, priceAfterDiscount: 720 },
        ],
        lastUpdated: '2024-01-12',
        isBestPrice: false,
      },
      {
        supplierId: 'SUP002',
        supplierName: 'MediSupply Ltd',
        unitPrice: 750,
        volumeDiscounts: [
          { minQuantity: 10, discount: 5, priceAfterDiscount: 712.5 },
          { minQuantity: 50, discount: 12, priceAfterDiscount: 660 },
        ],
        lastUpdated: '2024-01-18',
        isBestPrice: true,
      },
    ],
    bestPrice: 660,
    bestPriceSupplier: 'MediSupply Ltd',
    lastUpdated: '2024-01-18',
  },
  {
    id: 'MED003',
    productName: 'Metformin 500mg',
    genericName: 'Metformin HCl',
    category: 'Diabetes',
    unit: 'Box (100 tabs)',
    suppliers: [
      {
        supplierId: 'SUP001',
        supplierName: 'PharmaCorp Kenya',
        unitPrice: 1200,
        volumeDiscounts: [
          { minQuantity: 10, discount: 8, priceAfterDiscount: 1104 },
        ],
        lastUpdated: '2024-01-14',
        isBestPrice: true,
      },
      {
        supplierId: 'SUP004',
        supplierName: 'Global Pharma EA',
        unitPrice: 1350,
        volumeDiscounts: [
          { minQuantity: 20, discount: 10, priceAfterDiscount: 1215 },
        ],
        lastUpdated: '2024-01-10',
        isBestPrice: false,
      },
    ],
    bestPrice: 1104,
    bestPriceSupplier: 'PharmaCorp Kenya',
    lastUpdated: '2024-01-14',
  },
  {
    id: 'MED004',
    productName: 'Lisinopril 10mg',
    genericName: 'Lisinopril',
    category: 'Cardiovascular',
    unit: 'Box (30 tabs)',
    suppliers: [
      {
        supplierId: 'SUP003',
        supplierName: 'HealthCare Distributors',
        unitPrice: 450,
        volumeDiscounts: [
          { minQuantity: 30, discount: 10, priceAfterDiscount: 405 },
        ],
        lastUpdated: '2024-01-16',
        isBestPrice: true,
      },
      {
        supplierId: 'SUP001',
        supplierName: 'PharmaCorp Kenya',
        unitPrice: 480,
        volumeDiscounts: [],
        lastUpdated: '2024-01-12',
        isBestPrice: false,
      },
    ],
    bestPrice: 405,
    bestPriceSupplier: 'HealthCare Distributors',
    lastUpdated: '2024-01-16',
  },
  {
    id: 'MED005',
    productName: 'Omeprazole 20mg',
    genericName: 'Omeprazole',
    category: 'Gastrointestinal',
    unit: 'Box (28 caps)',
    suppliers: [
      {
        supplierId: 'SUP002',
        supplierName: 'MediSupply Ltd',
        unitPrice: 680,
        volumeDiscounts: [
          { minQuantity: 15, discount: 8, priceAfterDiscount: 625.6 },
        ],
        lastUpdated: '2024-01-20',
        isBestPrice: true,
      },
      {
        supplierId: 'SUP004',
        supplierName: 'Global Pharma EA',
        unitPrice: 720,
        volumeDiscounts: [],
        lastUpdated: '2024-01-18',
        isBestPrice: false,
      },
    ],
    bestPrice: 625.6,
    bestPriceSupplier: 'MediSupply Ltd',
    lastUpdated: '2024-01-20',
  },
];

const suppliers = ['All Suppliers', 'PharmaCorp Kenya', 'MediSupply Ltd', 'HealthCare Distributors', 'Global Pharma EA'];
const categories = ['All Categories', 'Antibiotics', 'Analgesics', 'Diabetes', 'Cardiovascular', 'Gastrointestinal'];

export default function PharmacyPriceListsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('All Suppliers');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'productName',
    direction: 'asc',
  });

  const filteredPriceList = useMemo(() => {
    let items = mockPriceList.filter((item) => {
      const matchesSearch =
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.genericName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
      const matchesSupplier =
        selectedSupplier === 'All Suppliers' ||
        item.suppliers.some((s) => s.supplierName === selectedSupplier);
      return matchesSearch && matchesCategory && matchesSupplier;
    });

    return items.sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      if (sortConfig.key === 'productName') {
        return a.productName.localeCompare(b.productName) * direction;
      } else if (sortConfig.key === 'bestPrice') {
        return (a.bestPrice - b.bestPrice) * direction;
      }
      return 0;
    });
  }, [searchTerm, selectedSupplier, selectedCategory, sortConfig]);

  const stats = useMemo(() => {
    const totalProducts = mockPriceList.length;
    const avgSavings = 12.5;
    const recentlyUpdated = mockPriceList.filter((p) => {
      const updated = new Date(p.lastUpdated);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return updated >= sevenDaysAgo;
    }).length;
    const suppliersCount = new Set(mockPriceList.flatMap((p) => p.suppliers.map((s) => s.supplierId))).size;
    return { totalProducts, avgSavings, recentlyUpdated, suppliersCount };
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price Lists</h1>
          <p className="text-gray-500">Compare prices across suppliers and find best deals</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
            Refresh Prices
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
              <p className="text-sm text-gray-500">Products Listed</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.avgSavings}%</p>
              <p className="text-sm text-gray-500">Avg Volume Discount</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.recentlyUpdated}</p>
              <p className="text-sm text-gray-500">Updated This Week</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Building2 className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.suppliersCount}</p>
              <p className="text-sm text-gray-500">Active Suppliers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {suppliers.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Price List Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th
                  className="text-left px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('productName')}
                >
                  <div className="flex items-center gap-1">
                    Product
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Unit</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Suppliers</th>
                <th
                  className="text-left px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('bestPrice')}
                >
                  <div className="flex items-center gap-1">
                    Best Price
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPriceList.map((item) => (
                <React.Fragment key={item.id}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedProduct(expandedProduct === item.id ? null : item.id)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-900">{item.productName}</span>
                        <p className="text-sm text-gray-500">{item.genericName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.unit}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{item.suppliers.length} suppliers</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-green-500" />
                        <span className="font-medium text-green-600">{formatCurrency(item.bestPrice)}</span>
                      </div>
                      <p className="text-xs text-gray-500">{item.bestPriceSupplier}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {item.lastUpdated}
                      </div>
                    </td>
                  </tr>
                  {expandedProduct === item.id && (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 bg-gray-50">
                        <div className="space-y-3">
                          <h4 className="font-medium text-gray-900">Price Comparison</h4>
                          <div className="grid gap-3">
                            {item.suppliers.map((supplier) => (
                              <div
                                key={supplier.supplierId}
                                className={`p-4 rounded-lg border ${
                                  supplier.isBestPrice
                                    ? 'border-green-200 bg-green-50'
                                    : 'border-gray-200 bg-white'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium text-gray-900">{supplier.supplierName}</span>
                                    {supplier.isBestPrice && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                        <Check className="w-3 h-3" /> Best Price
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-gray-900">{formatCurrency(supplier.unitPrice)}</span>
                                    <p className="text-xs text-gray-500">Base price</p>
                                  </div>
                                </div>
                                {supplier.volumeDiscounts.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                                      <Percent className="w-3 h-3" /> Volume Discounts
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {supplier.volumeDiscounts.map((discount, idx) => (
                                        <div
                                          key={idx}
                                          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                                        >
                                          <span className="text-gray-600">{discount.minQuantity}+ units:</span>
                                          <span className="ml-1 font-medium text-green-600">
                                            {discount.discount}% off
                                          </span>
                                          <span className="ml-1 text-gray-500">
                                            ({formatCurrency(discount.priceAfterDiscount)})
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div className="mt-2 text-xs text-gray-500">
                                  Updated: {supplier.lastUpdated}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}