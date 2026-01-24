import { useState, useEffect } from 'react';
import api from '../services/api';

interface TreatmentPlan {
  id: string;
  planNumber: string;
  status: string;
  type: string;
  title: string;
  objectives: string[];
  startDate: string;
  endDate: string;
  patient: {
    fullName: string;
    mrn: string;
  };
  primaryProvider?: { fullName: string };
  diagnosis?: string;
  medications: Array<{
    drugName: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
  interventions: Array<{
    type: string;
    description: string;
    frequency: string;
  }>;
  goals: Array<{
    description: string;
    targetDate: string;
    status: string;
  }>;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  on_hold: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
  discontinued: 'bg-red-100 text-red-800',
  revised: 'bg-purple-100 text-purple-800',
};

const typeLabels: Record<string, string> = {
  acute: 'Acute Care',
  chronic: 'Chronic Disease',
  preventive: 'Preventive',
  palliative: 'Palliative',
  rehabilitation: 'Rehabilitation',
  mental_health: 'Mental Health',
  surgical: 'Surgical',
  maternity: 'Maternity',
  pediatric: 'Pediatric',
};

export default function TreatmentPlansPage() {
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<TreatmentPlan | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('active');

  useEffect(() => {
    loadPlans();
  }, [statusFilter]);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const response = await api.get('/treatment-plans', { params });
      setPlans(response.data);
    } catch (error) {
      console.error('Failed to load treatment plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/treatment-plans/${id}`, { status });
      loadPlans();
      if (selectedPlan?.id === id) {
        setSelectedPlan({ ...selectedPlan, status });
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const addProgress = async (id: string) => {
    const note = prompt('Enter progress note:');
    if (note) {
      try {
        await api.post(`/treatment-plans/${id}/progress`, {
          progressNote: note,
          recordedBy: 'Current User',
          vitalSigns: {},
        });
        alert('Progress recorded');
      } catch (error) {
        console.error('Failed to record progress:', error);
      }
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Treatment Plans</h1>
          <p className="text-gray-600">Manage patient treatment plans and care pathways</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          + New Treatment Plan
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['', 'draft', 'active', 'on_hold', 'completed', 'discontinued'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1 rounded-lg text-sm ${
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === '' ? 'All' : status.replace(/_/g, ' ').toUpperCase()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plans List */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : plans.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No treatment plans found</div>
          ) : (
            <div className="divide-y">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${
                    selectedPlan?.id === plan.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedPlan(plan)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-blue-600">{plan.planNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${statusColors[plan.status]}`}>
                          {plan.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                      <div className="font-medium">{plan.title}</div>
                      <div className="text-sm text-gray-600">
                        {plan.patient?.fullName} • {plan.patient?.mrn}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {typeLabels[plan.type] || plan.type} •{' '}
                        {new Date(plan.startDate).toLocaleDateString()} -{' '}
                        {plan.endDate ? new Date(plan.endDate).toLocaleDateString() : 'Ongoing'}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {plan.goals && (
                        <span className="text-xs text-gray-500">
                          {plan.goals.filter((g) => g.status === 'achieved').length}/{plan.goals.length} goals
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plan Details */}
        <div className="bg-white rounded-lg shadow h-fit sticky top-4">
          {selectedPlan ? (
            <div>
              <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-lg">Plan Details</h2>
                  <button
                    onClick={() => setSelectedPlan(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-xs text-gray-500">Plan Number</div>
                  <div className="font-medium">{selectedPlan.planNumber}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Title</div>
                  <div className="font-medium">{selectedPlan.title}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Diagnosis</div>
                  <div className="font-medium">{selectedPlan.diagnosis || 'N/A'}</div>
                </div>

                {selectedPlan.objectives && selectedPlan.objectives.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Objectives</div>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {selectedPlan.objectives.map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedPlan.medications && selectedPlan.medications.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Medications</div>
                    <div className="space-y-2">
                      {selectedPlan.medications.map((med, i) => (
                        <div key={i} className="text-sm p-2 bg-gray-50 rounded">
                          <div className="font-medium">{med.drugName}</div>
                          <div className="text-gray-600">
                            {med.dosage} • {med.frequency} • {med.duration}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPlan.goals && selectedPlan.goals.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Goals</div>
                    <div className="space-y-2">
                      {selectedPlan.goals.map((goal, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              goal.status === 'achieved'
                                ? 'bg-green-500'
                                : goal.status === 'in_progress'
                                ? 'bg-yellow-500'
                                : 'bg-gray-300'
                            }`}
                          ></span>
                          <span>{goal.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 flex flex-wrap gap-2">
                  {selectedPlan.status === 'active' && (
                    <>
                      <button
                        onClick={() => addProgress(selectedPlan.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                      >
                        Add Progress
                      </button>
                      <button
                        onClick={() => updateStatus(selectedPlan.id, 'on_hold')}
                        className="px-3 py-1 bg-yellow-600 text-white rounded text-sm"
                      >
                        Put on Hold
                      </button>
                      <button
                        onClick={() => updateStatus(selectedPlan.id, 'completed')}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                      >
                        Complete
                      </button>
                    </>
                  )}
                  {selectedPlan.status === 'on_hold' && (
                    <button
                      onClick={() => updateStatus(selectedPlan.id, 'active')}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                    >
                      Resume
                    </button>
                  )}
                  {selectedPlan.status === 'draft' && (
                    <button
                      onClick={() => updateStatus(selectedPlan.id, 'active')}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Select a treatment plan to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
