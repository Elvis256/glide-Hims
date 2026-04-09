import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Edit2,
  Users,
  Phone,
  Mail,
  MapPin,
  X,
  Loader2,
  Building2,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';

interface WholesaleCustomer {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  taxId?: string;
  creditLimit: number;
  outstandingBalance: number;
  pricingTier: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
}

interface CustomerFormData {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  creditLimit: string;
  pricingTier: string;
}

const emptyForm: CustomerFormData = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  taxId: '',
  creditLimit: '',
  pricingTier: 'standard',
};

export default function WholesaleCustomersPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<WholesaleCustomer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<WholesaleCustomer | null>(null);
  const [form, setForm] = useState<CustomerFormData>(emptyForm);

  // Fetch customers
  const { data: customersData, isLoading } = useQuery({
    queryKey: ['wholesale-customers', facilityId],
    queryFn: async () => {
      const res = await api.get('/pos/wholesale/customers');
      return res.data;
    },
  });

  // Fetch tiers for dropdown
  const { data: tiersData } = useQuery({
    queryKey: ['wholesale-tiers', facilityId],
    queryFn: async () => {
      try {
        const res = await api.get('/pos/wholesale/tiers');
        return res.data;
      } catch {
        return [];
      }
    },
  });

  const customers = asList<WholesaleCustomer>(customersData);
  const tiers = asList<{ id: string; name: string }>(tiersData);

  const filteredCustomers = useMemo(() => {
    let result = customers;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.contactPerson.toLowerCase().includes(term) ||
          c.phone.includes(term)
      );
    }
    if (filterTier) result = result.filter((c) => c.pricingTier === filterTier);
    if (filterStatus) result = result.filter((c) => c.status === filterStatus);
    return result;
  }, [customers, searchTerm, filterTier, filterStatus]);

  // Create customer
  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const res = await api.post('/pos/wholesale/customers', {
        ...data,
        creditLimit: parseFloat(data.creditLimit) || 0,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-customers'] });
      closeModal();
      toast.success('Customer created successfully');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create customer')),
  });

  // Update customer
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomerFormData }) => {
      const res = await api.put(`/pos/wholesale/customers/${id}`, {
        ...data,
        creditLimit: parseFloat(data.creditLimit) || 0,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-customers'] });
      closeModal();
      toast.success('Customer updated successfully');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update customer')),
  });

  const openAddModal = () => {
    setEditingCustomer(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (customer: WholesaleCustomer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      contactPerson: customer.contactPerson,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
      taxId: customer.taxId || '',
      creditLimit: String(customer.creditLimit),
      pricingTier: customer.pricingTier,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.contactPerson || !form.phone) {
      toast.error('Name, contact person, and phone are required');
      return;
    }
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Customer detail view
  if (selectedCustomer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedCustomer(null)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{selectedCustomer.name}</h1>
            <p className="text-sm text-gray-500">Wholesale Customer Details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-gray-900">Account Information</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Contact Person</dt>
                <dd className="mt-0.5 font-medium text-gray-900">{selectedCustomer.contactPerson}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Phone</dt>
                <dd className="mt-0.5 font-medium text-gray-900">{selectedCustomer.phone}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="mt-0.5 font-medium text-gray-900">{selectedCustomer.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Tax ID</dt>
                <dd className="mt-0.5 font-medium text-gray-900">{selectedCustomer.taxId || '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-gray-500">Address</dt>
                <dd className="mt-0.5 font-medium text-gray-900">{selectedCustomer.address || '—'}</dd>
              </div>
            </dl>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs text-gray-500">Pricing Tier</p>
              <p className="mt-1 text-lg font-semibold capitalize text-gray-900">
                {selectedCustomer.pricingTier}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs text-gray-500">Credit Limit</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {formatCurrency(selectedCustomer.creditLimit)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs text-gray-500">Outstanding Balance</p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  selectedCustomer.outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {formatCurrency(selectedCustomer.outstandingBalance)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs text-gray-500">Status</p>
              <span
                className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  selectedCustomer.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : selectedCustomer.status === 'suspended'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {selectedCustomer.status}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wholesale Customers</h1>
          <p className="text-sm text-gray-500">Manage wholesale customer accounts</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Tiers</option>
          {tiers.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
          <option value="vip">VIP</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-medium">No customers found</p>
            <p className="text-sm">Add a wholesale customer to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Contact Person</th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3">Tier</th>
                  <th className="px-6 py-3 text-right">Credit Limit</th>
                  <th className="px-6 py-3 text-right">Balance</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <td className="px-6 py-3 font-medium text-gray-900">{customer.name}</td>
                    <td className="px-6 py-3 text-gray-600">{customer.contactPerson}</td>
                    <td className="px-6 py-3 text-gray-600">{customer.phone}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium capitalize text-blue-800">
                        {customer.pricingTier}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-gray-900">
                      {formatCurrency(customer.creditLimit)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span
                        className={`font-medium ${
                          customer.outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {formatCurrency(customer.outstandingBalance)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          customer.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : customer.status === 'suspended'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(customer);
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCustomer ? 'Edit Customer' : 'Add Customer'}
              </h2>
              <button onClick={closeModal} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Phone *</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Tax ID</label>
                  <input
                    type="text"
                    value={form.taxId}
                    onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Credit Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.creditLimit}
                    onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Pricing Tier
                  </label>
                  <select
                    value={form.pricingTier}
                    onChange={(e) => setForm({ ...form, pricingTier: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                    <option value="vip">VIP</option>
                    {tiers
                      .filter(
                        (t) => !['standard', 'premium', 'vip'].includes(t.name.toLowerCase())
                      )
                      .map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingCustomer ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
