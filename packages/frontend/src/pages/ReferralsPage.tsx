import { useState, useEffect } from 'react';
import api from '../services/api';

interface Referral {
  id: string;
  referralNumber: string;
  type: string;
  status: string;
  priority: string;
  reason: string;
  clinicalSummary: string;
  provisionalDiagnosis: string;
  appointmentDate: string;
  patient: {
    fullName: string;
    mrn: string;
    phone: string;
  };
  fromFacility?: { name: string };
  toFacility?: { name: string };
  externalFacilityName?: string;
  referredBy?: { fullName: string };
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  expired: 'bg-orange-100 text-orange-800',
};

const priorityColors: Record<string, string> = {
  emergency: 'bg-red-500 text-white',
  urgent: 'bg-orange-500 text-white',
  routine: 'bg-blue-500 text-white',
};

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [_showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadReferrals();
  }, [activeTab]);

  const loadReferrals = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'incoming' ? '/referrals/incoming' : '/referrals/outgoing';
      const response = await api.get(endpoint);
      setReferrals(response.data);
    } catch (error) {
      console.error('Failed to load referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const acceptReferral = async (id: string) => {
    const appointmentDate = prompt('Enter appointment date (YYYY-MM-DD):');
    if (appointmentDate) {
      try {
        await api.post(`/referrals/${id}/accept`, { appointmentDate });
        loadReferrals();
      } catch (error) {
        console.error('Failed to accept referral:', error);
      }
    }
  };

  const rejectReferral = async (id: string) => {
    const reason = prompt('Enter rejection reason:');
    if (reason) {
      try {
        await api.post(`/referrals/${id}/reject`, { rejectionReason: reason });
        loadReferrals();
      } catch (error) {
        console.error('Failed to reject referral:', error);
      }
    }
  };

  const completeReferral = async (id: string) => {
    const notes = prompt('Enter feedback notes (optional):') || '';
    try {
      await api.post(`/referrals/${id}/complete`, { feedbackNotes: notes });
      loadReferrals();
    } catch (error) {
      console.error('Failed to complete referral:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Referrals</h1>
          <p className="text-gray-600">Manage patient referrals between facilities</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + New Referral
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('incoming')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'incoming'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📥 Incoming Referrals
        </button>
        <button
          onClick={() => setActiveTab('outgoing')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'outgoing'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📤 Outgoing Referrals
        </button>
      </div>

      {/* Referrals List */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : referrals.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No {activeTab} referrals found</div>
        ) : (
          <div className="divide-y">
            {referrals.map((referral) => (
              <div key={referral.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-blue-600">{referral.referralNumber}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${statusColors[referral.status]}`}>
                        {referral.status.toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${priorityColors[referral.priority]}`}>
                        {referral.priority.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Patient</div>
                        <div className="font-medium">{referral.patient?.fullName}</div>
                        <div className="text-gray-500">MRN: {referral.patient?.mrn}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">From</div>
                        <div className="font-medium">{referral.fromFacility?.name || 'External'}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">To</div>
                        <div className="font-medium">
                          {referral.toFacility?.name || referral.externalFacilityName || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Reason</div>
                        <div className="font-medium">{referral.reason.replace(/_/g, ' ')}</div>
                      </div>
                    </div>
                    {referral.provisionalDiagnosis && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-500">Diagnosis:</span> {referral.provisionalDiagnosis}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    {activeTab === 'incoming' && referral.status === 'pending' && (
                      <>
                        <button
                          onClick={() => acceptReferral(referral.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => rejectReferral(referral.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {referral.status === 'accepted' && (
                      <button
                        onClick={() => completeReferral(referral.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Complete
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedReferral(referral)}
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View Referral Modal */}
      {selectedReferral && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Referral Details</h2>
                <button
                  onClick={() => setSelectedReferral(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Referral Number</div>
                  <div className="font-medium">{selectedReferral.referralNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <div className={`inline-block px-2 py-0.5 rounded text-xs ${statusColors[selectedReferral.status]}`}>
                    {selectedReferral.status.toUpperCase()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Patient</div>
                  <div className="font-medium">{selectedReferral.patient?.fullName}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">MRN</div>
                  <div className="font-medium">{selectedReferral.patient?.mrn}</div>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Clinical Summary</div>
                <div className="mt-1 p-3 bg-gray-50 rounded">{selectedReferral.clinicalSummary}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Provisional Diagnosis</div>
                <div className="font-medium">{selectedReferral.provisionalDiagnosis || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Referred By</div>
                <div className="font-medium">{selectedReferral.referredBy?.fullName || 'N/A'}</div>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setSelectedReferral(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
