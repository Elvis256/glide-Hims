import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Search,
  Plus,
  X,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  orderType: string;
  toothNumbers: number[];
  shade: string;
  material: string;
  impressionType: string;
  labName: string;
  status: string;
  sentDate: string | null;
  expectedDate: string | null;
  receivedDate: string | null;
  cost: number;
  notes: string;
  createdAt: string;
}

interface LabOrderStats {
  total: number;
  draft: number;
  sent: number;
  inFabrication: number;
  ready: number;
  received: number;
  overdue: number;
}

const STATUS_TABS = ['All', 'Draft', 'Sent', 'In Fabrication', 'Ready', 'Received', 'Fitted', 'Remake'];
const STATUS_MAP: Record<string, string> = {
  All: '',
  Draft: 'draft',
  Sent: 'sent',
  'In Fabrication': 'in_fabrication',
  Ready: 'ready',
  Received: 'received',
  Fitted: 'fitted',
  Remake: 'remake',
};

const ORDER_TYPES = [
  'crown', 'bridge', 'denture', 'implant_component', 'veneer',
  'inlay', 'onlay', 'retainer', 'aligner', 'night_guard', 'other',
];

const SHADES = [
  'A1', 'A2', 'A3', 'A3.5', 'A4',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3', 'C4',
  'D1', 'D2', 'D3', 'D4',
];

const MATERIALS = ['PFM', 'Zirconia', 'E-Max', 'Gold', 'Composite', 'Acrylic', 'Titanium', 'Other'];
const IMPRESSION_TYPES = ['digital', 'alginate', 'polyvinyl_siloxane', 'polyether', 'other'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  in_fabrication: 'bg-amber-100 text-amber-700',
  ready: 'bg-green-100 text-green-700',
  received: 'bg-emerald-100 text-emerald-700',
  fitted: 'bg-teal-100 text-teal-700',
  remake: 'bg-red-100 text-red-700',
};

const TEETH = Array.from({ length: 32 }, (_, i) => i + 1);

const ALL_STATUSES = ['draft', 'sent', 'in_fabrication', 'ready', 'received', 'fitted', 'remake'];

export default function DentalLabOrdersPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Create form
  const [orderType, setOrderType] = useState('crown');
  const [toothNumbers, setToothNumbers] = useState<number[]>([]);
  const [shade, setShade] = useState('A2');
  const [material, setMaterial] = useState('Zirconia');
  const [impressionType, setImpressionType] = useState('digital');
  const [labName, setLabName] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [cost, setCost] = useState(0);
  const [notes, setNotes] = useState('');

  // Stats
  const { data: stats } = useQuery<LabOrderStats>({
    queryKey: ['dental-lab-stats', facilityId],
    queryFn: async () => {
      try {
        const res = await api.get('/dental/lab-orders/stats');
        return res.data;
      } catch {
        return { total: 0, draft: 0, sent: 0, inFabrication: 0, ready: 0, received: 0, overdue: 0 };
      }
    },
  });

  // Orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['dental-lab-orders', activeTab, facilityId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      const status = STATUS_MAP[activeTab];
      if (status) params.status = status;
      const res = await api.get('/dental/lab-orders', { params });
      return res.data;
    },
  });

  const orders = asList<LabOrder>(ordersData);

  // Patient search for create form
  const { data: patientResults } = useQuery<Patient[]>({
    queryKey: ['patient-search-lab', patientSearch, facilityId],
    queryFn: async () => {
      if (patientSearch.length < 2) return [];
      const res = await api.get('/patients/search', { params: { query: patientSearch } });
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
    enabled: patientSearch.length >= 2 && !selectedPatient,
  });

  // Create
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/dental/lab-orders', {
        patientId: selectedPatient!.id,
        orderType,
        toothNumbers,
        shade,
        material,
        impressionType,
        labName,
        expectedDate: expectedDate || null,
        cost,
        notes,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Lab order created');
      queryClient.invalidateQueries({ queryKey: ['dental-lab-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dental-lab-stats'] });
      closeCreate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  // Status update
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/dental/lab-orders/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['dental-lab-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dental-lab-stats'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const toggleTooth = (t: number) => {
    setToothNumbers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const closeCreate = () => {
    setShowCreate(false);
    setSelectedPatient(null);
    setPatientSearch('');
    setOrderType('crown');
    setToothNumbers([]);
    setShade('A2');
    setMaterial('Zirconia');
    setImpressionType('digital');
    setLabName('');
    setExpectedDate('');
    setCost(0);
    setNotes('');
  };

  const statCards = [
    { label: 'Total Orders', value: stats?.total ?? 0, icon: Package, color: 'text-gray-600 bg-gray-50' },
    { label: 'Pending (Sent)', value: stats?.sent ?? 0, icon: Clock, color: 'text-blue-600 bg-blue-50' },
    { label: 'In Fabrication', value: stats?.inFabrication ?? 0, icon: Package, color: 'text-amber-600 bg-amber-50' },
    { label: 'Overdue', value: stats?.overdue ?? 0, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lab Orders</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border bg-white p-5">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border bg-white p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="overflow-hidden rounded-xl border bg-white">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Package className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p>No lab orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Teeth</th>
                  <th className="px-4 py-3">Shade</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Lab</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Expected</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{order.patientName}</td>
                    <td className="px-4 py-3 capitalize">{order.orderType.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">{order.toothNumbers?.join(', ') ?? '-'}</td>
                    <td className="px-4 py-3">{order.shade}</td>
                    <td className="px-4 py-3">{order.material}</td>
                    <td className="px-4 py-3">{order.labName}</td>
                    <td className="px-4 py-3">{formatCurrency(order.cost)}</td>
                    <td className="px-4 py-3">
                      {order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={order.status}
                        onChange={(e) =>
                          statusMutation.mutate({ id: order.id, status: e.target.value })
                        }
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50">
          <div className="m-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create Lab Order</h3>
              <button onClick={closeCreate} className="rounded p-1 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
              {/* Patient */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Patient</label>
                {selectedPatient ? (
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <span>{selectedPatient.firstName} {selectedPatient.lastName}</span>
                    <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="ml-auto">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search patient..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    {patientResults && patientResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                        {patientResults.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedPatient(p); setPatientSearch(''); }}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            {p.firstName} {p.lastName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Type */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Order Type</label>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {ORDER_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              {/* Teeth */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tooth Number(s)</label>
                <div className="flex flex-wrap gap-1">
                  {TEETH.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleTooth(t)}
                      className={`h-8 w-8 rounded text-xs font-medium ${
                        toothNumbers.includes(t)
                          ? 'bg-blue-600 text-white'
                          : 'border bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shade & Material */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Shade</label>
                  <select
                    value={shade}
                    onChange={(e) => setShade(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    {SHADES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Material</label>
                  <select
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    {MATERIALS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Impression */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Impression Type</label>
                <select
                  value={impressionType}
                  onChange={(e) => setImpressionType(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {IMPRESSION_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              {/* Lab Name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Lab Name</label>
                <input
                  type="text"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  placeholder="Enter dental lab name"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              {/* Expected Date & Cost */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Expected Date</label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Cost</label>
                  <input
                    type="number"
                    value={cost}
                    onChange={(e) => setCost(Number(e.target.value))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={closeCreate}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !selectedPatient}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
