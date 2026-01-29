import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FlaskConical,
  Clock,
  AlertTriangle,
  CheckCircle,
  Filter,
  User,
  Calendar,
  Timer,
  Play,
  UserCheck,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { labService, type LabOrder } from '../../services';

type Priority = 'stat' | 'urgent' | 'routine';
type Status = 'pending' | 'sample_collected' | 'processing' | 'completed';



const technicians = ['Tech. Sarah', 'Tech. Mike', 'Tech. John', 'Tech. Anna'];

const priorityColors: Record<Priority, string> = {
  stat: 'bg-red-100 text-red-700 border-red-300',
  urgent: 'bg-orange-100 text-orange-700 border-orange-300',
  routine: 'bg-blue-100 text-blue-700 border-blue-300',
};

const statusColors: Record<Status, string> = {
  pending: 'bg-gray-100 text-gray-700',
  sample_collected: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
};

const statusLabels: Record<Status, string> = {
  pending: 'Pending',
  sample_collected: 'Sample Collected',
  processing: 'Processing',
  completed: 'Completed',
};

const statusIcons: Record<Status, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  sample_collected: <FlaskConical className="w-3.5 h-3.5" />,
  processing: <Play className="w-3.5 h-3.5" />,
  completed: <CheckCircle className="w-3.5 h-3.5" />,
};

export default function LabQueuePage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterTest, setFilterTest] = useState('');
  const [assigningOrder, setAssigningOrder] = useState<string | null>(null);

  // Fetch lab orders
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['lab-orders'],
    queryFn: () => labService.orders.list(),
    staleTime: 15000,
    refetchInterval: 20000,
  });

  // Assign technician mutation
  const assignMutation = useMutation({
    mutationFn: (data: { orderId: string; technician: string }) =>
      labService.orders.assign(data.orderId, data.technician),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (data: { orderId: string; status: string }) =>
      labService.orders.updateStatus(data.orderId, data.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
    },
  });

  const orders = ordersData || [];

  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => filterStatus === 'all' || order.status === filterStatus)
      .filter((order) => filterPriority === 'all' || order.priority === filterPriority)
      .filter((order) => !filterTest || order.tests?.some((t) => t.testName?.toLowerCase().includes(filterTest.toLowerCase())))
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { stat: 0, urgent: 1, routine: 2 };
        return (priorityOrder[a.priority || 'routine'] || 2) - (priorityOrder[b.priority || 'routine'] || 2);
      });
  }, [orders, filterStatus, filterPriority, filterTest]);

  const handleAssign = (orderId: string, technician: string) => {
    assignMutation.mutate({ orderId, technician });
    setAssigningOrder(null);
  };

  const getWaitTime = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const stats = useMemo(() => ({
    stat: orders.filter((o) => o.priority === 'stat' && o.status !== 'completed').length,
    urgent: orders.filter((o) => o.priority === 'urgent' && o.status !== 'completed').length,
    pending: orders.filter((o) => o.status === 'pending').length,
    completed: orders.filter((o) => o.status === 'completed').length,
  }), [orders]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <FlaskConical className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lab Queue</h1>
            <p className="text-sm text-gray-500">Manage laboratory orders by priority</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-center">
            <p className="text-xl font-bold text-red-600">{stats.stat}</p>
            <p className="text-xs text-red-500">STAT</p>
          </div>
          <div className="px-4 py-2 bg-orange-50 border border-orange-200 rounded-lg text-center">
            <p className="text-xl font-bold text-orange-600">{stats.urgent}</p>
            <p className="text-xs text-orange-500">Urgent</p>
          </div>
          <div className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-center">
            <p className="text-xl font-bold text-gray-600">{stats.pending}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
          <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-xs text-green-500">Completed</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 p-3 bg-white rounded-lg border border-gray-200">
        <Filter className="w-5 h-5 text-gray-400" />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as Status | 'all')}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="sample_collected">Sample Collected</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as Priority | 'all')}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Priorities</option>
          <option value="stat">STAT</option>
          <option value="urgent">Urgent</option>
          <option value="routine">Routine</option>
        </select>
        <input
          type="text"
          placeholder="Search by test type..."
          value={filterTest}
          onChange={(e) => setFilterTest(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-48"
        />
        <div className="flex items-center gap-2 ml-auto text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          <span>Today: {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-auto h-full">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          )}
          {!isLoading && (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-sm text-gray-600">
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Tests</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Wait Time</th>
                  <th className="px-4 py-3 font-medium">Assigned To</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <FlaskConical className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No orders in queue</p>
                  </td>
                </tr>
              )}
              {filteredOrders.map((order) => {
                  const status = (order.status || 'pending') as Status;
                  const priority = (order.priority || 'routine') as Priority;
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{order.orderNumber || order.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{order.patient?.fullName || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{order.patient?.mrn || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {order.tests?.map((test) => (
                            <span key={test.id} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                              {test.testName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded border text-xs font-medium ${priorityColors[priority]}`}>
                          {priority === 'stat' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                          {priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 w-fit ${statusColors[status]}`}>
                          {statusIcons[status]}
                          {statusLabels[status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Timer className="w-4 h-4 text-gray-400" />
                          {getWaitTime(order.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {assigningOrder === order.id ? (
                          <select
                            autoFocus
                            onChange={(e) => handleAssign(order.id, e.target.value)}
                            onBlur={() => setAssigningOrder(null)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="">Select...</option>
                            {technicians.map((tech) => (
                              <option key={tech} value={tech}>{tech}</option>
                            ))}
                          </select>
                        ) : order.assignedTo ? (
                          <span className="flex items-center gap-1 text-sm text-gray-700">
                            <UserCheck className="w-4 h-4 text-green-500" />
                            {order.assignedTo}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!order.assignedTo && status === 'pending' && (
                            <button
                              onClick={() => setAssigningOrder(order.id)}
                              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors"
                            >
                              Assign
                            </button>
                          )}
                          {status === 'sample_collected' && (
                            <button
                              onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'processing' })}
                              className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
                            >
                              Process
                            </button>
                          )}
                          {status === 'processing' && (
                            <button
                              onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'completed' })}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
