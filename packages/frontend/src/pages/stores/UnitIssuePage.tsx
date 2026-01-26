import React, { useState, useMemo } from 'react';
import {
  Send,
  Search,
  Plus,
  Trash2,
  FileText,
  Building2,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  ShoppingCart,
  Minus,
  X,
} from 'lucide-react';

interface IssueItem {
  id: string;
  name: string;
  sku: string;
  available: number;
  unit: string;
  quantity: number;
}

interface PendingRequest {
  id: string;
  department: string;
  requestedBy: string;
  date: string;
  items: number;
  status: 'pending' | 'approved' | 'processing';
  priority: 'normal' | 'urgent';
}

interface IssuedVoucher {
  id: string;
  voucherNo: string;
  department: string;
  issuedTo: string;
  date: string;
  items: number;
  total: number;
}

const departments = [
  'Emergency Department',
  'Surgical Ward',
  'Medical Ward',
  'Pediatrics',
  'ICU',
  'Outpatient',
  'Laboratory',
  'Radiology',
];

const mockItems = [
  { id: '1', name: 'Surgical Gloves (Medium)', sku: 'MS-001', available: 250, unit: 'Pairs' },
  { id: '2', name: 'IV Cannula 22G', sku: 'MS-002', available: 45, unit: 'Pieces' },
  { id: '3', name: 'Oxygen Mask Adult', sku: 'CO-001', available: 180, unit: 'Pieces' },
  { id: '4', name: 'Syringes 10ml', sku: 'MS-004', available: 500, unit: 'Pieces' },
  { id: '5', name: 'Gauze Pads Sterile', sku: 'MS-005', available: 300, unit: 'Pieces' },
  { id: '6', name: 'Bandage Rolls', sku: 'MS-006', available: 150, unit: 'Rolls' },
];

const mockPendingRequests: PendingRequest[] = [
  { id: '1', department: 'Emergency Department', requestedBy: 'Dr. Sarah Wanjiku', date: '2025-01-23', items: 5, status: 'pending', priority: 'urgent' },
  { id: '2', department: 'Surgical Ward', requestedBy: 'Nurse James Omondi', date: '2025-01-23', items: 8, status: 'approved', priority: 'normal' },
  { id: '3', department: 'ICU', requestedBy: 'Dr. Peter Kimani', date: '2025-01-22', items: 3, status: 'processing', priority: 'urgent' },
];

const mockIssuedVouchers: IssuedVoucher[] = [
  { id: '1', voucherNo: 'ISS-2025-0156', department: 'Emergency Department', issuedTo: 'Nurse Mary Achieng', date: '2025-01-23', items: 6, total: 12500 },
  { id: '2', voucherNo: 'ISS-2025-0155', department: 'Medical Ward', issuedTo: 'Nurse Grace Mutua', date: '2025-01-23', items: 4, total: 8200 },
  { id: '3', voucherNo: 'ISS-2025-0154', department: 'Pediatrics', issuedTo: 'Nurse Faith Njeri', date: '2025-01-22', items: 5, total: 9800 },
];

export default function UnitIssuePage() {
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<IssueItem[]>([]);
  const [activeTab, setActiveTab] = useState<'issue' | 'pending' | 'history'>('issue');
  const [recipientName, setRecipientName] = useState('');

  const filteredItems = useMemo(() => {
    return mockItems.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const addToCart = (item: typeof mockItems[0]) => {
    const existing = cart.find((c) => c.id === item.id);
    if (existing) {
      setCart(cart.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map((c) => {
      if (c.id === id) {
        const newQty = Math.max(1, Math.min(c.available, c.quantity + delta));
        return { ...c, quantity: newQty };
      }
      return c;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((c) => c.id !== id));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Pending</span>;
      case 'approved':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Approved</span>;
      case 'processing':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">Processing</span>;
      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Issue to Units</h1>
          <p className="text-gray-600">Issue inventory items to departments</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <FileText className="w-4 h-4" />
            View Vouchers
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-4">
        <button
          onClick={() => setActiveTab('issue')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'issue' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Send className="w-4 h-4 inline mr-2" />
          Issue Items
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'pending' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Pending Requests
          <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">3</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <CheckCircle className="w-4 h-4 inline mr-2" />
          Issue History
        </button>
      </div>

      {activeTab === 'issue' && (
        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
          {/* Left Panel - Item Selection */}
          <div className="col-span-2 bg-white border rounded-lg flex flex-col overflow-hidden">
            <div className="p-4 border-b flex-shrink-0">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Enter recipient name"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search items to issue..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-2 gap-3">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 border rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => addToCart(item)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Package className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                          <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                        </div>
                      </div>
                      <Plus className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      Available: {item.available} {item.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Cart */}
          <div className="bg-white border rounded-lg flex flex-col overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-gray-600" />
                <span className="font-medium">Issue Cart</span>
              </div>
              <span className="text-sm text-gray-500">{cart.length} items</span>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Package className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>No items in cart</p>
                  <p className="text-sm">Click items to add</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium text-sm text-gray-900">{item.name}</p>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Max: {item.available}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1 border rounded hover:bg-gray-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-12 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 border rounded hover:bg-gray-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex-shrink-0 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Items:</span>
                <span className="font-medium">{cart.reduce((acc, item) => acc + item.quantity, 0)}</span>
              </div>
              <button
                disabled={cart.length === 0 || !selectedDepartment}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Issue Items
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Department</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Requested By</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Items</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Priority</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mockPendingRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{request.department}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{request.requestedBy}</td>
                    <td className="px-4 py-3 text-gray-600">{request.date}</td>
                    <td className="px-4 py-3 text-gray-600">{request.items} items</td>
                    <td className="px-4 py-3">
                      {request.priority === 'urgent' ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 flex items-center gap-1 w-fit">
                          <AlertCircle className="w-3 h-3" />
                          Urgent
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">Normal</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(request.status)}</td>
                    <td className="px-4 py-3">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        Process
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Voucher No</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Department</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Issued To</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Items</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Value (KES)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mockIssuedVouchers.map((voucher) => (
                  <tr key={voucher.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-blue-600">{voucher.voucherNo}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{voucher.department}</td>
                    <td className="px-4 py-3 text-gray-600">{voucher.issuedTo}</td>
                    <td className="px-4 py-3 text-gray-600">{voucher.date}</td>
                    <td className="px-4 py-3 text-gray-600">{voucher.items}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{voucher.total.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
