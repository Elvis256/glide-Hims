import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { emergencyService } from '../../services/emergency';
import { billingService } from '../../services/billing';
import { servicesService } from '../../services/services';
import { getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import {
  Receipt,
  Search,
  User,
  Package,
  CreditCard,
  Plus,
  Minus,
  FileText,
  DollarSign,
  Clock,
  Loader2,
} from 'lucide-react';
import { asList } from '../../utils/unwrapResponse';

interface BillingItem {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
}

interface EmergencyPackage {
  id: string;
  name: string;
  items: string[];
  price: number;
}

type PatientType = { id: string; name: string; age: number; mrn: string; arrivalTime: string; complaint: string; encounterId?: string };

export default function EmergencyBillingPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const { data: casesData } = useQuery({
    queryKey: ['emergency-cases-active-billing', facilityId],
    queryFn: async () => {
      const response = await emergencyService.getCases({ facilityId, active: 'true', limit: 100 });
      return response.data;
    },
    enabled: !!facilityId,
  });

  // Only cases with a linked patient record can be billed — an invoice needs a
  // real patientId, not a case id.
  const patients: PatientType[] = useMemo(() => {
    return asList(casesData)
      .filter((c) => c.encounter?.patient?.id)
      .map((c) => ({
        id: c.encounter!.patient!.id,
        name: c.encounter!.patient!.fullName,
        age: c.encounter?.patient?.dateOfBirth
          ? Math.floor((Date.now() - new Date(c.encounter.patient.dateOfBirth).getTime()) / 31557600000)
          : 0,
        mrn: c.encounter?.patient?.mrn || c.caseNumber,
        arrivalTime: new Date(c.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        complaint: c.chiefComplaint,
        encounterId: c.encounterId,
      }));
  }, [casesData]);

  const { data: servicesList = [] } = useQuery({
    queryKey: ['services-list'],
    queryFn: () => servicesService.list(),
  });

  const edServices = useMemo(() =>
    servicesList.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category?.name || s.department || '',
      price: s.basePrice,
    })),
  [servicesList]);

  const { data: packagesList = [] } = useQuery({
    queryKey: ['service-packages'],
    queryFn: () => servicesService.packages.list(),
  });

  const emergencyPackages: EmergencyPackage[] = useMemo(() =>
    packagesList.map((p) => ({
      id: p.id,
      name: p.name,
      items: p.includedServices.map((s) => s.service?.name || s.serviceId),
      price: p.packagePrice,
    })),
  [packagesList]);

  const [selectedPatient, setSelectedPatient] = useState<PatientType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [billingItems, setBillingItems] = useState<BillingItem[]>([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const filteredServices = useMemo(() => {
    if (!searchTerm) return edServices;
    return edServices.filter(s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, edServices]);

  const addItem = (service: typeof edServices[0]) => {
    const existing = billingItems.find(i => i.id === service.id);
    if (existing) {
      setBillingItems(prev => prev.map(i => 
        i.id === service.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setBillingItems(prev => [...prev, { ...service, quantity: 1 }]);
    }
  };

  const removeItem = (id: string) => {
    setBillingItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item && item.quantity > 1) {
        return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const addPackage = (pkg: EmergencyPackage) => {
    setBillingItems(prev => [...prev, {
      id: pkg.id,
      name: pkg.name,
      category: 'Package',
      price: pkg.price,
      quantity: 1,
    }]);
  };

  const subtotal = useMemo(() =>
    billingItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  , [billingItems]);

  const deposit = parseFloat(depositAmount) || 0;
  const total = subtotal;
  const balance = total - deposit;

  // Creates the invoice, and if a deposit was taken records it as a real
  // payment against that invoice — so the cashier ledger and the patient's
  // balance both reflect what was actually collected.
  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatient || billingItems.length === 0) return null;
      const invoice = await billingService.invoices.create({
        patientId: selectedPatient.id,
        encounterId: selectedPatient.encounterId,
        items: billingItems.map((item) => ({
          serviceCode: item.id,
          description: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        notes: 'Emergency department bill',
      });
      let depositRecorded = 0;
      if (deposit > 0 && invoice?.id) {
        depositRecorded = Math.min(deposit, total);
        await billingService.payments.record(invoice.id, {
          amount: depositRecorded,
          paymentMethod,
          notes: 'ED deposit',
        });
      }
      return { invoice, depositRecorded };
    },
    onSuccess: (result) => {
      if (!result) return;
      queryClient.invalidateQueries({ queryKey: ['emergency-cases-active-billing'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setBillingItems([]);
      setSelectedPatient(null);
      setDepositAmount('');
      const inv = result.invoice;
      toast.success(
        result.depositRecorded > 0
          ? `Invoice ${inv?.invoiceNumber || ''} created — deposit ${formatCurrency(result.depositRecorded)} recorded, balance ${formatCurrency(Math.max(total - result.depositRecorded, 0))}`
          : `Invoice ${inv?.invoiceNumber || ''} created — payable at cashier`,
      );
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create the bill')),
  });

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Receipt className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Emergency Billing</h1>
            <p className="text-sm text-gray-500">Quick billing for ED patients</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        {/* Left Panel - Patient Selection & Services */}
        <div className="col-span-2 flex flex-col gap-4 min-h-0">
          {/* Patient Selection */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              Select ED Patient
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {patients.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-4 text-gray-400">
                  <User className="w-8 h-8 mb-2" />
                  <p className="text-sm">No ED patients available</p>
                </div>
              ) : (
                patients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className={`flex-shrink-0 p-3 rounded-lg border text-left transition-all ${
                      selectedPatient?.id === patient.id
                        ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <p className="font-medium text-sm">{patient.name}</p>
                    <p className="text-xs text-gray-500">{patient.mrn} • {patient.age}y</p>
                    <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                      <Clock className="w-3 h-3" />
                      {patient.arrivalTime}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Quick Packages */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-500" />
              Emergency Packages
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {emergencyPackages.length === 0 ? (
                <div className="col-span-4 flex flex-col items-center justify-center py-4 text-gray-400">
                  <Package className="w-8 h-8 mb-2" />
                  <p className="text-sm">No packages available</p>
                </div>
              ) : (
                emergencyPackages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => addPackage(pkg)}
                    disabled={!selectedPatient}
                    className="p-3 rounded-lg border hover:bg-gray-50 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <p className="font-medium text-sm">{pkg.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{pkg.items.length} items</p>
                    <p className="text-sm font-semibold text-green-600 mt-1">{formatCurrency(pkg.price)}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Services */}
          <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex items-center gap-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                ED Services
              </h3>
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search services..."
                  className="w-full pl-10 pr-4 py-1.5 border rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredServices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center text-gray-400">
                          <FileText className="w-8 h-8 mb-2" />
                          <p className="text-sm">No services available</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredServices.map((service) => (
                      <tr key={service.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-medium">{service.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{service.category}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(service.price)}</td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => addItem(service)}
                            disabled={!selectedPatient}
                            className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200 disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Panel - Bill Summary */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Bill Items */}
          <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold">Bill Summary</h3>
              {selectedPatient && (
                <p className="text-sm text-gray-500">{selectedPatient.name}</p>
              )}
            </div>
            <div className="flex-1 overflow-auto p-4">
              {billingItems.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <Receipt className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">No items added</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {billingItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(item.price)} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{formatCurrency(item.price * item.quantity)}</span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-red-500 hover:bg-red-100 rounded"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="border-t p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Deposit & Payment */}
          <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Collect Deposit</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="card">Credit/Debit Card</option>
              </select>
            </div>
            {deposit > 0 && (
              <div className="flex justify-between p-2 bg-blue-50 rounded">
                <span className="text-sm text-blue-700">Balance Due</span>
                <span className="font-bold text-blue-700">{formatCurrency(Math.max(balance, 0))}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <button
            onClick={() => createInvoiceMutation.mutate()}
            disabled={!selectedPatient || billingItems.length === 0 || createInvoiceMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {createInvoiceMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            {deposit > 0 ? 'Create Bill & Record Deposit' : 'Create Bill'}
          </button>
          <p className="text-xs text-gray-500 text-center -mt-2">
            Insurance and further payments are handled at the cashier.
          </p>
        </div>
      </div>
    </div>
  );
}
