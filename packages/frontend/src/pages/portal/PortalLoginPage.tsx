import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Smartphone, ShieldCheck, Loader2 } from 'lucide-react';
import { portalApi, portalAuth } from './portal-api';

export default function PortalLoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      toast.error('Enter a valid phone number');
      return;
    }
    try {
      setBusy(true);
      await portalApi.post('/portal/otp/request', { phone });
      toast.success('A 6-digit code was sent to your phone');
      setStep('otp');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not send code');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error('Enter the 6-digit code');
      return;
    }
    try {
      setBusy(true);
      const { data } = await portalApi.post('/portal/otp/verify', { phone, code });
      portalAuth.setSession(data.patient);
      toast.success(`Welcome ${data.patient.fullName}`);
      navigate('/portal/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-emerald-600 text-white p-3 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Patient Portal</h1>
            <p className="text-sm text-gray-500">Sign in to view your records</p>
          </div>
        </div>

        {step === 'phone' && (
          <form onSubmit={requestOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone number registered with the hospital
              </label>
              <div className="flex items-center border rounded-lg px-3 focus-within:ring-2 focus-within:ring-emerald-500">
                <Smartphone className="w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0772XXXXXX"
                  className="flex-1 px-3 py-3 outline-none text-sm"
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                We'll text you a 6-digit code. No password needed.
              </p>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Send Verification Code
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enter the 6-digit code sent to {phone}
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Verify & Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setCode('');
              }}
              className="w-full text-xs text-gray-600 underline"
            >
              ← Use a different phone
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          Trouble signing in? Visit the hospital reception to update your phone.
        </p>
      </div>
    </div>
  );
}
