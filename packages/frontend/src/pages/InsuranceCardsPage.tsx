import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  Search,
  ArrowLeft,
  Plus,
  Edit,
  Eye,
  UserCircle,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { insuranceService, type InsurancePolicy } from '../services/insurance';

interface InsuranceCard {
  id: string;
  patientName: string;
  patientMrn: string;
  provider: string;
  policyNumber: string;
  membershipType: string;
  issueDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'pending';
  dependents: number;
  cardNumber: string;
}

// Map API policy status to UI card status
const mapPolicyStatus = (status: InsurancePolicy['status']): InsuranceCard['status'] => {
  switch (status) {
    case 'active':
      return 'active';
    case 'expired':
      return 'expired';
    case 'inactive':
    case 'suspended':
    default:
      return 'pending';
  }
};

// Transform InsurancePolicy to InsuranceCard for UI display
const policyToCard = (policy: InsurancePolicy): InsuranceCard => ({
  id: policy.id,
  patientName: policy.principalName || 'Unknown Patient',
  patientMrn: policy.patientId,
  provider: policy.provider?.name || 'Unknown Provider',
  policyNumber: policy.policyNumber,
  membershipType: policy.coverageType.charAt(0).toUpperCase() + policy.coverageType.slice(1),
  issueDate: policy.startDate,
  expiryDate: policy.endDate,
  status: mapPolicyStatus(policy.status),
  dependents: 0,
  cardNumber: policy.memberNumber || policy.policyNumber,
});

export default function InsuranceCardsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCard, setSelectedCard] = useState<InsuranceCard | null>(null);

  // Fetch insurance policies from API
  const { data: policies = [], isLoading, error } = useQuery({
    queryKey: ['insurance-policies'],
    queryFn: () => insuranceService.policies.list(),
  });

  // Transform policies to cards for UI display
  const insuranceCards = useMemo(() => policies.map(policyToCard), [policies]);

  const filteredCards = insuranceCards.filter((card) => {
    const matchesSearch =
      card.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.policyNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.cardNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || card.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    active: insuranceCards.filter(c => c.status === 'active').length,
    expired: insuranceCards.filter(c => c.status === 'expired').length,
    pending: insuranceCards.filter(c => c.status === 'pending').length,
    expiringSoon: insuranceCards.filter(c => {
      const expiry = new Date(c.expiryDate);
      const now = new Date();
      const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > 0 && diffDays <= 30;
    }).length,
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      expired: 'bg-red-100 text-red-700',
      pending: 'bg-yellow-100 text-yellow-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Insurance Cards</h1>
              <p className="text-gray-500 text-sm">Manage patient insurance cards</p>
            </div>
          </div>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Register Card
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4 flex-shrink-0">
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-green-600">{stats.active}</p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-yellow-600">{stats.pending}</p>
          <p className="text-xs text-gray-500">Pending</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-orange-600">{stats.expiringSoon}</p>
          <p className="text-xs text-gray-500">Expiring Soon</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-red-600">{stats.expired}</p>
          <p className="text-xs text-gray-500">Expired</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Left: Cards List */}
        <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
          <div className="flex gap-3 mb-3 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by patient, policy, or card number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9 py-2 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input py-2 text-sm w-32"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-red-600">
                <AlertTriangle className="w-6 h-6 mr-2" />
                <span>Failed to load insurance cards</span>
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <p>No insurance cards found</p>
              </div>
            ) : (
              filteredCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className={`w-full p-3 border rounded-lg text-left transition-colors ${
                    selectedCard?.id === card.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <UserCircle className="w-8 h-8 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{card.patientName}</p>
                        <p className="text-xs text-gray-500">{card.patientMrn}</p>
                      </div>
                    </div>
                    {getStatusBadge(card.status)}
                  </div>
                  <div className="ml-10 text-sm">
                    <p className="text-gray-600">{card.provider}</p>
                    <p className="font-mono text-xs text-gray-500">{card.cardNumber}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Card Details */}
        <div className="card p-4 flex flex-col min-h-0">
          {!selectedCard ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Select a card to view details</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Card Preview */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-4 text-white mb-4">
                <p className="text-xs opacity-75 mb-3">{selectedCard.provider}</p>
                <p className="font-mono text-lg tracking-wider mb-4">{selectedCard.cardNumber}</p>
                <div className="flex justify-between">
                  <div>
                    <p className="text-xs opacity-75">Member</p>
                    <p className="font-medium text-sm">{selectedCard.patientName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-75">Expires</p>
                    <p className="font-medium text-sm">{selectedCard.expiryDate}</p>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  {getStatusBadge(selectedCard.status)}
                </div>

                <div>
                  <p className="text-sm text-gray-500">Policy Number</p>
                  <p className="font-mono font-medium">{selectedCard.policyNumber}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Membership Type</p>
                  <p className="font-medium">{selectedCard.membershipType}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-gray-500">Issue Date</p>
                    <p className="font-medium">{selectedCard.issueDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Expiry Date</p>
                    <p className="font-medium">{selectedCard.expiryDate}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Dependents</p>
                  <p className="font-medium">{selectedCard.dependents}</p>
                </div>

                {/* Expiry Warning */}
                {selectedCard.status === 'expired' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-red-700 text-sm">Card Expired</p>
                      <p className="text-xs text-red-600">Please renew the insurance card</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button className="btn-secondary flex-1 flex items-center justify-center gap-1 text-sm">
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                  <button className="btn-primary flex-1 flex items-center justify-center gap-1 text-sm">
                    <Edit className="w-4 h-4" />
                    Update
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
