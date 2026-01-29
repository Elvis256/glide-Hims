import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle,
  PlayCircle,
  Calendar,
  User,
  Monitor,
  RefreshCw,
  FileText,
  MapPin,
  Loader2,
} from 'lucide-react';
import { radiologyService, type RadiologyOrder } from '../../services';

type Modality = 'all' | 'xray' | 'ct' | 'mri' | 'ultrasound';
type Priority = 'stat' | 'urgent' | 'routine';
type Status = 'scheduled' | 'in_progress' | 'completed' | 'reported' | 'pending';



const modalities: Modality[] = ['all', 'xray', 'ct', 'mri', 'ultrasound'];

const modalityLabels: Record<string, string> = {
  xray: 'X-Ray',
  ct: 'CT',
  mri: 'MRI',
  ultrasound: 'Ultrasound',
  mammogram: 'Mammogram',
  fluoroscopy: 'Fluoroscopy',
};

export default function RadiologyQueuePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModality, setSelectedModality] = useState<Modality>('all');
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<Status | 'all'>('all');

  // Fetch radiology orders
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['radiology-orders'],
    queryFn: () => radiologyService.orders.list(),
    staleTime: 15000,
    refetchInterval: 20000,
  });

  // Start exam mutation
  const startExamMutation = useMutation({
    mutationFn: (orderId: string) => radiologyService.orders.startExam(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology-orders'] });
    },
  });

  // Complete exam mutation
  const completeExamMutation = useMutation({
    mutationFn: (orderId: string) => radiologyService.orders.complete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology-orders'] });
    },
  });

  const orders = ordersData || [];

  const filteredQueue = useMemo(() => {
    return orders.filter((item) => {
      const matchesSearch =
        item.patient?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.patient?.mrn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.examType?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesModality = selectedModality === 'all' || item.modality === selectedModality;
      const matchesPriority = selectedPriority === 'all' || item.priority === selectedPriority;
      const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
      return matchesSearch && matchesModality && matchesPriority && matchesStatus;
    });
  }, [searchTerm, selectedModality, selectedPriority, selectedStatus, orders]);

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'stat':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'urgent':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'routine':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'scheduled':
        return <Calendar className="w-4 h-4 text-blue-600" />;
      case 'in_progress':
        return <PlayCircle className="w-4 h-4 text-yellow-600" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'reported':
        return <FileText className="w-4 h-4 text-purple-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'reported':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'scheduled':
        return 'Scheduled';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'reported':
        return 'Reported';
      default:
        return status;
    }
  };

  const getModalityColor = (modality?: string) => {
    switch (modality) {
      case 'xray':
        return 'bg-gray-100 text-gray-800';
      case 'ct':
        return 'bg-indigo-100 text-indigo-800';
      case 'mri':
        return 'bg-pink-100 text-pink-800';
      case 'ultrasound':
        return 'bg-cyan-100 text-cyan-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getWaitTime = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const queueStats = useMemo(() => {
    return {
      total: orders.length,
      stat: orders.filter((i) => i.priority === 'stat').length,
      inProgress: orders.filter((i) => i.status === 'in_progress').length,
      pending: orders.filter((i) => i.status === 'pending' || i.status === 'scheduled').length,
    };
  }, [orders]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Radiology Queue</h1>
          <p className="text-gray-600">Manage imaging orders and workflow</p>
        </div>
        <button 
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Monitor className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{queueStats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">STAT Orders</p>
              <p className="text-2xl font-bold text-red-600">{queueStats.stat}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <PlayCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-yellow-600">{queueStats.inProgress}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-blue-600">{queueStats.pending}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name, ID, or study type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedModality}
              onChange={(e) => setSelectedModality(e.target.value as Modality)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {modalities.map((m) => (
                <option key={m} value={m}>
                  {m === 'all' ? 'All Modalities' : modalityLabels[m] || m}
                </option>
              ))}
            </select>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as Priority | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="stat">STAT</option>
              <option value="urgent">Urgent</option>
              <option value="routine">Routine</option>
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as Status | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="reported">Reported</option>
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
          {!isLoading && (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Study Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Modality</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Wait Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredQueue.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      <Monitor className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No orders in queue</p>
                    </td>
                  </tr>
                )}
                {filteredQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
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
                      <p className="text-gray-900">{item.examType}</p>
                      <p className="text-sm text-gray-500">{item.orderNumber || item.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getModalityColor(item.modality)}`}>
                        {modalityLabels[item.modality] || item.modality}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(item.priority)}`}>
                        {(item.priority || 'routine').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-700">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {getWaitTime(item.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {(item.status === 'pending' || item.status === 'scheduled') && (
                          <button
                            onClick={() => startExamMutation.mutate(item.id)}
                            disabled={startExamMutation.isPending}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                          >
                            Start
                          </button>
                        )}
                        {item.status === 'in_progress' && (
                          <button
                            onClick={() => completeExamMutation.mutate(item.id)}
                            disabled={completeExamMutation.isPending}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                          >
                            Complete
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
