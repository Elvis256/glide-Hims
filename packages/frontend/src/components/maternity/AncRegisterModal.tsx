import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, User, X, Loader2 } from 'lucide-react';
import { maternityService, RiskLevel } from '../../services/maternity';
import { patientsService } from '../../services';
import { getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';

interface Props {
  onClose: () => void;
  onRegistered: () => void;
}

export default function AncRegisterModal({ onClose, onRegistered }: Props) {
  const facilityId = useFacilityId();
  const [patientSearch, setPatientSearch] = useState('');
  const [patient, setPatient] = useState<{ id: string; fullName: string } | null>(null);
  const [form, setForm] = useState({
    lmpDate: '',
    gravida: '1',
    para: '0',
    livingChildren: '',
    abortions: '',
    bloodGroup: '',
    rhPositive: 'unknown',
    riskLevel: RiskLevel.LOW as string,
    riskFactors: '',
    medicalHistory: '',
    allergies: '',
    partnerName: '',
    partnerPhone: '',
  });

  const { data: results = [] } = useQuery({
    queryKey: ['anc-patient-search', patientSearch],
    queryFn: async () => {
      const res = await patientsService.search({ search: patientSearch, limit: 5 });
      // ANC is for female patients; don't hard-filter (gender may be unset)
      return res.data || [];
    },
    enabled: patientSearch.length >= 2 && !patient,
  });

  const edd = form.lmpDate
    ? new Date(new Date(form.lmpDate).getTime() + 280 * 86400000).toLocaleDateString('en-GB')
    : null;

  const registerMutation = useMutation({
    mutationFn: () =>
      maternityService.anc.register({
        facilityId,
        patientId: patient!.id,
        lmpDate: form.lmpDate,
        gravida: Number(form.gravida),
        para: Number(form.para),
        livingChildren: form.livingChildren ? Number(form.livingChildren) : undefined,
        abortions: form.abortions ? Number(form.abortions) : undefined,
        bloodGroup: form.bloodGroup || undefined,
        rhPositive: form.rhPositive === 'unknown' ? undefined : form.rhPositive === 'yes',
        riskLevel: form.riskLevel as RiskLevel,
        riskFactors: form.riskFactors || undefined,
        medicalHistory: form.medicalHistory || undefined,
        allergies: form.allergies || undefined,
        partnerName: form.partnerName || undefined,
        partnerPhone: form.partnerPhone || undefined,
      }),
    onSuccess: (res) => {
      toast.success(`ANC registered — ${res.data?.ancNumber || ''}`);
      onRegistered();
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to register ANC')),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Register Antenatal Case</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Patient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
            {patient ? (
              <div className="flex items-center justify-between p-3 bg-pink-50 border border-pink-200 rounded-lg">
                <span className="flex items-center gap-2 font-medium">
                  <User className="w-4 h-4 text-pink-600" />
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LMP Date *</label>
              <input type="date" value={form.lmpDate} onChange={set('lmpDate')} className="w-full px-3 py-2 border rounded-lg" />
              {edd && <p className="text-xs text-pink-600 mt-1">EDD: {edd}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gravida *</label>
              <input type="number" min="1" value={form.gravida} onChange={set('gravida')} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Para *</label>
              <input type="number" min="0" value={form.para} onChange={set('para')} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Living Children</label>
              <input type="number" min="0" value={form.livingChildren} onChange={set('livingChildren')} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Abortions</label>
              <input type="number" min="0" value={form.abortions} onChange={set('abortions')} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
              <select value={form.bloodGroup} onChange={set('bloodGroup')} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Unknown</option>
                {['A', 'B', 'AB', 'O'].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rhesus</label>
              <select value={form.rhPositive} onChange={set('rhPositive')} className="w-full px-3 py-2 border rounded-lg">
                <option value="unknown">Unknown</option>
                <option value="yes">Positive</option>
                <option value="no">Negative</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Risk Level</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setForm((f) => ({ ...f, riskLevel: r }))}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium capitalize ${
                      form.riskLevel === r
                        ? r === 'high'
                          ? 'bg-red-100 border-red-400 text-red-700'
                          : r === 'medium'
                            ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                            : 'bg-green-100 border-green-400 text-green-700'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {form.riskLevel !== 'low' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Risk Factors</label>
              <textarea value={form.riskFactors} onChange={set('riskFactors')} rows={2} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. previous C/S, hypertension, age > 35..." />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medical History</label>
              <textarea value={form.medicalHistory} onChange={set('medicalHistory')} rows={2} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
              <textarea value={form.allergies} onChange={set('allergies')} rows={2} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Partner / Next of Kin</label>
              <input value={form.partnerName} onChange={set('partnerName')} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Partner Phone</label>
              <input value={form.partnerPhone} onChange={set('partnerPhone')} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => registerMutation.mutate()}
            disabled={!patient || !form.lmpDate || !form.gravida || registerMutation.isPending}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2"
          >
            {registerMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Register ANC
          </button>
        </div>
      </div>
    </div>
  );
}
