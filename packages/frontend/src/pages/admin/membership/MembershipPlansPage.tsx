import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Edit2,
  Power,
  Download,
  Filter,
  Crown,
  Star,
  Shield,
  Users,
  MoreHorizontal,
  Check,
  Percent,
  Loader2,
} from 'lucide-react';
import { membershipService, type MembershipPlan as APIPlan } from '../../../services';

interface MembershipPlan {
  id: string;
  name: string;
  tier: 'basic' | 'silver' | 'gold' | 'platinum';
  monthlyFee: number;
  annualFee: number;
  discountPercent: number;
  familyMembers: number;
  benefits: string[];
  isActive: boolean;
  membersCount: number;
}

const mockPlans: MembershipPlan[] = [
  {
    id: '1',
    name: 'Basic Care',
    tier: 'basic',
    monthlyFee: 500,
    annualFee: 5000,
    discountPercent: 5,
    familyMembers: 0,
    benefits: ['5% discount on consultations', 'Priority booking'],
    isActive: true,
    membersCount: 1250,
  },
  {
    id: '2',
    name: 'Silver Health',
    tier: 'silver',
    monthlyFee: 1500,
    annualFee: 15000,
    discountPercent: 10,
    familyMembers: 2,
    benefits: ['10% discount on all services', 'Priority booking', 'Free annual checkup', '2 family members'],
    isActive: true,
    membersCount: 820,
  },
  {
    id: '3',
    name: 'Gold Premium',
    tier: 'gold',
    monthlyFee: 3000,
    annualFee: 30000,
    discountPercent: 15,
    familyMembers: 4,
    benefits: ['15% discount on all services', 'Priority booking', 'Free quarterly checkups', '4 family members', 'Free home visits'],
    isActive: true,
    membersCount: 450,
  },
  {
    id: '4',
    name: 'Platinum Elite',
    tier: 'platinum',
    monthlyFee: 5000,
    annualFee: 50000,
    discountPercent: 25,
    familyMembers: 6,
    benefits: ['25% discount on all services', 'VIP priority', 'Unlimited checkups', '6 family members', 'Free home visits', 'Dedicated care manager'],
    isActive: true,
    membersCount: 180,
  },
  {
    id: '5',
    name: 'Student Plan',
    tier: 'basic',
    monthlyFee: 300,
    annualFee: 3000,
    discountPercent: 8,
    familyMembers: 0,
    benefits: ['8% discount on consultations', 'Priority booking', 'Free dental checkup'],
    isActive: false,
    membersCount: 0,
  },
];

const tierColors = {
  basic: 'bg-gray-100 text-gray-700',
  silver: 'bg-slate-100 text-slate-700',
  gold: 'bg-amber-100 text-amber-700',
  platinum: 'bg-purple-100 text-purple-700',
};

const tierIcons = {
  basic: Shield,
  silver: Star,
  gold: Crown,
  platinum: Crown,
};

const tiers = ['All', 'basic', 'silver', 'gold', 'platinum'];

export default function MembershipPlansPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState('All');

  // Fetch plans from API
  const { data: apiPlans, isLoading } = useQuery({
    queryKey: ['membership-plans'],
    queryFn: () => membershipService.plans.list(),
    staleTime: 60000,
  });

  // Transform API data with fallback
  const plans: MembershipPlan[] = useMemo(() => {
    if (!apiPlans) return [];
    return apiPlans.map((p: APIPlan) => ({
      id: p.id,
      name: p.name,
      tier: p.tier,
      monthlyFee: p.monthlyFee,
      annualFee: p.annualFee,
      discountPercent: p.discountPercent,
      familyMembers: p.familyMembers,
      benefits: p.benefits,
      isActive: p.isActive,
      membersCount: p.membersCount || 0,
    }));
  }, [apiPlans]);

  // Toggle status mutation
  const toggleMutation = useMutation({
    mutationFn: (id: string) => membershipService.plans.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-plans'] });
    },
  });

  const filteredPlans = useMemo(() => {
    return plans.filter(plan => {
      const matchesSearch = plan.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTier = selectedTier === 'All' || plan.tier === selectedTier;
      return matchesSearch && matchesTier;
    });
  }, [plans, searchTerm, selectedTier]);

  const togglePlanStatus = (id: string) => {
    toggleMutation.mutate(id);
  };

  const stats = useMemo(() => ({
    total: plans.length,
    active: plans.filter(p => p.isActive).length,
    totalMembers: plans.reduce((sum, p) => sum + p.membersCount, 0),
  }), [plans]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Membership Plans</h1>
            <p className="text-sm text-gray-500">Manage membership tiers and pricing</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Plan
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Total Plans:</span>
            <span className="font-semibold">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-sm text-gray-500">Active:</span>
            <span className="font-semibold text-green-600">{stats.active}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-500">Total Members:</span>
            <span className="font-semibold text-blue-600">{stats.totalMembers.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search plans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            {tiers.map(tier => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`px-3 py-1.5 rounded-full text-sm capitalize transition-colors ${
                  selectedTier === tier
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map(plan => {
            const TierIcon = tierIcons[plan.tier];
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-lg border p-5 ${!plan.isActive ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${tierColors[plan.tier]}`}>
                      <TierIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs capitalize ${tierColors[plan.tier]}`}>
                        {plan.tier}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => togglePlanStatus(plan.id)}
                      className={`p-1.5 rounded ${
                        plan.isActive
                          ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                          : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Monthly</p>
                    <p className="text-lg font-bold text-gray-900">KES {plan.monthlyFee.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Annual</p>
                    <p className="text-lg font-bold text-gray-900">KES {plan.annualFee.toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-1.5 text-green-600">
                    <Percent className="w-4 h-4" />
                    <span>{plan.discountPercent}% discount</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-blue-600">
                    <Users className="w-4 h-4" />
                    <span>{plan.familyMembers} family</span>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <p className="text-xs text-gray-500 mb-2">Benefits included:</p>
                  <ul className="space-y-1">
                    {plan.benefits.slice(0, 3).map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                        <span className="truncate">{benefit}</span>
                      </li>
                    ))}
                    {plan.benefits.length > 3 && (
                      <li className="text-xs text-blue-600">+{plan.benefits.length - 3} more</li>
                    )}
                  </ul>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {plan.membersCount.toLocaleString()} members
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
