import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Clock,
  User,
  CheckCircle,
  PlayCircle,
  Phone,
  Filter,
  RefreshCw,
  Pill,
  Package,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { prescriptionsService, type Prescription } from '../../services';
import api from '../../services/api';

type QueueStatus = 'pending' | 'dispensing' | 'ready' | 'collected';
type Priority = 'high' | 'normal' | 'low';

// Empty fallback data - no mock data
const mockQueueData: Prescription[] = [];

export default function PharmacyQueuePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<QueueStatus | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'all'>('all');

  // Fetch pending prescriptions
  const { data: prescriptionsData, isLoading, refetch } = useQuery({
    queryKey: ['prescriptions', 'pending'],
    queryFn: () => prescriptionsService.getPending(),
    staleTime: 10000,
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch patients returned to pharmacy
  const { data: returnedData } = useQuery({
    queryKey: ['pharmacy-returned-patients'],
    queryFn: async () => {
      const response = await api.get('/encounters', {
        params: {
          status: 'return_to_pharmacy',
          limit: 50,
        },
      });
      return response.data?.data || [];
    },
    refetchInterval: 15000,
  });

  // Accept returned patient mutation
  const acceptReturnedMutation = useMutation({
    mutationFn: async (encounterId: string) => {
      const response = await api.patch(`/encounters/${encounterId}/status`, {
        status: 'pending_pharmacy',
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy-returned-patients'] });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
  });

  // Start dispensing mutation
  const startDispensingMutation = useMutation({
    mutationFn: (prescriptionId: string) => prescriptionsService.updateStatus(prescriptionId, 'dispensing'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
  });

  // Mark as ready mutation
  const markReadyMutation = useMutation({
    mutationFn: (prescriptionId: string) => prescriptionsService.updateStatus(prescriptionId, 'ready'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
  });

  // Mark as collected mutation
  const markCollectedMutation = useMutation({
    mutationFn: (prescriptionId: string) => prescriptionsService.updateStatus(prescriptionId, 'collected'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
  });

  const queueData = prescriptionsData || mockQueueData;

  const filteredQueue = useMemo(() => {
    return queueData.filter((item) => {
      const matchesSearch =
        item.patient?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.patient?.mrn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.prescriptionNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
      const matchesPriority = selectedPriority === 'all' || item.priority === selectedPriority;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [searchTerm, selectedStatus, selectedPriority, queueData]);

  // Returned patients from billing/cashier
  const returnedPatients = useMemo(() => {
    return (returnedData || []).map((enc: any) => ({
      id: enc.id,
      patientName: enc.patient?.fullName || 'Unknown',
      patientMrn: enc.patient?.mrn || 'N/A',
      patientId: enc.patient?.id || enc.patientId,
      returnReason: enc.metadata?.pharmacyReturnReason || 'Returned from billing',
      returnedAt: enc.metadata?.pharmacyReturnedAt || enc.updatedAt,
      encounterId: enc.id,
      visitNumber: enc.visitNumber,
    }));
  }, [returnedData]);

  const queueStats = useMemo(() => ({
    waiting: queueData.filter((i) => i.status === 'pending').length,
    inProgress: queueData.filter((i) => i.status === 'dispensing').length,
    ready: queueData.filter((i) => i.status === 'ready').length,
    collected: queueData.filter((i) => i.status === 'collected' || i.status === 'dispensed').length,
    returned: returnedPatients.length,
    avgWaitTime: Math.round(
      queueData.filter((i) => i.status === 'pending').reduce((acc, i) => {
        const waitMinutes = Math.floor((Date.now() - new Date(i.createdAt).getTime()) / 60000);
        return acc + waitMinutes;
      }, 0) / Math.max(queueData.filter((i) => i.status === 'pending').length, 1)
    ),
  }), [queueData, returnedPatients]);

  const getWaitTime = (createdAt: string) => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'dispensing':
        return <PlayCircle className="w-4 h-4 text-blue-600" />;
      case 'ready':
        return <Package className="w-4 h-4 text-green-600" />;
      case 'collected':
      case 'dispensed':
        return <CheckCircle className="w-4 h-4 text-gray-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      case 'dispensing':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'collected':
      case 'dispensed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'normal':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const nextWaiting = filteredQueue.find((i) => i.status === 'pending');

  // Text-to-speech function to call patient
  const speakPatientName = (patientName: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const announcement = `Attention please. ${patientName}, please proceed to the pharmacy counter. Thank you.`;
      
      // Repeat announcement 3 times
      let repeatCount = 0;
      const speak = () => {
        if (repeatCount >= 3) return;
        
        const utterance = new SpeechSynthesisUtterance(announcement);
        utterance.rate = 0.9; // Slightly slower for clarity
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // Try to use a clear voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Female')) 
          || voices.find(v => v.lang.startsWith('en'))
          || voices[0];
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        
        utterance.onend = () => {
          repeatCount++;
          if (repeatCount < 3) {
            // Small pause between announcements
            setTimeout(speak, 1000);
          }
        };
        
        window.speechSynthesis.speak(utterance);
      };
      
      speak();
    } else {
      console.warn('Text-to-speech not supported in this browser');
    }
  };

  const handleCallNext = () => {
    if (nextWaiting) {
      // Call out the patient name
      const patientName = nextWaiting.patient?.fullName || 'Patient';
      speakPatientName(patientName);
      
      // Navigate to dispense page after a short delay to let announcement start
      setTimeout(() => {
        navigate(`/pharmacy/dispense?prescription=${nextWaiting.id}`);
      }, 500);
    }
  };

  // Handle calling a specific patient from the queue
  const handleCallPatient = (prescription: Prescription) => {
    const patientName = prescription.patient?.fullName || 'Patient';
    speakPatientName(patientName);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy Queue</h1>
          <p className="text-gray-600">Manage prescription dispensing queue</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button 
            onClick={handleCallNext}
            disabled={!nextWaiting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Phone className="w-4 h-4" />
            Call Next Patient
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Waiting</p>
              <p className="text-2xl font-bold text-amber-600">{queueStats.waiting}</p>
            </div>
          </div>
        </div>
        {queueStats.returned > 0 && (
          <div className="bg-orange-50 p-4 rounded-xl shadow-sm border border-orange-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <RotateCcw className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-orange-600">Returned</p>
                <p className="text-2xl font-bold text-orange-600">{queueStats.returned}</p>
              </div>
            </div>
          </div>
        )}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <PlayCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">{queueStats.inProgress}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Ready</p>
              <p className="text-2xl font-bold text-green-600">{queueStats.ready}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Collected</p>
              <p className="text-2xl font-bold text-gray-600">{queueStats.collected}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Wait</p>
              <p className="text-2xl font-bold text-purple-600">{queueStats.avgWaitTime}m</p>
            </div>
          </div>
        </div>
      </div>

      {/* Returned Patients Section */}
      {returnedPatients.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <RotateCcw className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Returned from Billing ({returnedPatients.length})
            </h2>
          </div>
          <div className="bg-orange-50 rounded-xl shadow-sm border border-orange-200">
            <div className="divide-y divide-orange-200">
              {returnedPatients.map((patient: any) => (
                <div
                  key={patient.id}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-orange-100 transition-colors"
                >
                  <div className="col-span-2">
                    <span className="font-mono font-bold text-orange-600">
                      {patient.visitNumber}
                    </span>
                  </div>
                  <div className="col-span-2 font-medium text-gray-900">
                    {patient.patientName}
                  </div>
                  <div className="col-span-2 text-gray-500 font-mono text-sm">
                    {patient.patientMrn}
                  </div>
                  <div className="col-span-3 text-orange-700 text-sm">
                    <div className="flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" />
                      <span className="font-medium">Reason:</span>
                    </div>
                    <p className="truncate">{patient.returnReason}</p>
                  </div>
                  <div className="col-span-1">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      <RotateCcw className="w-3 h-3" />
                      Returned
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        acceptReturnedMutation.mutate(patient.encounterId);
                        navigate(`/pharmacy/dispense?encounter=${patient.encounterId}`);
                      }}
                      disabled={acceptReturnedMutation.isPending}
                      className="inline-flex items-center gap-1 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      <Pill className="w-4 h-4" />
                      Dispense
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Next Patient Card */}
      {nextWaiting && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 rounded-xl mb-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-blue-100">Next Patient</p>
                <p className="text-xl font-bold">{nextWaiting.patient?.fullName || 'Unknown'}</p>
                <p className="text-sm text-blue-100">
                  {nextWaiting.prescriptionNumber} • {nextWaiting.items?.length || 0} items
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right mr-4">
                <p className="text-sm text-blue-100">Wait Time</p>
                <p className="text-2xl font-bold">{getWaitTime(nextWaiting.createdAt)} min</p>
              </div>
              <button 
                onClick={handleCallNext}
                className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-semibold"
              >
                <Phone className="w-5 h-5" />
                Call Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name, ID, or prescription..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as QueueStatus | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Waiting</option>
              <option value="dispensing">In Progress</option>
              <option value="ready">Ready</option>
              <option value="collected">Collected</option>
            </select>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as Priority | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-auto h-full">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}
          {!isLoading && filteredQueue.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Package className="w-12 h-12 mb-4 text-gray-300" />
              <p className="text-lg font-medium">No prescriptions in queue</p>
              <p className="text-sm">Prescriptions will appear here when patients are waiting</p>
            </div>
          )}
          {!isLoading && filteredQueue.length > 0 && (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Prescription</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Wait Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Prescribed By</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-blue-600">{item.prescriptionNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.patient?.fullName || 'Unknown'}</p>
                          <p className="text-sm text-gray-500">{item.patient?.mrn || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Pill className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{item.items?.length || 0} items</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className={`font-medium ${getWaitTime(item.createdAt) > 30 ? 'text-red-600' : 'text-gray-700'}`}>
                          {getWaitTime(item.createdAt)} min
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(item.priority)}`}>
                        {item.priority || 'normal'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {item.status === 'pending' ? 'Waiting' : item.status === 'dispensing' ? 'In Progress' : item.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{item.doctor?.fullName || 'Unknown'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Call patient button */}
                        <button 
                          onClick={() => handleCallPatient(item)}
                          className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
                          title="Announce patient name"
                        >
                          <Phone className="w-3 h-3" />
                          Call
                        </button>
                        {item.status === 'pending' && (
                          <button 
                            onClick={() => {
                              startDispensingMutation.mutate(item.id);
                              navigate(`/pharmacy/dispense?prescription=${item.id}`);
                            }}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Start
                          </button>
                        )}
                        {item.status === 'dispensing' && (
                          <button 
                            onClick={() => markReadyMutation.mutate(item.id)}
                            disabled={markReadyMutation.isPending}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Ready
                          </button>
                        )}
                        {item.status === 'ready' && (
                          <button 
                            onClick={() => markCollectedMutation.mutate(item.id)}
                            disabled={markCollectedMutation.isPending}
                            className="px-3 py-1 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            Collected
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
