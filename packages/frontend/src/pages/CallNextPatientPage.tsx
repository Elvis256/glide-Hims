import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import CallNextPanel from '../components/queue/CallNextPanel';
import { queueService } from '../services/queue';
import { Select } from '../components/ui';

const SERVICE_POINTS = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'triage', label: 'Triage' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'billing', label: 'Billing' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'injection', label: 'Injection' },
  { value: 'dressing', label: 'Dressing' },
  { value: 'vitals', label: 'Vitals' },
  { value: 'records', label: 'Records' },
  { value: 'registration', label: 'Registration' },
];

/**
 * Reception call station — a shell over the shared CallNextPanel with a
 * service-point selector. Queue management operations (transfer, requeue,
 * reorder) live in Queue Management (/queue), where they belong.
 */
export default function CallNextPatientPage() {
  const [servicePoint, setServicePoint] = useState(
    () => localStorage.getItem('callNext_servicePoint') || 'consultation',
  );

  return (
    <div className="relative">
      {/* Station controls — sits beside the panel's counter-number input */}
      <div className="absolute right-48 top-1 z-10 flex items-center gap-3">
        <Link
          to="/queue"
          className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline whitespace-nowrap"
          title="Transfer, requeue and reorder live in Queue Management"
        >
          <Settings2 className="w-4 h-4" /> Manage queue
        </Link>
        <Select
          value={servicePoint}
          onChange={(e) => {
            setServicePoint(e.target.value);
            localStorage.setItem('callNext_servicePoint', e.target.value);
          }}
          className="w-44"
        >
          {SERVICE_POINTS.map((sp) => (
            <option key={sp.value} value={sp.value}>{sp.label}</option>
          ))}
        </Select>
      </div>

      <CallNextPanel
        key={servicePoint}
        queueKey={['queue', 'waiting', servicePoint]}
        fetchQueue={() => queueService.getWaiting(servicePoint)}
        servicePoint={servicePoint}
        destinationNoun="counter"
        title="Call Next Patient"
        subtitle={SERVICE_POINTS.find((s) => s.value === servicePoint)?.label}
      />
    </div>
  );
}
