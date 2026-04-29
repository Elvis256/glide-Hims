import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Receipt,
  FlaskConical,
  Pill,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { portalApi, portalAuth } from './portal-api';
import { formatCurrency } from '../../lib/currency';

type Tab = 'appointments' | 'invoices' | 'lab' | 'rx';

export default function PortalDashboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('appointments');
  const patient = portalAuth.getPatient();

  useEffect(() => {
    if (!portalAuth.isLoggedIn()) navigate('/portal/login', { replace: true });
  }, [navigate]);

  const appointments = useQuery({
    queryKey: ['portal', 'appointments'],
    queryFn: () => portalApi.get('/portal/appointments').then((r) => r.data),
    enabled: tab === 'appointments',
  });
  const invoices = useQuery({
    queryKey: ['portal', 'invoices'],
    queryFn: () => portalApi.get('/portal/invoices').then((r) => r.data),
    enabled: tab === 'invoices',
  });
  const lab = useQuery({
    queryKey: ['portal', 'lab'],
    queryFn: () => portalApi.get('/portal/lab-results').then((r) => r.data),
    enabled: tab === 'lab',
  });
  const rx = useQuery({
    queryKey: ['portal', 'rx'],
    queryFn: () => portalApi.get('/portal/prescriptions').then((r) => r.data),
    enabled: tab === 'rx',
  });

  const signOut = () => {
    portalAuth.signOut();
    navigate('/portal/login', { replace: true });
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'invoices', label: 'Bills', icon: Receipt },
    { id: 'lab', label: 'Lab Results', icon: FlaskConical },
    { id: 'rx', label: 'Prescriptions', icon: Pill },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 text-white p-2 rounded-lg">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 leading-tight">
                {patient?.fullName || 'Patient'}
              </p>
              <p className="text-xs text-gray-500">MRN: {patient?.mrn}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-gray-600 hover:text-red-600 flex items-center gap-1"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
        <div className="max-w-4xl mx-auto px-4 flex overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 whitespace-nowrap ${
                  tab === t.id
                    ? 'border-emerald-600 text-emerald-700 font-medium'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {tab === 'appointments' && (
          <Section loading={appointments.isLoading} empty={!appointments.data?.length} emptyText="No appointments yet">
            {appointments.data?.map((a: any) => (
              <Card key={a.id} title={a.type} status={a.status}>
                <p className="text-sm text-gray-600">
                  {new Date(a.date).toLocaleDateString()} at {a.startTime}
                </p>
                {a.reason && <p className="text-sm mt-1">Reason: {a.reason}</p>}
              </Card>
            ))}
          </Section>
        )}

        {tab === 'invoices' && (
          <Section loading={invoices.isLoading} empty={!invoices.data?.length} emptyText="No invoices yet">
            {invoices.data?.map((i: any) => (
              <Card key={i.id} title={`Invoice ${i.number}`} status={i.status}>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Total</p>
                    <p className="font-medium">{formatCurrency(i.total)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Paid</p>
                    <p className="font-medium text-green-700">{formatCurrency(i.paid)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Balance</p>
                    <p className="font-medium text-red-700">{formatCurrency(i.balance)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </Section>
        )}

        {tab === 'lab' && (
          <Section loading={lab.isLoading} empty={!lab.data?.length} emptyText="No released lab results">
            {lab.data?.map((s: any) => (
              <Card key={s.id} title={s.testName || s.sampleNumber} status={s.status}>
                <p className="text-xs text-gray-500 mb-2">
                  Released: {s.releasedAt ? new Date(s.releasedAt).toLocaleString() : '—'}
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="py-1">Parameter</th>
                      <th className="py-1">Value</th>
                      <th className="py-1">Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(s.results || []).map((r: any) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-1">{r.parameter}</td>
                        <td className={`py-1 font-medium ${r.flag !== 'NORMAL' ? 'text-red-600' : ''}`}>
                          {r.value} {r.unit}
                        </td>
                        <td className="py-1 text-xs text-gray-500">{r.referenceRange || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}
          </Section>
        )}

        {tab === 'rx' && (
          <Section loading={rx.isLoading} empty={!rx.data?.length} emptyText="No prescriptions">
            {rx.data?.map((p: any) => (
              <Card key={p.id} title={`Prescription ${p.number}`} status={p.status}>
                <ul className="text-sm space-y-1">
                  {(p.items || []).map((it: any, idx: number) => (
                    <li key={idx} className="border-l-2 border-emerald-300 pl-2">
                      <span className="font-medium">{it.drug}</span> — {it.dose}, {it.frequency}, for {it.duration}
                      {it.instructions && (
                        <span className="text-xs text-gray-500 block">↳ {it.instructions}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({
  loading,
  empty,
  emptyText,
  children,
}: {
  loading: boolean;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (loading) return <p className="text-center text-gray-400 py-8">Loading...</p>;
  if (empty) return <p className="text-center text-gray-400 py-8">{emptyText}</p>;
  return <div className="space-y-3">{children}</div>;
}

function Card({
  title,
  status,
  children,
}: {
  title: string;
  status?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {status && (
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full uppercase">
            {status}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
