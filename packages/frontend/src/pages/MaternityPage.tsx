import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useFacilityId } from '../lib/facility';
import PartographPanel from '../components/maternity/PartographPanel';
import AncRegisterModal from '../components/maternity/AncRegisterModal';
import AncVisitModal from '../components/maternity/AncVisitModal';
import AdmitLabourModal from '../components/maternity/AdmitLabourModal';
import DeliveryModal from '../components/maternity/DeliveryModal';
import EpiTab from '../components/maternity/EpiTab';
import PncTab from '../components/maternity/PncTab';
import { maternityService } from '../services/maternity';
import {
  Baby,
  Calendar,
  Heart,
  Users,
  Activity,
  Plus,
  ChevronRight,
  Syringe,
  HeartHandshake,
  CheckCircle,
} from 'lucide-react';

interface Registration {
  id: string;
  ancNumber: string;
  patient: { id: string; fullName: string; mrn: string };
  gravida: number;
  para: number;
  lmpDate: string;
  edd: string;
  riskLevel: 'low' | 'medium' | 'high';
  status: string;
  currentGestationalAge: number;
}

interface Dashboard {
  activeRegistrations: number;
  dueSoonCount: number;
  activeLaboursCount: number;
  activeLabours: any[];
  deliveriesThisMonth: number;
  highRiskCount: number;
}

const riskColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

const statusColors: Record<string, string> = {
  active: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  miscarriage: 'bg-gray-100 text-gray-800',
  stillbirth: 'bg-gray-100 text-gray-800',
};

export default function MaternityPage() {
  const facilityId = useFacilityId();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'anc' | 'labour' | 'pnc' | 'epi'>('dashboard');
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [partographLabourId, setPartographLabourId] = useState<string | null>(null);
  const [activeLabours, setActiveLabours] = useState<any[]>([]);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showVisitHistory, setShowVisitHistory] = useState(false);
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [deliveryLabour, setDeliveryLabour] = useState<any | null>(null);

  // ANC visit history for the open registration panel
  const { data: visitHistory = [] } = useQuery({
    queryKey: ['anc-visits', selectedRegistration?.id],
    queryFn: async () =>
      (await maternityService.anc.getVisits(selectedRegistration!.id)).data,
    enabled: !!selectedRegistration && showVisitHistory,
  });

  useEffect(() => {
    loadDashboard();
    loadRegistrations();
    loadActiveLabours();
  }, []);

  const loadActiveLabours = async () => {
    try {
      const response = await api.get(`/maternity/labour/active?facilityId=${facilityId}`);
      setActiveLabours(response.data || []);
    } catch (err) {
      console.error('Error loading active labours:', err);
    }
  };

  const loadDashboard = async () => {
    try {
      const response = await api.get(`/maternity/dashboard?facilityId=${facilityId}`);
      setDashboard(response.data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    }
  };

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/maternity/anc/registrations?facilityId=${facilityId}&status=active`
      );
      setRegistrations(response.data || []);
    } catch (err) {
      console.error('Error loading registrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getGestationalAgeDisplay = (weeks: number) => {
    if (weeks < 0) return 'N/A';
    const w = Math.floor(weeks);
    return `${w} weeks`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maternity / Antenatal</h1>
          <p className="text-gray-500 text-sm">ANC registration, visits, and labour management</p>
        </div>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="bg-pink-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-pink-700"
        >
          <Plus className="w-4 h-4" />
          Register ANC
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            { id: 'anc', label: 'ANC Register', icon: Users },
            { id: 'labour', label: 'Labour Ward', icon: Baby },
            { id: 'pnc', label: 'Postnatal', icon: HeartHandshake },
            { id: 'epi', label: 'Immunization', icon: Syringe },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-pink-500 text-pink-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && !dashboard && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading dashboard...</p>
        </div>
      )}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-pink-500">
              <div className="text-sm text-gray-500">Active ANC</div>
              <div className="text-3xl font-bold text-pink-600">{dashboard.activeRegistrations}</div>
              <div className="text-xs text-gray-400">Registered patients</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
              <div className="text-sm text-gray-500">Due Soon</div>
              <div className="text-3xl font-bold text-orange-600">{dashboard.dueSoonCount}</div>
              <div className="text-xs text-gray-400">Within 30 days</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="text-sm text-gray-500">High Risk</div>
              <div className="text-3xl font-bold text-red-600">{dashboard.highRiskCount}</div>
              <div className="text-xs text-gray-400">Needs attention</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-500">Deliveries (Month)</div>
              <div className="text-3xl font-bold text-green-600">{dashboard.deliveriesThisMonth}</div>
              <div className="text-xs text-gray-400">This month</div>
            </div>
          </div>

          {/* Active Labours */}
          {dashboard.activeLaboursCount > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b bg-pink-50">
                <h3 className="font-semibold text-pink-800 flex items-center gap-2">
                  <Baby className="w-5 h-5" />
                  Active Labour ({dashboard.activeLaboursCount})
                </h3>
              </div>
              <div className="divide-y">
                {dashboard.activeLabours.map((l: any) => (
                  <button
                    key={l.id}
                    onClick={() => setPartographLabourId(l.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 text-left"
                  >
                    <div>
                      <div className="font-medium">
                        {l.registration?.patient?.fullName}
                      </div>
                      <div className="text-sm text-gray-500">
                        ANC: {l.registration?.ancNumber} • Admitted: {formatDate(l.admissionTime)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          Dilation: {l.cervicalDilation || 0} cm
                        </div>
                        <div className="text-xs text-gray-500">{l.status}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {dashboard.activeLaboursCount === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <Baby className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No active labours at the moment</p>
            </div>
          )}
        </div>
      )}

      {/* ANC Register Tab */}
      {activeTab === 'anc' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : registrations.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No active ANC registrations</p>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="mt-4 text-pink-600 hover:text-pink-700"
              >
                Register a patient
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow divide-y">
              {registrations.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedRegistration(r)}
                  className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                      <Heart className="w-5 h-5 text-pink-600" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {r.patient?.fullName}
                      </div>
                      <div className="text-sm text-gray-500">
                        ANC: {r.ancNumber} • G{r.gravida}P{r.para}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {getGestationalAgeDisplay(r.currentGestationalAge)}
                      </div>
                      <div className="text-xs text-gray-500">EDD: {formatDate(r.edd)}</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${riskColors[r.riskLevel]}`}>
                      {r.riskLevel}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Labour Ward Tab */}
      {activeTab === 'labour' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b bg-pink-50 flex items-center justify-between">
            <h3 className="font-semibold text-pink-800 flex items-center gap-2">
              <Baby className="w-5 h-5" />
              Labour Ward — active labours
            </h3>
            <button
              onClick={loadActiveLabours}
              className="text-sm text-pink-700 hover:underline"
            >
              Refresh
            </button>
          </div>
          {activeLabours.length === 0 ? (
            <div className="p-12 text-center">
              <Baby className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No active labours at the moment</p>
              <p className="text-sm text-gray-400 mt-2">
                Admitted labours appear here with their partographs
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {activeLabours.map((l: any) => (
                <div key={l.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <button onClick={() => setPartographLabourId(l.id)} className="flex-1 text-left">
                    <div className="font-medium">{l.registration?.patient?.fullName}</div>
                    <div className="text-sm text-gray-500">
                      {l.labourNumber} • Admitted: {formatDate(l.admissionTime)}
                    </div>
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        Dilation: {l.cervicalDilation || 0} cm
                      </div>
                      <div className="text-xs text-gray-500">
                        {String(l.status).replace(/_/g, ' ')}
                      </div>
                    </div>
                    <button
                      onClick={() => setPartographLabourId(l.id)}
                      className="rounded bg-pink-100 px-2 py-1 text-xs font-medium text-pink-700 hover:bg-pink-200"
                    >
                      Partograph
                    </button>
                    <button
                      onClick={() => setDeliveryLabour(l)}
                      className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                    >
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      Delivery
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Postnatal Tab */}
      {activeTab === 'pnc' && <PncTab />}

      {/* Immunization Tab */}
      {activeTab === 'epi' && <EpiTab />}

      {/* Partograph slide-over */}
      {partographLabourId && (
        <PartographPanel
          labourId={partographLabourId}
          onClose={() => {
            setPartographLabourId(null);
            loadDashboard();
            loadActiveLabours();
          }}
        />
      )}

      {/* Registration Detail Side Panel */}
      {selectedRegistration && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedRegistration(null)} />
          <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">ANC Details</h2>
              <button
                onClick={() => setSelectedRegistration(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center">
                  <Heart className="w-8 h-8 text-pink-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">
                    {selectedRegistration.patient?.fullName}
                  </h3>
                  <p className="text-gray-500">MRN: {selectedRegistration.patient?.mrn}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">ANC Number</div>
                  <div className="font-medium font-mono">{selectedRegistration.ancNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Risk Level</div>
                  <span className={`inline-block mt-1 px-2 py-1 rounded text-sm ${riskColors[selectedRegistration.riskLevel]}`}>
                    {selectedRegistration.riskLevel}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Gravida/Para</div>
                  <div className="font-medium">
                    G{selectedRegistration.gravida}P{selectedRegistration.para}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Gestational Age</div>
                  <div className="font-medium">
                    {getGestationalAgeDisplay(selectedRegistration.currentGestationalAge)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">LMP Date</div>
                  <div className="font-medium">{formatDate(selectedRegistration.lmpDate)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">EDD</div>
                  <div className="font-medium">{formatDate(selectedRegistration.edd)}</div>
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                <button
                  onClick={() => setShowVisitModal(true)}
                  className="w-full py-2 bg-pink-600 text-white rounded hover:bg-pink-700 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Record ANC Visit
                </button>
                <button
                  onClick={() => setShowVisitHistory((v) => !v)}
                  className="w-full py-2 border border-pink-300 text-pink-600 rounded hover:bg-pink-50 flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  {showVisitHistory ? 'Hide Visit History' : 'View Visit History'}
                </button>
                <button
                  onClick={() => setShowAdmitModal(true)}
                  className="w-full py-2 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Baby className="w-4 h-4" />
                  Admit to Labour
                </button>
              </div>

              {showVisitHistory && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Visit History</h4>
                  {visitHistory.length === 0 ? (
                    <p className="text-sm text-gray-400">No visits recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {visitHistory.map((v: any) => (
                        <div key={v.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                          <div className="flex justify-between font-medium text-gray-900">
                            <span>{new Date(v.visitDate).toLocaleDateString('en-GB')}</span>
                            <span>{v.gestationalAge} wks</span>
                          </div>
                          <p className="text-gray-600 mt-1">
                            {[
                              v.weight != null && `Wt ${v.weight}kg`,
                              v.bpSystolic != null && `BP ${v.bpSystolic}/${v.bpDiastolic}`,
                              v.fundalHeight != null && `FH ${v.fundalHeight}cm`,
                              v.fetalHeartRate != null && `FHR ${v.fetalHeartRate}`,
                              v.hemoglobin != null && `Hb ${v.hemoglobin}`,
                            ].filter(Boolean).join(' · ') || '—'}
                          </p>
                          {(v.urineProtein || v.edema) && (
                            <p className="text-xs font-medium text-red-600 mt-1">
                              {[v.urineProtein && 'Proteinuria', v.edema && 'Oedema'].filter(Boolean).join(', ')}
                            </p>
                          )}
                          {v.plan && <p className="text-xs text-gray-500 mt-1">Plan: {v.plan}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Register ANC */}
      {showRegisterModal && (
        <AncRegisterModal
          onClose={() => setShowRegisterModal(false)}
          onRegistered={() => {
            loadRegistrations();
            loadDashboard();
          }}
        />
      )}

      {/* Record ANC visit */}
      {showVisitModal && selectedRegistration && (
        <AncVisitModal
          registrationId={selectedRegistration.id}
          gestationalAge={selectedRegistration.currentGestationalAge}
          onClose={() => setShowVisitModal(false)}
          onSaved={() => {
            setShowVisitHistory(true);
            loadRegistrations();
          }}
        />
      )}

      {/* Admit to labour */}
      {showAdmitModal && selectedRegistration && (
        <AdmitLabourModal
          registrationId={selectedRegistration.id}
          patientName={selectedRegistration.patient?.fullName || ''}
          gestationalAge={selectedRegistration.currentGestationalAge}
          onClose={() => setShowAdmitModal(false)}
          onAdmitted={(labourId) => {
            setSelectedRegistration(null);
            loadDashboard();
            loadActiveLabours();
            loadRegistrations();
            setActiveTab('labour');
            setPartographLabourId(labourId);
          }}
        />
      )}

      {/* Record delivery + babies */}
      {deliveryLabour && (
        <DeliveryModal
          labourId={deliveryLabour.id}
          patientName={deliveryLabour.registration?.patient?.fullName || ''}
          onClose={() => setDeliveryLabour(null)}
          onFinished={() => {
            loadDashboard();
            loadActiveLabours();
            loadRegistrations();
          }}
        />
      )}
    </div>
  );
}
