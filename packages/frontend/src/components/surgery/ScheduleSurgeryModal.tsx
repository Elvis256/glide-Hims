import { useState, useId } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, User, X, Loader2, Scissors } from 'lucide-react';
import { surgeryService, type Theatre } from '../../services/surgery';
import { patientsService, usersService } from '../../services';
import { getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';

interface Props {
  theatres: Theatre[];
  onClose: () => void;
  onScheduled: () => void;
}

export default function ScheduleSurgeryModal({ theatres, onClose, onScheduled }: Props) {
  const fid = useId();
  // This component is mounted only while the modal is showing.
  const dialogRef = useDialogA11y<HTMLDivElement>({
    open: true,
    onClose,
  });

  const facilityId = useFacilityId();
  const [patientSearch, setPatientSearch] = useState('');
  const [patient, setPatient] = useState<{ id: string; fullName: string } | null>(null);
  const [form, setForm] = useState({
    procedureName: '',
    procedureCode: '',
    diagnosis: '',
    surgeryType: 'major',
    priority: 'elective',
    theatreId: '',
    scheduledDate: new Date().toISOString().slice(0, 10),
    scheduledTime: '08:00',
    estimatedDurationMinutes: '60',
    leadSurgeonId: '',
    anesthesiaType: '',
  });

  const { data: results = [] } = useQuery({
    queryKey: ['surgery-patient-search', patientSearch],
    queryFn: async () => (await patientsService.search({ search: patientSearch, limit: 5 })).data || [],
    enabled: patientSearch.length >= 2 && !patient,
  });

  const { data: surgeons = [] } = useQuery({
    queryKey: ['users-doctors'],
    queryFn: async () => (await usersService.list({ role: 'Doctor' })).data,
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () =>
      surgeryService.cases.schedule({
        facilityId,
        patientId: patient!.id,
        theatreId: form.theatreId,
        procedureName: form.procedureName,
        procedureCode: form.procedureCode || undefined,
        diagnosis: form.diagnosis || undefined,
        surgeryType: form.surgeryType as any,
        priority: form.priority as any,
        scheduledDate: form.scheduledDate,
        scheduledTime: form.scheduledTime,
        estimatedDurationMinutes: Number(form.estimatedDurationMinutes),
        leadSurgeonId: form.leadSurgeonId,
        anesthesiaType: (form.anesthesiaType || undefined) as any,
      } as any),
    onSuccess: (res) => {
      toast.success(`Surgery scheduled — ${res.data?.caseNumber || ''}`);
      onScheduled();
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to schedule surgery')),
  });

  const valid =
    patient && form.procedureName && form.theatreId && form.leadSurgeonId &&
    form.scheduledDate && form.scheduledTime && Number(form.estimatedDurationMinutes) > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      ref={dialogRef}
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Scissors className="w-5 h-5 text-indigo-600" />
            Schedule Surgery
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Patient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
            {patient ? (
              <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <span className="flex items-center gap-2 font-medium">
                  <User className="w-4 h-4 text-indigo-600" />
                  {patient.fullName}
                </span>
                <button onClick={() => setPatient(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search by name or MRN..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg"
                />
                {results.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {results.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => setPatient({ id: p.id, fullName: p.fullName })}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50"
                      >
                        {p.fullName} <span className="text-gray-400 text-sm">{p.mrn}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${fid}-procedure`} className="block text-sm font-medium text-gray-700 mb-1">Procedure *</label>
              <input id={`${fid}-procedure`} value={form.procedureName} onChange={set('procedureName')} placeholder="e.g. Appendicectomy" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label htmlFor={`${fid}-procedure-code`} className="block text-sm font-medium text-gray-700 mb-1">Procedure Code</label>
              <input id={`${fid}-procedure-code`} value={form.procedureCode} onChange={set('procedureCode')} placeholder="ICD/CPT (optional)" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="col-span-2">
              <label htmlFor={`${fid}-indication-diagnosis`} className="block text-sm font-medium text-gray-700 mb-1">Indication / Diagnosis</label>
              <input id={`${fid}-indication-diagnosis`} value={form.diagnosis} onChange={set('diagnosis')} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label htmlFor={`${fid}-type`} className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select id={`${fid}-type`} value={form.surgeryType} onChange={set('surgeryType')} className="w-full px-3 py-2 border rounded-lg">
                <option value="major">Major</option>
                <option value="minor">Minor</option>
                <option value="day_case">Day case</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${fid}-priority`} className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
              <select id={`${fid}-priority`} value={form.priority} onChange={set('priority')} className="w-full px-3 py-2 border rounded-lg">
                <option value="elective">Elective</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${fid}-theatre`} className="block text-sm font-medium text-gray-700 mb-1">Theatre *</label>
              <select id={`${fid}-theatre`} value={form.theatreId} onChange={set('theatreId')} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select theatre...</option>
                {theatres.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                ))}
              </select>
              {theatres.length === 0 && (
                <p className="text-xs text-orange-600 mt-1">No theatres — add one from the Theatres tab first.</p>
              )}
            </div>
            <div>
              <label htmlFor={`${fid}-lead-surgeon`} className="block text-sm font-medium text-gray-700 mb-1">Lead Surgeon *</label>
              <select id={`${fid}-lead-surgeon`} value={form.leadSurgeonId} onChange={set('leadSurgeonId')} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select surgeon...</option>
                {surgeons.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${fid}-date`} className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input id={`${fid}-date`} type="date" value={form.scheduledDate} onChange={set('scheduledDate')} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor={`${fid}-time`} className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                <input id={`${fid}-time`} type="time" value={form.scheduledTime} onChange={set('scheduledTime')} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label htmlFor={`${fid}-duration-min`} className="block text-sm font-medium text-gray-700 mb-1">Duration (min) *</label>
                <input id={`${fid}-duration-min`} type="number" min="10" step="10" value={form.estimatedDurationMinutes} onChange={set('estimatedDurationMinutes')} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div>
              <label htmlFor={`${fid}-anesthesia`} className="block text-sm font-medium text-gray-700 mb-1">Anesthesia</label>
              <select id={`${fid}-anesthesia`} value={form.anesthesiaType} onChange={set('anesthesiaType')} className="w-full px-3 py-2 border rounded-lg">
                <option value="">To be decided</option>
                <option value="general">General</option>
                <option value="spinal">Spinal</option>
                <option value="epidural">Epidural</option>
                <option value="local">Local</option>
                <option value="regional">Regional</option>
                <option value="sedation">Sedation</option>
              </select>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!valid || mutation.isPending}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
