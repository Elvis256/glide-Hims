/**
 * Phase D1 — Mobile Money STK Push modal.
 * Shows while waiting for customer to approve on their phone, polls status every 3s.
 */
import { useEffect, useState, useCallback } from 'react';
import { Smartphone, Loader2, CheckCircle, XCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../services/api';
import { formatCurrency } from '../lib/currency';

export type MomoProvider = 'mtn' | 'airtel';

interface Props {
  saleId: string;
  amount: number;
  defaultPhone?: string;
  onSuccess: (transactionRef: string) => void;
  onClose: () => void;
}

/** Detect provider from UG prefix */
function detectProvider(phone: string): MomoProvider {
  const cleaned = phone.replace(/^\+?256/, '0').replace(/\s+/g, '');
  if (cleaned.startsWith('077') || cleaned.startsWith('078') || cleaned.startsWith('076')) {
    return 'mtn';
  }
  return 'airtel';
}

const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_S = 90;

export function MobileMoneyModal({ saleId, amount, defaultPhone = '', onSuccess, onClose }: Props) {
  const [phone, setPhone] = useState(defaultPhone);
  const [provider, setProvider] = useState<MomoProvider>(() => detectProvider(defaultPhone));
  const [phase, setPhase] = useState<'input' | 'waiting' | 'success' | 'failed'>('input');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState('');
  const [countdown, setCountdown] = useState(MAX_WAIT_S);
  const [submitting, setSubmitting] = useState(false);

  // Auto-detect provider when phone changes
  useEffect(() => {
    if (phone.length >= 3) {
      setProvider(detectProvider(phone));
    }
  }, [phone]);

  // Countdown timer while waiting
  useEffect(() => {
    if (phase !== 'waiting') return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Cancel transaction when countdown reaches 0 or component unmounts while waiting
  useEffect(() => {
    if (phase === 'waiting' && countdown === 0 && transactionId) {
      api.post(`/pos/sales/mobile-money/${transactionId}/cancel`).catch(() => {});
      setPhase('failed');
      setFailureReason('Timed out waiting for customer approval');
    }
  }, [countdown, phase, transactionId]);

  const handleCancel = useCallback(async () => {
    if (transactionId && phase === 'waiting') {
      await api.post(`/pos/sales/mobile-money/${transactionId}/cancel`).catch(() => {});
    }
    onClose();
  }, [transactionId, phase, onClose]);

  // Poll status every 3s while waiting
  useEffect(() => {
    if (phase !== 'waiting' || !transactionId) return;

    const poll = async () => {
      try {
        const res = await api.get(`/pos/sales/mobile-money/${transactionId}/status`);
        const { status, failureReason: reason } = res.data as {
          status: string;
          failureReason?: string;
        };
        if (status === 'success') {
          setPhase('success');
        } else if (status === 'failed' || status === 'timeout' || status === 'cancelled') {
          setPhase('failed');
          setFailureReason(reason || 'Payment was declined or cancelled');
        }
      } catch {
        // Network error during poll — keep waiting
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    poll(); // Immediate first poll
    return () => clearInterval(interval);
  }, [phase, transactionId]);

  const handleSubmit = async () => {
    if (!phone.trim()) {
      toast.error('Phone number is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/pos/sales/${saleId}/mobile-money`, {
        phone: phone.trim(),
        provider,
        amount,
      });
      const { transactionId: txId } = res.data as { transactionId: string };
      setTransactionId(txId);
      setCountdown(MAX_WAIT_S);
      setPhase('waiting');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to initiate Mobile Money payment'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setTransactionId(null);
    setFailureReason('');
    setCountdown(MAX_WAIT_S);
    setPhase('input');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-600" />
            Mobile Money Payment
          </h3>
          {phase !== 'waiting' && (
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="text-center">
          <span className="text-2xl font-bold text-blue-700">{formatCurrency(amount)}</span>
        </div>

        {/* Input phase */}
        {phase === 'input' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
              <input
                type="tel"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 0771234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
              <div className="grid grid-cols-2 gap-2">
                {(['mtn', 'airtel'] as MomoProvider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                      provider === p
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Auto-detected from prefix · 077/078 = MTN, 070/075 = Airtel
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting || !phone.trim()}
                className="flex-1 rounded-lg bg-blue-600 text-white py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                Send STK Push
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 rounded-lg border py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Waiting phase */}
        {phase === 'waiting' && (
          <div className="space-y-4 text-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              <p className="text-sm font-medium text-gray-800">
                Waiting for customer to approve on their phone...
              </p>
              <p className="text-xs text-gray-500">
                Sent to {phone} ({provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'})
              </p>
            </div>
            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-1000"
                style={{ width: `${(countdown / MAX_WAIT_S) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">{countdown}s remaining</p>
            <button
              onClick={handleCancel}
              className="text-xs text-red-500 hover:text-red-700 underline"
            >
              Cancel payment
            </button>
          </div>
        )}

        {/* Success phase */}
        {phase === 'success' && (
          <div className="space-y-4 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <p className="font-semibold text-gray-900">Payment Confirmed!</p>
            <p className="text-sm text-gray-500">The customer approved the payment on their phone.</p>
            <button
              onClick={() => onSuccess(transactionId || '')}
              className="w-full rounded-lg bg-green-600 text-white py-2 text-sm font-medium hover:bg-green-700"
            >
              Continue
            </button>
          </div>
        )}

        {/* Failed phase */}
        {phase === 'failed' && (
          <div className="space-y-4 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
            <p className="font-semibold text-gray-900">Payment Failed</p>
            {failureReason && <p className="text-sm text-gray-500">{failureReason}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleRetry}
                className="flex-1 rounded-lg bg-blue-600 text-white py-2 text-sm font-medium hover:bg-blue-700"
              >
                Retry
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 rounded-lg border py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Use Cash
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
