import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  Package,
  Trash2,
  FileText,
  CheckCircle,
  XCircle,
  Download,
  Eye,
  MoreVertical,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

interface ExpiringItem {
  id: string;
  name: string;
  category: string;
  sku: string;
  batchNo: string;
  quantity: number;
  unit: string;
  expiryDate: string;
  daysToExpiry: number;
  location: string;
  value: number;
  status: 'active' | 'flagged' | 'disposed' | 'written-off';
}

interface DisposalRecord {
  id: string;
  disposalNo: string;
  items: number;
  totalValue: number;
  disposalDate: string;
  method: string;
  approvedBy: string;
  status: 'pending' | 'approved' | 'completed';
}

const mockExpiringItems: ExpiringItem[] = [
  { id: '1', name: 'Sterile Gauze Pads', category: 'Consumables', sku: 'CO-101', batchNo: 'BTH-2023-456', quantity: 150, unit: 'Packs', expiryDate: '2025-01-30', daysToExpiry: 7, location: 'Store A', value: 7500, status: 'flagged' },
  { id: '2', name: 'IV Solution Saline 500ml', category: 'Consumables', sku: 'CO-102', batchNo: 'BTH-2023-789', quantity: 80, unit: 'Bottles', expiryDate: '2025-02-15', daysToExpiry: 23, location: 'Store A', value: 16000, status: 'active' },
  { id: '3', name: 'Surgical Sutures 3-0', category: 'Medical Supplies', sku: 'MS-201', batchNo: 'BTH-2024-012', quantity: 45, unit: 'Boxes', expiryDate: '2025-02-28', daysToExpiry: 36, location: 'Store B', value: 22500, status: 'active' },
  { id: '4', name: 'Wound Dressing Sterile', category: 'Consumables', sku: 'CO-103', batchNo: 'BTH-2023-234', quantity: 200, unit: 'Pieces', expiryDate: '2025-01-28', daysToExpiry: 5, location: 'Store A', value: 10000, status: 'flagged' },
  { id: '5', name: 'Catheter Kit Sterile', category: 'Medical Supplies', sku: 'MS-202', batchNo: 'BTH-2023-567', quantity: 30, unit: 'Kits', expiryDate: '2025-01-25', daysToExpiry: 2, location: 'Store B', value: 15000, status: 'flagged' },
  { id: '6', name: 'Antiseptic Solution 500ml', category: 'Consumables', sku: 'CO-104', batchNo: 'BTH-2024-890', quantity: 60, unit: 'Bottles', expiryDate: '2025-03-15', daysToExpiry: 51, location: 'Store A', value: 9000, status: 'active' },
  { id: '7', name: 'Oxygen Tubing Adult', category: 'Consumables', sku: 'CO-105', batchNo: 'BTH-2023-111', quantity: 25, unit: 'Pieces', expiryDate: '2025-01-24', daysToExpiry: 1, location: 'Store C', value: 2500, status: 'flagged' },
];

const mockDisposalRecords: DisposalRecord[] = [
  { id: '1', disposalNo: 'DIS-2025-0023', items: 5, totalValue: 35000, disposalDate: '2025-01-22', method: 'Incineration', approvedBy: 'Dr. Sarah Wanjiku', status: 'completed' },
  { id: '2', disposalNo: 'DIS-2025-0022', items: 3, totalValue: 18500, disposalDate: '2025-01-20', method: 'Return to Supplier', approvedBy: 'James Mwangi', status: 'completed' },
  { id: '3', disposalNo: 'DIS-2025-0024', items: 4, totalValue: 25000, disposalDate: '2025-01-23', method: 'Incineration', approvedBy: 'Pending', status: 'pending' },
];

export default function StoresExpiryPage() {
  const [activeTab, setActiveTab] = useState<'expiring' | 'disposal' | 'writeoff'>('expiring');
  const [searchTerm, setSearchTerm] = useState('');
  const [expiryFilter, setExpiryFilter] = useState<string>('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const filteredItems = useMemo(() => {
    return mockExpiringItems.filter((item) => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.batchNo.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesExpiry = true;
      if (expiryFilter === '7days') matchesExpiry = item.daysToExpiry <= 7;
      else if (expiryFilter === '30days') matchesExpiry = item.daysToExpiry <= 30;
      else if (expiryFilter === '90days') matchesExpiry = item.daysToExpiry <= 90;
      
      return matchesSearch && matchesExpiry;
    });
  }, [searchTerm, expiryFilter]);

  const criticalCount = mockExpiringItems.filter((i) => i.daysToExpiry <= 7).length;
  const warningCount = mockExpiringItems.filter((i) => i.daysToExpiry > 7 && i.daysToExpiry <= 30).length;
  const totalExpiringValue = mockExpiringItems.filter((i) => i.daysToExpiry <= 30).reduce((sum, i) => sum + i.value, 0);

  const getExpiryBadge = (days: number) => {
    if (days <= 7) {
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
          <AlertTriangle className="w-3 h-3" />
          {days} days
        </span>
      );
    } else if (days <= 30) {
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">
          <AlertCircle className="w-3 h-3" />
          {days} days
        </span>
      );
    } else {
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
          <Clock className="w-3 h-3" />
          {days} days
        </span>
      );
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map((i) => i.id));
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expiry Management</h1>
          <p className="text-gray-600">Track and manage expiring consumables and sterile supplies</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            <Trash2 className="w-4 h-4" />
            Create Disposal
          </button>
        </div>
      </div>

      {/* Alert Cards */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">Critical (≤7 days)</p>
              <p className="text-2xl font-bold text-red-700">{criticalCount}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600">Warning (8-30 days)</p>
              <p className="text-2xl font-bold text-orange-700">{warningCount}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">At-Risk Value (KES)</p>
              <p className="text-2xl font-bold text-gray-900">{totalExpiringValue.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <Package className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Disposals</p>
              <p className="text-2xl font-bold text-yellow-600">1</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-4">
        <button
          onClick={() => setActiveTab('expiring')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'expiring' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Expiring Items
        </button>
        <button
          onClick={() => setActiveTab('disposal')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'disposal' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Trash2 className="w-4 h-4 inline mr-2" />
          Disposal Records
        </button>
        <button
          onClick={() => setActiveTab('writeoff')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'writeoff' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Write-offs
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by item name, SKU, or batch number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Expiry Dates</option>
          <option value="7days">Within 7 Days</option>
          <option value="30days">Within 30 Days</option>
          <option value="90days">Within 90 Days</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Selected Actions */}
      {selectedItems.length > 0 && activeTab === 'expiring' && (
        <div className="flex-shrink-0 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <span className="text-blue-800 font-medium">
            {selectedItems.length} items selected
          </span>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 flex items-center gap-1">
              <ArrowRight className="w-3 h-3" />
              Transfer Out
            </button>
            <button className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-1">
              <Trash2 className="w-3 h-3" />
              Create Disposal
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
        {activeTab === 'expiring' && (
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item Details</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Batch No</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Quantity</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Expiry Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Days Left</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Value (KES)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Location</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredItems.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50 ${item.daysToExpiry <= 7 ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => toggleSelectItem(item.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500">SKU: {item.sku} • {item.category}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-600">{item.batchNo}</span>
                    </td>
                    <td className="px-4 py-3">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {item.expiryDate}
                      </div>
                    </td>
                    <td className="px-4 py-3">{getExpiryBadge(item.daysToExpiry)}</td>
                    <td className="px-4 py-3 font-medium">{item.value.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{item.location}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1 hover:bg-gray-100 rounded" title="View">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded" title="Dispose">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'disposal' && (
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Disposal No</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Items</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Total Value</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Method</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Approved By</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mockDisposalRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-blue-600">{record.disposalNo}</span>
                    </td>
                    <td className="px-4 py-3">{record.items} items</td>
                    <td className="px-4 py-3 font-medium">KES {record.totalValue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{record.disposalDate}</td>
                    <td className="px-4 py-3 text-gray-600">{record.method}</td>
                    <td className="px-4 py-3 text-gray-600">{record.approvedBy}</td>
                    <td className="px-4 py-3">
                      {record.status === 'completed' ? (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 w-fit">
                          <CheckCircle className="w-3 h-3" />
                          Completed
                        </span>
                      ) : record.status === 'pending' ? (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 w-fit">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 w-fit">
                          <CheckCircle className="w-3 h-3" />
                          Approved
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'writeoff' && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium">Write-off Records</p>
              <p className="text-sm">View historical write-off approvals and documentation</p>
            </div>
          </div>
        )}

        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          {activeTab === 'expiring' ? `Showing ${filteredItems.length} expiring items` : 
           activeTab === 'disposal' ? `Showing ${mockDisposalRecords.length} disposal records` :
           'Write-off management'}
        </div>
      </div>
    </div>
  );
}