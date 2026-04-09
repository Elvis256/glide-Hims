import { useState, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart,
  Search,
  Plus,
  Eye,
  Package,
  Truck,
  CheckCircle,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  X,
  Scissors,
  Settings,
  User,
  FileText,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Patient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  mrn?: string;
}

interface Prescription {
  id: string;
  patientId: string;
  odSphere?: number | null;
  odCylinder?: number | null;
  odAxis?: number | null;
  odAdd?: number | null;
  osSphere?: number | null;
  osCylinder?: number | null;
  osAxis?: number | null;
  osAdd?: number | null;
  pd?: number | null;
  prescribedBy?: string;
  prescribedDate?: string;
  expiryDate?: string;
  notes?: string;
  status?: string;
}

interface Frame {
  id: string;
  brand: string;
  model: string;
  color?: string;
  size?: string;
  material?: string;
  price: number;
  stock: number;
  sku?: string;
}

interface Lens {
  id: string;
  name: string;
  type?: string;
  material?: string;
  index?: string;
  price: number;
  active?: boolean;
}

type OrderStatus =
  | 'ordered'
  | 'in_lab'
  | 'lens_cutting'
  | 'fitting'
  | 'quality_check'
  | 'ready'
  | 'delivered';

type CoatingType =
  | 'anti_reflective'
  | 'blue_light'
  | 'photochromic'
  | 'scratch_resistant'
  | 'uv';

interface OrderPricing {
  framePrice: number;
  lensPrice: number;
  coatingCharges: number;
  fittingCharge: number;
  discount: number;
  total: number;
  depositPaid: number;
  balanceDue: number;
}

interface OrderTimeline {
  status: string;
  changedAt: string;
  changedBy?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  patientId: string;
  patient?: Patient;
  prescriptionId: string;
  prescription?: Prescription;
  frameId: string;
  frame?: Frame;
  lensId: string;
  lens?: Lens;
  coatings: CoatingType[];
  status: OrderStatus;
  pricing: OrderPricing;
  fittingNotes?: string;
  labNotes?: string;
  estimatedReadyDate?: string;
  orderedDate: string;
  deliveredDate?: string;
  timeline?: OrderTimeline[];
  createdAt: string;
  updatedAt: string;
}

interface OrderStats {
  ordered: number;
  in_lab: number;
  lens_cutting: number;
  fitting: number;
  quality_check: number;
  ready: number;
  delivered: number;
  total: number;
}

interface OrderFormData {
  patientId: string;
  prescriptionId: string;
  frameId: string;
  lensId: string;
  coatings: CoatingType[];
  framePrice: string;
  lensPrice: string;
  coatingCharges: string;
  fittingCharge: string;
  discount: string;
  depositPaid: string;
  fittingNotes: string;
  labNotes: string;
  estimatedReadyDate: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ORDER_STATUSES: { key: OrderStatus; label: string; color: string; bg: string; icon: typeof ShoppingCart }[] = [
  { key: 'ordered', label: 'Ordered', color: 'text-blue-700', bg: 'bg-blue-100', icon: ShoppingCart },
  { key: 'in_lab', label: 'In Lab', color: 'text-indigo-700', bg: 'bg-indigo-100', icon: Package },
  { key: 'lens_cutting', label: 'Lens Cutting', color: 'text-purple-700', bg: 'bg-purple-100', icon: Scissors },
  { key: 'fitting', label: 'Fitting', color: 'text-orange-700', bg: 'bg-orange-100', icon: Settings },
  { key: 'quality_check', label: 'Quality Check', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Eye },
  { key: 'ready', label: 'Ready', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle },
  { key: 'delivered', label: 'Delivered', color: 'text-gray-600', bg: 'bg-gray-100', icon: Truck },
];

const PIPELINE_COLORS: Record<OrderStatus, { ring: string; bgSolid: string; text: string }> = {
  ordered: { ring: 'ring-blue-400', bgSolid: 'bg-blue-500', text: 'text-blue-600' },
  in_lab: { ring: 'ring-indigo-400', bgSolid: 'bg-indigo-500', text: 'text-indigo-600' },
  lens_cutting: { ring: 'ring-purple-400', bgSolid: 'bg-purple-500', text: 'text-purple-600' },
  fitting: { ring: 'ring-orange-400', bgSolid: 'bg-orange-500', text: 'text-orange-600' },
  quality_check: { ring: 'ring-yellow-400', bgSolid: 'bg-yellow-500', text: 'text-yellow-600' },
  ready: { ring: 'ring-green-400', bgSolid: 'bg-green-500', text: 'text-green-600' },
  delivered: { ring: 'ring-gray-400', bgSolid: 'bg-gray-400', text: 'text-gray-500' },
};

const COATING_OPTIONS: { key: CoatingType; label: string }[] = [
  { key: 'anti_reflective', label: 'Anti-Reflective' },
  { key: 'blue_light', label: 'Blue Light Filter' },
  { key: 'photochromic', label: 'Photochromic' },
  { key: 'scratch_resistant', label: 'Scratch Resistant' },
  { key: 'uv', label: 'UV Protection' },
];

const emptyForm: OrderFormData = {
  patientId: '',
  prescriptionId: '',
  frameId: '',
  lensId: '',
  coatings: [],
  framePrice: '0',
  lensPrice: '0',
  coatingCharges: '0',
  fittingCharge: '0',
  discount: '0',
  depositPaid: '0',
  fittingNotes: '',
  labNotes: '',
  estimatedReadyDate: '',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusMeta(status: OrderStatus) {
  return ORDER_STATUSES.find((s) => s.key === status) ?? ORDER_STATUSES[0];
}

function formatSph(v: number | null | undefined) {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}

function rxSummary(rx?: Prescription | null) {
  if (!rx) return '—';
  return `OD ${formatSph(rx.odSphere)} / OS ${formatSph(rx.osSphere)}`;
}

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SpectacleOrdersPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  // -- UI state --
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // -- New-order modal state --
  const [form, setForm] = useState<OrderFormData>(emptyForm);
  const [patientSearch, setPatientSearch] = useState('');
  const [frameSearch, setFrameSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [selectedLens, setSelectedLens] = useState<Lens | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Queries                                                          */
  /* ---------------------------------------------------------------- */

  const { data: ordersRaw, isLoading: ordersLoading } = useQuery({
    queryKey: ['optical-orders', facilityId, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/optical/orders', { params });
      return res.data;
    },
  });

  const { data: statsRaw } = useQuery({
    queryKey: ['optical-orders-stats', facilityId],
    queryFn: async () => {
      const res = await api.get('/optical/orders/stats');
      return res.data;
    },
  });

  const orders = asList<Order>(ordersRaw);

  const stats: OrderStats = useMemo(() => {
    const defaults: OrderStats = {
      ordered: 0,
      in_lab: 0,
      lens_cutting: 0,
      fitting: 0,
      quality_check: 0,
      ready: 0,
      delivered: 0,
      total: 0,
    };
    if (statsRaw && typeof statsRaw === 'object' && !Array.isArray(statsRaw)) {
      return { ...defaults, ...(statsRaw as Partial<OrderStats>) };
    }
    return defaults;
  }, [statsRaw]);

  // Patient search (only when modal open & typing)
  const { data: patientsRaw, isFetching: patientsLoading } = useQuery({
    queryKey: ['patient-search', patientSearch],
    queryFn: async () => {
      const res = await api.get('/patients', { params: { search: patientSearch } });
      return res.data;
    },
    enabled: showNewOrder && patientSearch.length >= 2,
  });
  const patients = asList<Patient>(patientsRaw);

  // Prescriptions for selected patient
  const { data: prescriptionsRaw } = useQuery({
    queryKey: ['optical-prescriptions', form.patientId],
    queryFn: async () => {
      const res = await api.get(`/optical/prescriptions/patient/${form.patientId}`);
      return res.data;
    },
    enabled: !!form.patientId,
  });
  const prescriptions = asList<Prescription>(prescriptionsRaw);

  // Frame search
  const { data: framesRaw, isFetching: framesLoading } = useQuery({
    queryKey: ['optical-frames-search', frameSearch],
    queryFn: async () => {
      const res = await api.get('/optical/frames', { params: { search: frameSearch, inStock: true } });
      return res.data;
    },
    enabled: showNewOrder && frameSearch.length >= 2,
  });
  const frames = asList<Frame>(framesRaw);

  // Active lenses
  const { data: lensesRaw } = useQuery({
    queryKey: ['optical-lenses-active', facilityId],
    queryFn: async () => {
      const res = await api.get('/optical/lenses', { params: { active: true } });
      return res.data;
    },
    enabled: showNewOrder,
  });
  const lenses = asList<Lens>(lensesRaw);

  /* ---------------------------------------------------------------- */
  /*  Mutations                                                        */
  /* ---------------------------------------------------------------- */

  const createOrderMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post('/optical/orders', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optical-orders'] });
      queryClient.invalidateQueries({ queryKey: ['optical-orders-stats'] });
      toast.success('Order created successfully');
      closeModal();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to create order'));
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const res = await api.patch(`/optical/orders/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optical-orders'] });
      queryClient.invalidateQueries({ queryKey: ['optical-orders-stats'] });
      toast.success('Status updated');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to update status'));
    },
  });

  /* ---------------------------------------------------------------- */
  /*  Derived / computed                                               */
  /* ---------------------------------------------------------------- */

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber?.toLowerCase().includes(term) ||
          o.patient?.name?.toLowerCase().includes(term) ||
          o.frame?.brand?.toLowerCase().includes(term) ||
          o.frame?.model?.toLowerCase().includes(term),
      );
    }
    return result;
  }, [orders, searchTerm]);

  // Auto-computed totals for the new-order form
  const formTotal = useMemo(() => {
    const fp = parseFloat(form.framePrice) || 0;
    const lp = parseFloat(form.lensPrice) || 0;
    const cc = parseFloat(form.coatingCharges) || 0;
    const fc = parseFloat(form.fittingCharge) || 0;
    const disc = parseFloat(form.discount) || 0;
    const total = fp + lp + cc + fc - disc;
    const deposit = parseFloat(form.depositPaid) || 0;
    return { total: Math.max(total, 0), balance: Math.max(total - deposit, 0) };
  }, [form.framePrice, form.lensPrice, form.coatingCharges, form.fittingCharge, form.discount, form.depositPaid]);

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                         */
  /* ---------------------------------------------------------------- */

  function closeModal() {
    setShowNewOrder(false);
    setForm(emptyForm);
    setPatientSearch('');
    setFrameSearch('');
    setSelectedPatient(null);
    setSelectedFrame(null);
    setSelectedLens(null);
  }

  function selectPatient(p: Patient) {
    setSelectedPatient(p);
    setPatientSearch(p.name);
    setForm((f) => ({ ...f, patientId: p.id, prescriptionId: '' }));
  }

  function selectFrame(f: Frame) {
    setSelectedFrame(f);
    setFrameSearch(`${f.brand} ${f.model}`);
    setForm((prev) => ({ ...prev, frameId: f.id, framePrice: String(f.price ?? 0) }));
  }

  function handleLensChange(lensId: string) {
    const lens = lenses.find((l) => l.id === lensId) ?? null;
    setSelectedLens(lens);
    setForm((f) => ({ ...f, lensId, lensPrice: String(lens?.price ?? 0) }));
  }

  function toggleCoating(c: CoatingType) {
    setForm((f) => ({
      ...f,
      coatings: f.coatings.includes(c) ? f.coatings.filter((x) => x !== c) : [...f.coatings, c],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientId || !form.prescriptionId || !form.frameId || !form.lensId) {
      toast.error('Please fill in all required fields');
      return;
    }
    createOrderMutation.mutate({
      patientId: form.patientId,
      prescriptionId: form.prescriptionId,
      frameId: form.frameId,
      lensId: form.lensId,
      coatings: form.coatings,
      framePrice: parseFloat(form.framePrice) || 0,
      lensPrice: parseFloat(form.lensPrice) || 0,
      coatingCharges: parseFloat(form.coatingCharges) || 0,
      fittingCharge: parseFloat(form.fittingCharge) || 0,
      discount: parseFloat(form.discount) || 0,
      depositPaid: parseFloat(form.depositPaid) || 0,
      fittingNotes: form.fittingNotes,
      labNotes: form.labNotes,
      estimatedReadyDate: form.estimatedReadyDate || undefined,
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Render helpers                                                   */
  /* ---------------------------------------------------------------- */

  const isSaving = createOrderMutation.isPending;

  function renderPipeline() {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between overflow-x-auto">
          {ORDER_STATUSES.map((s, idx) => {
            const count = stats[s.key] ?? 0;
            const colors = PIPELINE_COLORS[s.key];
            const Icon = s.icon;
            const isActive = statusFilter === s.key;
            return (
              <div key={s.key} className="flex items-center">
                <button
                  onClick={() => setStatusFilter(statusFilter === s.key ? '' : s.key)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg px-3 py-2 transition ${
                    isActive ? `ring-2 ${colors.ring} bg-white shadow` : 'hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      isActive ? `${colors.bgSolid} text-white` : `${s.bg} ${s.color}`
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-xs font-medium ${isActive ? colors.text : 'text-gray-600'}`}>
                    {s.label}
                  </span>
                  <span
                    className={`text-lg font-bold ${isActive ? colors.text : 'text-gray-900'}`}
                  >
                    {count}
                  </span>
                </button>
                {idx < ORDER_STATUSES.length - 1 && (
                  <ArrowRight className="mx-1 h-4 w-4 flex-shrink-0 text-gray-300" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderStatusBadge(status: OrderStatus) {
    const meta = statusMeta(status);
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.bg} ${meta.color}`}
      >
        {meta.label}
      </span>
    );
  }

  function renderExpandedRow(order: Order) {
    const rx = order.prescription;
    const frame = order.frame;
    const lens = order.lens;
    const pricing = order.pricing;

    return (
      <tr>
        <td colSpan={10} className="bg-gray-50 px-6 py-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Rx Details */}
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                <FileText className="h-4 w-4" /> Prescription Details
              </h4>
              {rx ? (
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="pb-1"></th>
                        <th className="pb-1 pr-2">SPH</th>
                        <th className="pb-1 pr-2">CYL</th>
                        <th className="pb-1 pr-2">AXIS</th>
                        <th className="pb-1">ADD</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-800">
                      <tr>
                        <td className="pr-2 font-medium">OD</td>
                        <td className="pr-2">{formatSph(rx.odSphere)}</td>
                        <td className="pr-2">{formatSph(rx.odCylinder)}</td>
                        <td className="pr-2">{rx.odAxis ?? '—'}</td>
                        <td>{formatSph(rx.odAdd)}</td>
                      </tr>
                      <tr>
                        <td className="pr-2 font-medium">OS</td>
                        <td className="pr-2">{formatSph(rx.osSphere)}</td>
                        <td className="pr-2">{formatSph(rx.osCylinder)}</td>
                        <td className="pr-2">{rx.osAxis ?? '—'}</td>
                        <td>{formatSph(rx.osAdd)}</td>
                      </tr>
                    </tbody>
                  </table>
                  {rx.pd && <p className="mt-1 text-gray-500">PD: {rx.pd}mm</p>}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No prescription data</p>
              )}
            </div>

            {/* Frame & Lens Details */}
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                  <Package className="h-4 w-4" /> Frame
                </h4>
                {frame ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700">
                    <p><span className="font-medium">Brand:</span> {frame.brand}</p>
                    <p><span className="font-medium">Model:</span> {frame.model}</p>
                    {frame.color && <p><span className="font-medium">Color:</span> {frame.color}</p>}
                    {frame.size && <p><span className="font-medium">Size:</span> {frame.size}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No frame data</p>
                )}
              </div>
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                  <Eye className="h-4 w-4" /> Lens
                </h4>
                {lens ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700">
                    <p><span className="font-medium">Name:</span> {lens.name}</p>
                    {lens.type && <p><span className="font-medium">Type:</span> {lens.type}</p>}
                    {lens.material && <p><span className="font-medium">Material:</span> {lens.material}</p>}
                    {order.coatings?.length > 0 && (
                      <p>
                        <span className="font-medium">Coatings:</span>{' '}
                        {order.coatings.map((c) => COATING_OPTIONS.find((o) => o.key === c)?.label ?? c).join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No lens data</p>
                )}
              </div>
            </div>

            {/* Pricing & Timeline */}
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-900">Pricing Breakdown</h4>
                {pricing ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs">
                    <div className="space-y-1 text-gray-700">
                      <div className="flex justify-between">
                        <span>Frame</span>
                        <span>{formatCurrency(pricing.framePrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Lens</span>
                        <span>{formatCurrency(pricing.lensPrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Coatings</span>
                        <span>{formatCurrency(pricing.coatingCharges)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fitting</span>
                        <span>{formatCurrency(pricing.fittingCharge)}</span>
                      </div>
                      {pricing.discount > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>Discount</span>
                          <span>-{formatCurrency(pricing.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold text-gray-900">
                        <span>Total</span>
                        <span>{formatCurrency(pricing.total)}</span>
                      </div>
                      <div className="flex justify-between text-green-700">
                        <span>Paid</span>
                        <span>{formatCurrency(pricing.depositPaid)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-orange-700">
                        <span>Balance Due</span>
                        <span>{formatCurrency(pricing.balanceDue)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No pricing data</p>
                )}
              </div>

              {order.timeline && order.timeline.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-900">Order Timeline</h4>
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="space-y-2">
                      {order.timeline.map((t, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-400" />
                          <div>
                            <span className="font-medium capitalize text-gray-900">
                              {t.status.replace(/_/g, ' ')}
                            </span>
                            <span className="ml-2 text-gray-400">{formatDate(t.changedAt)}</span>
                            {t.changedBy && (
                              <span className="ml-1 text-gray-400">by {t.changedBy}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {(order.fittingNotes || order.labNotes) && (
                <div className="space-y-2">
                  {order.fittingNotes && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500">Fitting Notes</h4>
                      <p className="text-xs text-gray-700">{order.fittingNotes}</p>
                    </div>
                  )}
                  {order.labNotes && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500">Lab Notes</h4>
                      <p className="text-xs text-gray-700">{order.labNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Main render                                                      */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Spectacle Orders</h1>
          <p className="mt-1 text-sm text-gray-500">Manage optical orders</p>
        </div>
        <button
          onClick={() => setShowNewOrder(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Order
        </button>
      </div>

      {/* Pipeline */}
      {renderPipeline()}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setStatusFilter('')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === '' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({stats.total})
          </button>
          {ORDER_STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(statusFilter === s.key ? '' : s.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === s.key
                  ? `${s.bg} ${s.color}`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.label} ({stats[s.key] ?? 0})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search orders..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-64"
          />
        </div>
      </div>

      {/* Orders table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {ordersLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-500">Loading orders…</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">No orders found</p>
            <p className="mt-1 text-xs text-gray-400">
              {statusFilter
                ? 'Try selecting a different status filter'
                : 'Create your first spectacle order to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Frame</th>
                  <th className="px-4 py-3">Lens</th>
                  <th className="px-4 py-3">Rx Summary</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Ordered</th>
                  <th className="px-4 py-3">Est. Ready</th>
                  <th className="px-4 py-3 text-center">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  return (
                    <Fragment key={order.id}>
                      <tr
                        className={`cursor-pointer transition hover:bg-gray-50 ${
                          isExpanded ? 'bg-blue-50/40' : ''
                        }`}
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      >
                        <td className="px-4 py-3 text-gray-400">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {order.orderNumber}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-gray-400" />
                            {order.patient?.name ?? '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {order.frame
                            ? `${order.frame.brand} ${order.frame.model}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {order.lens?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                          {rxSummary(order.prescription)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {formatCurrency(order.pricing?.total)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-medium ${
                              (order.pricing?.depositPaid ?? 0) >= (order.pricing?.total ?? 0)
                                ? 'text-green-600'
                                : 'text-orange-600'
                            }`}
                          >
                            {formatCurrency(order.pricing?.depositPaid)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {renderStatusBadge(order.status)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                          {formatDate(order.orderedDate || order.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                          {formatDate(order.estimatedReadyDate)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <select
                            value={order.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              statusMutation.mutate({
                                id: order.id,
                                status: e.target.value as OrderStatus,
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border border-gray-300 px-1.5 py-1 text-xs focus:border-blue-500 focus:outline-none"
                          >
                            {ORDER_STATUSES.map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                      {isExpanded && renderExpandedRow(order)}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------ */}
      {/*  New Order Modal                                              */}
      {/* ------------------------------------------------------------ */}
      {showNewOrder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">New Spectacle Order</h2>
              <button
                onClick={closeModal}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSubmit} className="max-h-[90vh] overflow-y-auto p-6">
              <div className="space-y-6">
                {/* ---- Patient Search ---- */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Patient *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={(e) => {
                        setPatientSearch(e.target.value);
                        if (selectedPatient) {
                          setSelectedPatient(null);
                          setForm((f) => ({ ...f, patientId: '', prescriptionId: '' }));
                        }
                      }}
                      placeholder="Search patients by name or phone…"
                      className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {patientsLoading && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                    )}
                  </div>
                  {/* Patient dropdown */}
                  {patientSearch.length >= 2 && !selectedPatient && patients.length > 0 && (
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {patients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectPatient(p)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
                        >
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{p.name}</span>
                          {p.phone && <span className="text-gray-400">· {p.phone}</span>}
                          {p.mrn && <span className="text-gray-400">· MRN: {p.mrn}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {patientSearch.length >= 2 && !selectedPatient && !patientsLoading && patients.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400">No patients found</p>
                  )}
                </div>

                {/* ---- Prescription Select ---- */}
                {form.patientId && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Prescription *
                    </label>
                    <select
                      value={form.prescriptionId}
                      onChange={(e) => setForm((f) => ({ ...f, prescriptionId: e.target.value }))}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select prescription…</option>
                      {prescriptions.map((rx) => (
                        <option key={rx.id} value={rx.id}>
                          {rxSummary(rx)}
                          {rx.prescribedDate ? ` — ${formatDate(rx.prescribedDate)}` : ''}
                        </option>
                      ))}
                    </select>
                    {prescriptions.length === 0 && (
                      <p className="mt-1 text-xs text-gray-400">
                        No active prescriptions for this patient
                      </p>
                    )}
                  </div>
                )}

                {/* ---- Frame Search ---- */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Frame *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={frameSearch}
                      onChange={(e) => {
                        setFrameSearch(e.target.value);
                        if (selectedFrame) {
                          setSelectedFrame(null);
                          setForm((f) => ({ ...f, frameId: '', framePrice: '0' }));
                        }
                      }}
                      placeholder="Search frames by brand or model…"
                      className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {framesLoading && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                    )}
                  </div>
                  {/* Frame dropdown */}
                  {frameSearch.length >= 2 && !selectedFrame && frames.length > 0 && (
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {frames.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => selectFrame(f)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-blue-50"
                        >
                          <span>
                            <span className="font-medium text-gray-900">
                              {f.brand} {f.model}
                            </span>
                            {f.color && <span className="ml-1 text-gray-400">({f.color})</span>}
                          </span>
                          <span className="flex items-center gap-3 text-xs text-gray-500">
                            <span>Stock: {f.stock}</span>
                            <span className="font-medium text-gray-700">
                              {formatCurrency(f.price)}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {frameSearch.length >= 2 && !selectedFrame && !framesLoading && frames.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400">No frames found in stock</p>
                  )}
                </div>

                {/* ---- Lens Select ---- */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Lens *</label>
                  <select
                    value={form.lensId}
                    onChange={(e) => handleLensChange(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select lens…</option>
                    {lenses.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                        {l.type ? ` — ${l.type}` : ''}
                        {l.material ? ` (${l.material})` : ''} — {formatCurrency(l.price)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ---- Coatings ---- */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Coatings</label>
                  <div className="flex flex-wrap gap-3">
                    {COATING_OPTIONS.map((c) => (
                      <label
                        key={c.key}
                        className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={form.coatings.includes(c.key)}
                          onChange={() => toggleCoating(c.key)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* ---- Pricing Section ---- */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Pricing</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Frame Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.framePrice}
                        onChange={(e) => setForm((f) => ({ ...f, framePrice: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Lens Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.lensPrice}
                        onChange={(e) => setForm((f) => ({ ...f, lensPrice: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Coating Charges
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.coatingCharges}
                        onChange={(e) => setForm((f) => ({ ...f, coatingCharges: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Fitting Charge
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.fittingCharge}
                        onChange={(e) => setForm((f) => ({ ...f, fittingCharge: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Discount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.discount}
                        onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Deposit / Advance Paid
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.depositPaid}
                        onChange={(e) => setForm((f) => ({ ...f, depositPaid: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="mt-4 rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">Total</span>
                      <span className="text-lg font-bold text-gray-900">
                        {formatCurrency(formTotal.total)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-gray-500">Balance Due</span>
                      <span
                        className={`font-semibold ${
                          formTotal.balance > 0 ? 'text-orange-600' : 'text-green-600'
                        }`}
                      >
                        {formatCurrency(formTotal.balance)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ---- Notes ---- */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Fitting Notes
                    </label>
                    <textarea
                      value={form.fittingNotes}
                      onChange={(e) => setForm((f) => ({ ...f, fittingNotes: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Temple adjustments, nose pad preferences…"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Lab Notes
                    </label>
                    <textarea
                      value={form.labNotes}
                      onChange={(e) => setForm((f) => ({ ...f, labNotes: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Special lens treatments, edging instructions…"
                    />
                  </div>
                </div>

                {/* ---- Estimated Ready Date ---- */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Estimated Ready Date
                  </label>
                  <input
                    type="date"
                    value={form.estimatedReadyDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, estimatedReadyDate: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-56"
                  />
                </div>
              </div>

              {/* Modal actions */}
              <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
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
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
