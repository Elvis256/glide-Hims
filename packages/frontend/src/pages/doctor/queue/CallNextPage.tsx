import CallNextPanel from '../../../components/queue/CallNextPanel';
import { queueService } from '../../../services/queue';

/**
 * Doctor call station — a thin shell over the shared CallNextPanel.
 * Queue source: patients assigned to this doctor + unassigned at consultation.
 */
export default function CallNextPage() {
  return (
    <CallNextPanel
      queueKey={['queue', 'doctor-queue']}
      fetchQueue={() => queueService.getDoctorQueue(false)}
      servicePoint="consultation"
      destinationNoun="room"
      title="Call Next Patient"
    />
  );
}
