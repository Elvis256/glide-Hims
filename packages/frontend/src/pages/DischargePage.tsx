import { useState, useEffect } from 'react';
import api from '../services/api';

interface DischargeSummary {
  id: string;
  summaryNumber: string;
  type: string;
  dischargeDate: string;
  diagnosis: string;
  patient: {
    fullName: string;
    mrn: string;
    phone: string;
  };
  hospital_course: string;
  condition_at_discharge: string;
  discharge_medications: Array<{
    drugName: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }>;
  follow_up_instructions: string[];
  diet_instructions?: string;
  activity_restrictions?: string;
  warning_signs?: string[];
  followUpDate?: string;
  dischargedBy?: { fullName: string };
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  normal: 'Normal Discharge',
  against_advice: 'Against Medical Advice',
  transfer: 'Transfer',
  death: 'Death',
  absconded: 'Absconded',
  referral: 'Referral',
};

export default function DischargePage() {
  const [summaries, setSummaries] = useState<DischargeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSummary, setSelectedSummary] = useState<DischargeSummary | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    loadSummaries();
  }, []);

  const loadSummaries = async () => {
    setLoading(true);
    try {
      const response = await api.get('/discharge');
      setSummaries(response.data);
    } catch (error) {
      console.error('Failed to load discharge summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const printSummary = () => {
    if (selectedSummary) {
      setShowPrintModal(true);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Discharge Summaries</h1>
          <p className="text-gray-600">View and manage patient discharge documentation</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Summaries List */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : summaries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No discharge summaries found</div>
          ) : (
            <div className="divide-y">
              {summaries.map((summary) => (
                <div
                  key={summary.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${
                    selectedSummary?.id === summary.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedSummary(summary)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-blue-600">{summary.summaryNumber}</span>
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                          {typeLabels[summary.type] || summary.type}
                        </span>
                      </div>
                      <div className="font-medium">{summary.patient?.fullName}</div>
                      <div className="text-sm text-gray-600">MRN: {summary.patient?.mrn}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Discharged: {new Date(summary.dischargeDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {summary.dischargedBy?.fullName || 'N/A'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary Details */}
        <div className="bg-white rounded-lg shadow h-fit sticky top-4">
          {selectedSummary ? (
            <div>
              <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-lg">Discharge Details</h2>
                  <button
                    onClick={printSummary}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    🖨️ Print
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <div className="text-xs text-gray-500">Patient</div>
                  <div className="font-medium">{selectedSummary.patient?.fullName}</div>
                  <div className="text-sm text-gray-600">MRN: {selectedSummary.patient?.mrn}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Diagnosis</div>
                  <div className="font-medium">{selectedSummary.diagnosis}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Hospital Course</div>
                  <div className="text-sm p-2 bg-gray-50 rounded">
                    {selectedSummary.hospital_course || 'N/A'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Condition at Discharge</div>
                  <div className="font-medium capitalize">{selectedSummary.condition_at_discharge}</div>
                </div>

                {selectedSummary.discharge_medications && selectedSummary.discharge_medications.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Discharge Medications</div>
                    <div className="space-y-2">
                      {selectedSummary.discharge_medications.map((med, i) => (
                        <div key={i} className="p-2 bg-blue-50 rounded text-sm">
                          <div className="font-medium">{med.drugName}</div>
                          <div className="text-gray-600">
                            {med.dosage} • {med.frequency} • {med.duration}
                          </div>
                          {med.instructions && (
                            <div className="text-gray-500 italic mt-1">{med.instructions}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSummary.follow_up_instructions && selectedSummary.follow_up_instructions.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Follow-up Instructions</div>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {selectedSummary.follow_up_instructions.map((instruction, i) => (
                        <li key={i}>{instruction}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedSummary.followUpDate && (
                  <div>
                    <div className="text-xs text-gray-500">Follow-up Date</div>
                    <div className="font-medium text-blue-600">
                      {new Date(selectedSummary.followUpDate).toLocaleDateString()}
                    </div>
                  </div>
                )}

                {selectedSummary.diet_instructions && (
                  <div>
                    <div className="text-xs text-gray-500">Diet Instructions</div>
                    <div className="text-sm">{selectedSummary.diet_instructions}</div>
                  </div>
                )}

                {selectedSummary.activity_restrictions && (
                  <div>
                    <div className="text-xs text-gray-500">Activity Restrictions</div>
                    <div className="text-sm">{selectedSummary.activity_restrictions}</div>
                  </div>
                )}

                {selectedSummary.warning_signs && selectedSummary.warning_signs.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Warning Signs</div>
                    <div className="p-2 bg-red-50 rounded">
                      <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                        {selectedSummary.warning_signs.map((sign, i) => (
                          <li key={i}>{sign}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Select a discharge summary to view details
            </div>
          )}
        </div>
      </div>

      {/* Print Modal */}
      {showPrintModal && selectedSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 print-content">
              <div className="text-center border-b pb-4 mb-4">
                <h1 className="text-xl font-bold">DISCHARGE SUMMARY</h1>
                <p className="text-sm text-gray-600">Glide Healthcare Facility</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <strong>Patient:</strong> {selectedSummary.patient?.fullName}
                </div>
                <div>
                  <strong>MRN:</strong> {selectedSummary.patient?.mrn}
                </div>
                <div>
                  <strong>Summary #:</strong> {selectedSummary.summaryNumber}
                </div>
                <div>
                  <strong>Discharge Date:</strong>{' '}
                  {new Date(selectedSummary.dischargeDate).toLocaleDateString()}
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <strong>Diagnosis:</strong>
                  <p>{selectedSummary.diagnosis}</p>
                </div>

                <div>
                  <strong>Hospital Course:</strong>
                  <p>{selectedSummary.hospital_course}</p>
                </div>

                <div>
                  <strong>Condition at Discharge:</strong>
                  <p className="capitalize">{selectedSummary.condition_at_discharge}</p>
                </div>

                {selectedSummary.discharge_medications?.length > 0 && (
                  <div>
                    <strong>Medications:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {selectedSummary.discharge_medications.map((med, i) => (
                        <li key={i}>
                          {med.drugName} - {med.dosage} {med.frequency} for {med.duration}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedSummary.follow_up_instructions?.length > 0 && (
                  <div>
                    <strong>Follow-up Instructions:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {selectedSummary.follow_up_instructions.map((inst, i) => (
                        <li key={i}>{inst}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedSummary.followUpDate && (
                  <div>
                    <strong>Next Appointment:</strong>{' '}
                    {new Date(selectedSummary.followUpDate).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-4 border-t flex justify-between text-sm">
                <div>
                  <strong>Discharged By:</strong> {selectedSummary.dischargedBy?.fullName || 'N/A'}
                </div>
                <div>
                  <strong>Date:</strong> {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex gap-4 no-print">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                🖨️ Print
              </button>
              <button
                onClick={() => setShowPrintModal(false)}
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
