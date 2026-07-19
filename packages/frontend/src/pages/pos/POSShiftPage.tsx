import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Play,
  Square,
  DollarSign,
  User,
  Monitor,
  Loader2,
  CheckCircle,
  AlertCircle,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';
import { POSComplianceTools } from '../../components/pos/POSComplianceTools';
import { mapShift, type ShiftDisplay } from './shiftUtils';

export default function POSShiftPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [registerId, setRegisterId] = useState('');
  const [newRegisterName, setNewRegisterName] = useState('');
  const [newRegisterStoreId, setNewRegisterStoreId] = useState('');
  const [showNewRegister, setShowNewRegister] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingCashCount, setClosingCashCount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [showCloseForm, setShowCloseForm] = useState(false);

  // Current shift
  const { data: currentShift, isLoading: shiftLoading } = useQuery<ShiftDisplay | null>({
    queryKey: ['pos-current-shift', facilityId],
    queryFn: async () => {
      try {
        const res = await api.get('/pos/shifts/current');
        return res.data?.id ? mapShift(res.data) : null;
      } catch {
        return null;
      }
    },
  });

  // Registers to open a shift against
  const { data: registersData } = useQuery({
    queryKey: ['pos-registers', facilityId],
    queryFn: async () => {
      const res = await api.get('/pos/registers');
      return res.data;
    },
  });
  const registers = asList<any>(registersData);

  // Stores (needed to create a register on first-run setup)
  const { data: storesData } = useQuery({
    queryKey: ['pos-stores', facilityId],
    queryFn: async () => {
      const res = await api.get('/stores');
      return res.data;
    },
    enabled: showNewRegister || registers.length === 0,
  });
  const stores = asList<any>(storesData);

  // Shift history
  const { data: shiftsData, isLoading: historyLoading } = useQuery({
    queryKey: ['pos-shifts', facilityId],
    queryFn: async () => {
      const res = await api.get('/pos/shifts');
      return res.data;
    },
  });

  const shiftHistory = asList<any>(shiftsData).map(mapShift);
  const shiftOpen = currentShift && currentShift.status === 'open';

  // Create a register (first-run setup)
  const createRegisterMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/pos/registers', {
        name: newRegisterName.trim(),
        storeId: newRegisterStoreId,
      });
      return res.data;
    },
    onSuccess: (reg: any) => {
      queryClient.invalidateQueries({ queryKey: ['pos-registers'] });
      if (reg?.id) setRegisterId(reg.id);
      setShowNewRegister(false);
      setNewRegisterName('');
      toast.success('Register created');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to create register'));
    },
  });

  // Open shift
  const openShiftMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/pos/shifts/open', {
        registerId,
        openingBalance: parseFloat(openingBalance) || 0,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-current-shift'] });
      queryClient.invalidateQueries({ queryKey: ['pos-shifts'] });
      setOpeningBalance('');
      toast.success('Shift opened successfully');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to open shift'));
    },
  });

  // Close shift
  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/pos/shifts/close', {
        closingBalance: parseFloat(closingCashCount) || 0,
        notes: closingNotes || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-current-shift'] });
      queryClient.invalidateQueries({ queryKey: ['pos-shifts'] });
      setClosingCashCount('');
      setClosingNotes('');
      setShowCloseForm(false);
      toast.success('Shift closed successfully');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to close shift'));
    },
  });

  if (shiftLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shift Management</h1>
        <p className="text-sm text-gray-500">Open, close, and manage register shifts</p>
      </div>

      {/* Current Shift / Open Shift */}
      {!shiftOpen ? (
        /* Open Shift Form */
        <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <Play className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Open a New Shift</h2>
            <p className="text-sm text-gray-500">Start your register shift to begin processing sales</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Register</label>
              <select
                value={registerId}
                onChange={(e) => setRegisterId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a register…</option>
                {registers.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {!showNewRegister ? (
                <button
                  onClick={() => setShowNewRegister(true)}
                  className="mt-1 text-xs text-blue-600 hover:underline"
                >
                  {registers.length === 0 ? 'No registers yet — create one' : '+ New register'}
                </button>
              ) : (
                <div className="mt-2 space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <input
                    value={newRegisterName}
                    onChange={(e) => setNewRegisterName(e.target.value)}
                    placeholder="Register name (e.g. Till 1)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <select
                    value={newRegisterStoreId}
                    onChange={(e) => setNewRegisterStoreId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select the store it sells from…</option>
                    {stores.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => createRegisterMutation.mutate()}
                      disabled={createRegisterMutation.isPending || !newRegisterName.trim() || !newRegisterStoreId}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setShowNewRegister(false)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Opening Cash Balance</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => openShiftMutation.mutate()}
              disabled={openShiftMutation.isPending || !registerId}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {openShiftMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Open Shift
            </button>
          </div>
        </div>
      ) : currentShift ? (
        <>
          {/* Active Shift Details */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2">
                  <Monitor className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Active Shift</h2>
                  <p className="text-sm text-gray-500">{currentShift.registerName}</p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-500" />
                Active
              </span>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500">Cashier</p>
                <p className="mt-1 flex items-center gap-1 font-medium text-gray-900">
                  <User className="h-4 w-4 text-gray-400" />
                  {currentShift.cashierName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Opened At</p>
                <p className="mt-1 flex items-center gap-1 font-medium text-gray-900">
                  <Clock className="h-4 w-4 text-gray-400" />
                  {new Date(currentShift.openedAt).toLocaleTimeString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Opening Balance</p>
                <p className="mt-1 font-medium text-gray-900">
                  {formatCurrency(currentShift.openingBalance)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Sales Count</p>
                <p className="mt-1 font-medium text-gray-900">{currentShift.transactionCount}</p>
              </div>
            </div>

            {/* Running totals */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-green-50 p-3">
                <p className="text-xs text-green-600">Cash</p>
                <p className="text-lg font-bold text-green-700">
                  {formatCurrency(currentShift.cashSales)}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs text-blue-600">Mobile Money</p>
                <p className="text-lg font-bold text-blue-700">
                  {formatCurrency(currentShift.mobileMoneySales)}
                </p>
              </div>
              <div className="rounded-lg bg-purple-50 p-3">
                <p className="text-xs text-purple-600">Card</p>
                <p className="text-lg font-bold text-purple-700">
                  {formatCurrency(currentShift.cardSales)}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs text-amber-600">Total Sales</p>
                <p className="text-lg font-bold text-amber-700">
                  {formatCurrency(currentShift.totalSales)}
                </p>
              </div>
            </div>

            {/* Close Shift */}
            <div className="mt-6">
              {!showCloseForm ? (
                <button
                  onClick={() => setShowCloseForm(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  <Square className="h-4 w-4" />
                  Close Shift
                </button>
              ) : (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <h3 className="mb-3 font-semibold text-red-900">Close Shift</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Closing Cash Count
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={closingCashCount}
                        onChange={(e) => setClosingCashCount(e.target.value)}
                        placeholder="Count the cash in the register"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    {closingCashCount && (
                      <div className="rounded-lg bg-white p-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Expected cash</span>
                          <span className="font-medium">
                            {formatCurrency(
                              currentShift.openingBalance + currentShift.cashSales
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Actual count</span>
                          <span className="font-medium">
                            {formatCurrency(parseFloat(closingCashCount) || 0)}
                          </span>
                        </div>
                        <div className="mt-1 border-t pt-1">
                          <div className="flex justify-between text-sm font-semibold">
                            <span>Difference</span>
                            <span
                              className={
                                (parseFloat(closingCashCount) || 0) -
                                  (currentShift.openingBalance + currentShift.cashSales) >=
                                0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }
                            >
                              {formatCurrency(
                                (parseFloat(closingCashCount) || 0) -
                                  (currentShift.openingBalance + currentShift.cashSales)
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Notes (optional)
                      </label>
                      <textarea
                        value={closingNotes}
                        onChange={(e) => setClosingNotes(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        placeholder="Any notes about the shift..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => closeShiftMutation.mutate()}
                        disabled={closeShiftMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {closeShiftMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        Confirm Close
                      </button>
                      <button
                        onClick={() => setShowCloseForm(false)}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>

          {/* POS Compliance Tools (drawer events, X/Z reports) */}
          <POSComplianceTools
            shiftId={currentShift.id}
            shiftStatus={currentShift.status as 'open' | 'closed' | 'z_finalized'}
          />
        </>
      ) : null}

      {/* Shift History */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="font-semibold text-gray-900">Shift History</h3>
        </div>
        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : shiftHistory.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Calendar className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p>No shift history</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Cashier</th>
                  <th className="px-6 py-3">Register</th>
                  <th className="px-6 py-3 text-right">Opening</th>
                  <th className="px-6 py-3 text-right">Closing</th>
                  <th className="px-6 py-3 text-right">Difference</th>
                  <th className="px-6 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shiftHistory.map((shift) => {
                  const expected = shift.expectedBalance ?? shift.openingBalance + shift.cashSales;
                  const diff =
                    shift.closingBalance != null ? shift.closingBalance - expected : null;
                  return (
                    <tr key={shift.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-3 text-gray-900">
                        {new Date(shift.openedAt).toLocaleDateString()}
                        <span className="ml-1 text-xs text-gray-400">
                          {new Date(shift.openedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-900">{shift.cashierName}</td>
                      <td className="px-6 py-3 text-gray-600">{shift.registerName}</td>
                      <td className="px-6 py-3 text-right text-gray-900">
                        {formatCurrency(shift.openingBalance)}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-900">
                        {shift.closingBalance != null
                          ? formatCurrency(shift.closingBalance)
                          : '—'}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {diff != null ? (
                          <span
                            className={`font-medium ${
                              diff >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {diff >= 0 ? '+' : ''}
                            {formatCurrency(diff)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            shift.status === 'open'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {shift.status === 'open' ? 'Open' : 'Closed'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
