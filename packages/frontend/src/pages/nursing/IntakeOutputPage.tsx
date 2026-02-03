import React from 'react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Droplet,
  Search,
  UserCircle,
  Plus,
  Minus,
  Scale,
  Clock,
  Trash2,
  Loader2,
  AlertTriangle,
  Target,
  ChevronDown,
  ChevronRight,
  Activity,
  Beaker,
  Syringe,
  Settings,
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown,
  Bell,
  Check,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  ComposedChart,
  Area,
} from 'recharts';
import { toast } from 'sonner';
import { patientsService } from '../../services/patients';
import { ipdService, type CreateNursingNoteDto } from '../../services/ipd';
import PermissionGate, { usePermissions } from '../../components/PermissionGate';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  weight?: number;
  ward?: string;
  bed?: string;
  admissionId?: string;
}

interface IOEntry {
  id: string;
  time: string;
  timestamp: Date;
  type: 'intake' | 'output';
  category: string;
  subCategory?: string;
  amount: number;
  notes?: string;
  characteristics?: {
    color?: string;
    clarity?: string;
    consistency?: string;
  };
  recordedBy?: string;
}

interface FluidTarget {
  dailyIntake: number;
  dailyOutput: number;
  minUrineOutput: number; // ml/kg/hr
}

interface HourlyData {
  hour: string;
  intake: number;
  output: number;
  balance: number;
  cumulativeBalance: number;
  entries: IOEntry[];
}

type ShiftType = 'day' | 'evening' | 'night';

// Calculate age from date of birth
const calculateAge = (dob?: string): number => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Get current shift based on time
const getCurrentShift = (): ShiftType => {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 15) return 'day';
  if (hour >= 15 && hour < 23) return 'evening';
  return 'night';
};

// Get shift time range
const getShiftHours = (shift: ShiftType): { start: number; end: number } => {
  switch (shift) {
    case 'day': return { start: 7, end: 14 };
    case 'evening': return { start: 15, end: 22 };
    case 'night': return { start: 23, end: 6 };
  }
};

const intakeCategories = [
  { value: 'oral', label: 'Oral', icon: '🥤', subItems: ['Water', 'Tea', 'Coffee', 'Juice', 'Milk', 'Soup', 'Other'] },
  { value: 'iv', label: 'IV Fluids', icon: '💉', subItems: ['NS 0.9%', 'D5W', 'RL', 'D5NS', 'IV Bolus', 'Medication Drip'] },
  { value: 'blood', label: 'Blood Products', icon: '🩸', subItems: ['PRBC', 'FFP', 'Platelets', 'Cryoprecipitate', 'Albumin'] },
  { value: 'ng', label: 'NG Tube', icon: '🔌', subItems: ['Tube Feed', 'Flush', 'Medication'] },
  { value: 'tpn', label: 'TPN', icon: '💧', subItems: ['TPN', 'Lipids', 'PPN'] },
];

const outputCategories = [
  { value: 'urine', label: 'Urine', icon: '🚽', subItems: ['Void', 'Foley', 'Straight Cath', 'Nephrostomy'] },
  { value: 'stool', label: 'Stool', icon: '💩', subItems: ['Normal', 'Loose', 'Diarrhea', 'Formed'] },
  { value: 'emesis', label: 'Vomit', icon: '🤢', subItems: ['Clear', 'Bilious', 'Coffee Ground', 'Bloody'] },
  { value: 'drain', label: 'Drain', icon: '💧', subItems: ['JP Drain', 'Chest Tube', 'Hemovac', 'Penrose'] },
  { value: 'ng_aspirate', label: 'NG Aspirate', icon: '📍', subItems: ['Gastric', 'Bilious'] },
  { value: 'blood_loss', label: 'Blood Loss', icon: '🩸', subItems: ['Surgical', 'Wound', 'GI Bleed'] },
];

const urineColors = ['Pale Yellow', 'Yellow', 'Dark Yellow', 'Amber', 'Orange', 'Pink', 'Red', 'Brown', 'Clear'];
const urineClarity = ['Clear', 'Slightly Cloudy', 'Cloudy', 'Turbid'];
const stoolConsistency = ['Formed', 'Soft', 'Loose', 'Watery', 'Hard', 'Pellets'];

const quickAmounts = [50, 100, 150, 200, 250, 300, 500, 1000];

// Quick action presets
const quickActions = [
  { id: 'void_commode', label: 'Void in Commode', type: 'output' as const, category: 'Urine', subCategory: 'Void', amount: 250 },
  { id: 'empty_foley', label: 'Empty Foley Bag', type: 'output' as const, category: 'Urine', subCategory: 'Foley', amount: 0, requiresInput: true },
  { id: 'ng_flush', label: 'NG Tube Flush', type: 'intake' as const, category: 'NG Tube', subCategory: 'Flush', amount: 30 },
  { id: 'iv_maintenance', label: 'IV Maintenance (1hr)', type: 'intake' as const, category: 'IV Fluids', subCategory: 'NS 0.9%', amount: 125 },
  { id: 'po_water', label: 'Water (1 Cup)', type: 'intake' as const, category: 'Oral', subCategory: 'Water', amount: 240 },
  { id: 'ice_chips', label: 'Ice Chips', type: 'intake' as const, category: 'Oral', subCategory: 'Water', amount: 30 },
];

export default function IntakeOutputPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  
  // Permission checks
  const canRead = hasPermission('nursing.read');
  const canCreate = hasPermission('nursing.create');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [entries, setEntries] = useState<IOEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<'intake' | 'output'>('intake');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chart' | 'visualization'>('dashboard');
  const [expandedHours, setExpandedHours] = useState<Set<string>>(new Set());
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [quickActionAmount, setQuickActionAmount] = useState<number>(0);
  const [selectedQuickAction, setSelectedQuickAction] = useState<typeof quickActions[0] | null>(null);
  
  // Fluid targets
  const [fluidTarget, setFluidTarget] = useState<FluidTarget>({
    dailyIntake: 2000,
    dailyOutput: 1500,
    minUrineOutput: 0.5, // ml/kg/hr
  });

  const [newEntry, setNewEntry] = useState({
    time: new Date().toTimeString().slice(0, 5),
    category: '',
    subCategory: '',
    amount: '',
    notes: '',
    characteristics: {
      color: '',
      clarity: '',
      consistency: '',
    },
  });

  // Search patients from API
  const { data: apiPatients, isLoading: searchLoading } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.length >= 2,
  });

  // Get current admission for selected patient
  const { data: admission } = useQuery({
    queryKey: ['patient-admission', selectedPatient?.id],
    queryFn: async () => {
      const response = await ipdService.admissions.list({ patientId: selectedPatient!.id, status: 'admitted' });
      return response.data[0] || null;
    },
    enabled: !!selectedPatient?.id,
  });

  // Create nursing note mutation for I/O recording
  const createNoteMutation = useMutation({
    mutationFn: (data: CreateNursingNoteDto) => ipdService.nursingNotes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nursing-notes'] });
      toast.success('I/O entry recorded successfully');
    },
    onError: () => {
      toast.error('Failed to save I/O entry');
    },
  });

  const filteredPatients = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const patients = apiPatients?.data || [];
    return patients.map(p => ({
      id: p.id,
      mrn: p.mrn,
      name: p.fullName,
      age: calculateAge(p.dateOfBirth),
      gender: p.gender,
      weight: (p as { weight?: number }).weight,
    }));
  }, [apiPatients, searchTerm]);

  // Calculate totals and summaries
  const {
    totalIntake,
    totalOutput,
    balance,
    intakeByCategory,
    outputByCategory,
    shiftIntake,
    shiftOutput,
    shiftBalance,
    hourlyData,
    isImbalanced,
    lowUrineOutput,
    fluidOverload,
  } = useMemo(() => {
    const now = new Date();
    const currentShift = getCurrentShift();
    const shiftHours = getShiftHours(currentShift);
    
    const intakes = entries.filter((e) => e.type === 'intake');
    const outputs = entries.filter((e) => e.type === 'output');
    
    // 24-hour totals
    const totalIn = intakes.reduce((sum, e) => sum + e.amount, 0);
    const totalOut = outputs.reduce((sum, e) => sum + e.amount, 0);

    // Shift totals
    const shiftIn = intakes
      .filter(e => {
        const hour = parseInt(e.time.split(':')[0]);
        if (currentShift === 'night') {
          return hour >= shiftHours.start || hour <= shiftHours.end;
        }
        return hour >= shiftHours.start && hour <= shiftHours.end;
      })
      .reduce((sum, e) => sum + e.amount, 0);
    
    const shiftOut = outputs
      .filter(e => {
        const hour = parseInt(e.time.split(':')[0]);
        if (currentShift === 'night') {
          return hour >= shiftHours.start || hour <= shiftHours.end;
        }
        return hour >= shiftHours.start && hour <= shiftHours.end;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    const intakeByCat: Record<string, number> = {};
    intakes.forEach((e) => {
      intakeByCat[e.category] = (intakeByCat[e.category] || 0) + e.amount;
    });

    const outputByCat: Record<string, number> = {};
    outputs.forEach((e) => {
      outputByCat[e.category] = (outputByCat[e.category] || 0) + e.amount;
    });

    // Hourly breakdown
    const hourlyMap = new Map<string, HourlyData>();
    for (let h = 0; h < 24; h++) {
      const hourStr = h.toString().padStart(2, '0') + ':00';
      hourlyMap.set(hourStr, {
        hour: hourStr,
        intake: 0,
        output: 0,
        balance: 0,
        cumulativeBalance: 0,
        entries: [],
      });
    }

    entries.forEach(entry => {
      const hourKey = entry.time.split(':')[0].padStart(2, '0') + ':00';
      const hourData = hourlyMap.get(hourKey);
      if (hourData) {
        if (entry.type === 'intake') {
          hourData.intake += entry.amount;
        } else {
          hourData.output += entry.amount;
        }
        hourData.entries.push(entry);
      }
    });

    // Calculate balances
    let cumulative = 0;
    hourlyMap.forEach(data => {
      data.balance = data.intake - data.output;
      cumulative += data.balance;
      data.cumulativeBalance = cumulative;
    });

    const hourlyDataArr = Array.from(hourlyMap.values());

    // Alerts
    const balanceVal = totalIn - totalOut;
    const isImbalancedVal = Math.abs(balanceVal) > 500;
    
    // Calculate urine output per hour (simplified)
    const urineEntries = outputs.filter(e => e.category === 'Urine');
    const totalUrine = urineEntries.reduce((sum, e) => sum + e.amount, 0);
    const hoursTracked = entries.length > 0 ? 
      Math.max(1, Math.ceil((now.getTime() - Math.min(...entries.map(e => e.timestamp?.getTime() || now.getTime()))) / (1000 * 60 * 60))) : 1;
    const urinePerHour = totalUrine / hoursTracked;
    const patientWeight = selectedPatient?.weight || 70;
    const urinePerKgHr = urinePerHour / patientWeight;
    
    return {
      totalIntake: totalIn,
      totalOutput: totalOut,
      balance: balanceVal,
      intakeByCategory: intakeByCat,
      outputByCategory: outputByCat,
      shiftIntake: shiftIn,
      shiftOutput: shiftOut,
      shiftBalance: shiftIn - shiftOut,
      hourlyData: hourlyDataArr,
      isImbalanced: isImbalancedVal,
      lowUrineOutput: urinePerKgHr < fluidTarget.minUrineOutput,
      fluidOverload: balanceVal > 1000,
    };
  }, [entries, selectedPatient?.weight, fluidTarget.minUrineOutput]);

  // Auto-refresh every minute
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['nursing-notes'] });
    }, 60000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const handleAddEntry = useCallback(() => {
    if (!newEntry.category || !newEntry.amount) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    const now = new Date();
    const [hours, minutes] = newEntry.time.split(':').map(Number);
    const timestamp = new Date(now);
    timestamp.setHours(hours, minutes, 0, 0);
    
    const entry: IOEntry = {
      id: Date.now().toString(),
      time: newEntry.time,
      timestamp,
      type: addType,
      category: newEntry.category,
      subCategory: newEntry.subCategory || undefined,
      amount: parseInt(newEntry.amount),
      notes: newEntry.notes || undefined,
      characteristics: (addType === 'output' && (newEntry.category === 'Urine' || newEntry.category === 'Stool'))
        ? newEntry.characteristics
        : undefined,
    };
    
    setEntries((prev) => [...prev, entry].sort((a, b) => a.time.localeCompare(b.time)));
    
    // Save to backend if we have an admission
    if (admission?.id) {
      const ioData = addType === 'intake' 
        ? { oralIntake: parseInt(newEntry.amount) }
        : { urineOutput: parseInt(newEntry.amount) };
      
      createNoteMutation.mutate({
        admissionId: admission.id,
        type: 'observation',
        content: `${addType === 'intake' ? 'Intake' : 'Output'}: ${newEntry.category}${newEntry.subCategory ? ` (${newEntry.subCategory})` : ''} - ${newEntry.amount}ml${newEntry.notes ? '. ' + newEntry.notes : ''}`,
        intakeOutput: ioData,
      });
    } else {
      toast.success('I/O entry added');
    }
    
    setNewEntry({
      time: new Date().toTimeString().slice(0, 5),
      category: '',
      subCategory: '',
      amount: '',
      notes: '',
      characteristics: { color: '', clarity: '', consistency: '' },
    });
    setShowAddForm(false);
  }, [newEntry, addType, admission?.id, createNoteMutation]);

  const handleQuickAction = useCallback((action: typeof quickActions[0]) => {
    if (action.requiresInput) {
      setSelectedQuickAction(action);
      setQuickActionAmount(0);
      return;
    }
    
    const now = new Date();
    const entry: IOEntry = {
      id: Date.now().toString(),
      time: now.toTimeString().slice(0, 5),
      timestamp: now,
      type: action.type,
      category: action.category,
      subCategory: action.subCategory,
      amount: action.amount,
      notes: `Quick action: ${action.label}`,
    };
    
    setEntries((prev) => [...prev, entry].sort((a, b) => a.time.localeCompare(b.time)));
    
    if (admission?.id) {
      const ioData = action.type === 'intake'
        ? { oralIntake: action.amount }
        : { urineOutput: action.amount };
      
      createNoteMutation.mutate({
        admissionId: admission.id,
        type: 'observation',
        content: `${action.type === 'intake' ? 'Intake' : 'Output'}: ${action.label} - ${action.amount}ml`,
        intakeOutput: ioData,
      });
    } else {
      toast.success(`${action.label} recorded`);
    }
  }, [admission?.id, createNoteMutation]);

  const handleQuickActionWithAmount = useCallback(() => {
    if (!selectedQuickAction || quickActionAmount <= 0) return;
    
    const now = new Date();
    const entry: IOEntry = {
      id: Date.now().toString(),
      time: now.toTimeString().slice(0, 5),
      timestamp: now,
      type: selectedQuickAction.type,
      category: selectedQuickAction.category,
      subCategory: selectedQuickAction.subCategory,
      amount: quickActionAmount,
      notes: `Quick action: ${selectedQuickAction.label}`,
    };
    
    setEntries((prev) => [...prev, entry].sort((a, b) => a.time.localeCompare(b.time)));
    
    if (admission?.id) {
      const ioData = selectedQuickAction.type === 'intake'
        ? { oralIntake: quickActionAmount }
        : { urineOutput: quickActionAmount };
      
      createNoteMutation.mutate({
        admissionId: admission.id,
        type: 'observation',
        content: `${selectedQuickAction.type === 'intake' ? 'Intake' : 'Output'}: ${selectedQuickAction.label} - ${quickActionAmount}ml`,
        intakeOutput: ioData,
      });
    } else {
      toast.success(`${selectedQuickAction.label} recorded: ${quickActionAmount}ml`);
    }
    
    setSelectedQuickAction(null);
    setQuickActionAmount(0);
  }, [selectedQuickAction, quickActionAmount, admission?.id, createNoteMutation]);

  const handleDeleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast.success('Entry deleted');
  };

  const toggleHourExpand = (hour: string) => {
    setExpandedHours(prev => {
      const next = new Set(prev);
      if (next.has(hour)) {
        next.delete(hour);
      } else {
        next.add(hour);
      }
      return next;
    });
  };

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.time.localeCompare(a.time));
  }, [entries]);

  // Permission check
  if (!canRead) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don&apos;t have permission to view I/O tracking.</p>
          <p className="text-sm text-gray-500 mt-2">Required permission: nursing.read</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Droplet className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Intake/Output Tracking</h1>
              <p className="text-sm text-gray-500">24-hour I/O chart • {getCurrentShift().toUpperCase()} Shift</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Alerts */}
          {selectedPatient && (isImbalanced || lowUrineOutput || fluidOverload) && (
            <div className="flex items-center gap-2">
              {isImbalanced && (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Imbalanced (&gt;500ml)</span>
                </div>
              )}
              {lowUrineOutput && (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm">
                  <TrendingDown className="w-4 h-4" />
                  <span>Low Urine Output</span>
                </div>
              )}
              {fluidOverload && (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>Fluid Overload</span>
                </div>
              )}
            </div>
          )}
          
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['nursing-notes'] })}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5 text-gray-500" />
          </button>
          
          {selectedPatient && (
            <button
              onClick={() => setShowTargetModal(true)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              <Target className="w-4 h-4" />
              Set Targets
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0 overflow-hidden">
        {/* Patient Selection with I/O Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col overflow-hidden">
          <h2 className="font-semibold text-gray-900 mb-3 flex-shrink-0">Select Patient</h2>
          <div className="relative mb-3 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or MRN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {searchTerm && searchTerm.length >= 2 ? (
              searchLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                </div>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => {
                      setSelectedPatient(patient);
                      setSearchTerm('');
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedPatient?.id === patient.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <UserCircle className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{patient.name}</p>
                        <p className="text-xs text-gray-500">{patient.mrn} • {patient.age}y • {patient.gender}</p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No patients found</p>
              )
            ) : selectedPatient ? (
              <>
                <div className="p-3 rounded-lg border border-teal-500 bg-teal-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-teal-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{selectedPatient.name}</p>
                      <p className="text-xs text-gray-500">{selectedPatient.mrn} • {selectedPatient.age}y</p>
                      {admission && (
                        <p className="text-xs text-teal-600">{admission.ward?.name} - Bed {admission.bed?.bedNumber}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* I/O Status Summary */}
                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase">Current Status</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-green-50 p-2 rounded">
                      <p className="text-green-600">Intake</p>
                      <p className="font-bold text-green-700">{totalIntake} ml</p>
                    </div>
                    <div className="bg-orange-50 p-2 rounded">
                      <p className="text-orange-600">Output</p>
                      <p className="font-bold text-orange-700">{totalOutput} ml</p>
                    </div>
                  </div>
                  <div className={`p-2 rounded text-center ${
                    balance >= 0 ? 'bg-blue-50' : 'bg-red-50'
                  }`}>
                    <p className="text-xs text-gray-600">Balance</p>
                    <p className={`font-bold ${balance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {balance >= 0 ? '+' : ''}{balance} ml
                    </p>
                  </div>
                  
                  {/* Progress toward targets */}
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Intake Target</span>
                      <span>{totalIntake}/{fluidTarget.dailyIntake} ml</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-green-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (totalIntake / fluidTarget.dailyIntake) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Search for a patient to track I/O</p>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0 overflow-hidden">
          {selectedPatient ? (
            <>
              {/* Tab Navigation */}
              <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-2 flex-shrink-0">
                <div className="flex gap-1">
                  {[
                    { id: 'dashboard', label: 'Dashboard', icon: Activity },
                    { id: 'chart', label: 'I/O Chart', icon: Clock },
                    { id: 'visualization', label: 'Visualization', icon: TrendingUp },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'bg-teal-500 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>
                
                {/* Quick Actions */}
                <div className="relative">
                  <PermissionGate permissions={['nursing.create']}>
                    <button
                      onClick={() => setShowQuickActions(!showQuickActions)}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                    >
                      <Zap className="w-4 h-4" />
                      Quick Actions
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </PermissionGate>
                  
                  {showQuickActions && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      {quickActions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => {
                            handleQuickAction(action);
                            if (!action.requiresInput) setShowQuickActions(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                        >
                          <span>{action.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            action.type === 'intake' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {action.type === 'intake' ? 'IN' : 'OUT'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Dashboard Tab */}
              {activeTab === 'dashboard' && (
                <div className="flex-1 overflow-y-auto space-y-4">
                  {/* Summary Cards Row */}
                  <div className="grid grid-cols-4 gap-3">
                    {/* Shift Totals */}
                    <div className="bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-teal-600" />
                        <span className="text-xs font-medium text-teal-700 uppercase">Current Shift</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-lg font-bold text-green-600">{shiftIntake}</p>
                          <p className="text-xs text-gray-500">In</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-orange-600">{shiftOutput}</p>
                          <p className="text-xs text-gray-500">Out</p>
                        </div>
                        <div>
                          <p className={`text-lg font-bold ${shiftBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {shiftBalance >= 0 ? '+' : ''}{shiftBalance}
                          </p>
                          <p className="text-xs text-gray-500">Bal</p>
                        </div>
                      </div>
                    </div>

                    {/* 24hr Intake */}
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-green-600" />
                          <span className="text-xs font-medium text-green-700">24hr Intake</span>
                        </div>
                        <span className="text-xs text-green-600">{Math.round((totalIntake / fluidTarget.dailyIntake) * 100)}%</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700">{totalIntake} ml</p>
                      <div className="w-full bg-green-200 rounded-full h-1.5 mt-2">
                        <div 
                          className="bg-green-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, (totalIntake / fluidTarget.dailyIntake) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-green-600 mt-1">Target: {fluidTarget.dailyIntake} ml</p>
                    </div>

                    {/* 24hr Output */}
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Minus className="w-4 h-4 text-orange-600" />
                          <span className="text-xs font-medium text-orange-700">24hr Output</span>
                        </div>
                        <span className="text-xs text-orange-600">{Math.round((totalOutput / fluidTarget.dailyOutput) * 100)}%</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-700">{totalOutput} ml</p>
                      <div className="w-full bg-orange-200 rounded-full h-1.5 mt-2">
                        <div 
                          className="bg-orange-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, (totalOutput / fluidTarget.dailyOutput) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-orange-600 mt-1">Target: {fluidTarget.dailyOutput} ml</p>
                    </div>

                    {/* Net Balance */}
                    <div className={`border rounded-xl p-4 ${
                      isImbalanced 
                        ? 'bg-yellow-50 border-yellow-300' 
                        : balance >= 0 
                          ? 'bg-blue-50 border-blue-200' 
                          : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Scale className="w-4 h-4 text-gray-600" />
                        <span className="text-xs font-medium text-gray-700">Net Balance</span>
                        {isImbalanced && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                      </div>
                      <p className={`text-2xl font-bold ${
                        isImbalanced 
                          ? 'text-yellow-700' 
                          : balance >= 0 
                            ? 'text-blue-700' 
                            : 'text-red-700'
                      }`}>
                        {balance >= 0 ? '+' : ''}{balance} ml
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {balance >= 0 ? 'Positive (retention)' : 'Negative (deficit)'}
                      </p>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-green-600" />
                        Intake by Category
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(intakeByCategory).length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">No intake recorded</p>
                        ) : (
                          Object.entries(intakeByCategory).map(([cat, amt]) => (
                            <div key={cat} className="flex items-center justify-between">
                              <span className="text-sm text-gray-700">{cat}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-green-500 h-2 rounded-full"
                                    style={{ width: `${Math.min(100, (amt / totalIntake) * 100)}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-green-700 w-16 text-right">{amt} ml</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Minus className="w-4 h-4 text-orange-600" />
                        Output by Category
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(outputByCategory).length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">No output recorded</p>
                        ) : (
                          Object.entries(outputByCategory).map(([cat, amt]) => (
                            <div key={cat} className="flex items-center justify-between">
                              <span className="text-sm text-gray-700">{cat}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-orange-500 h-2 rounded-full"
                                    style={{ width: `${Math.min(100, (amt / totalOutput) * 100)}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-orange-700 w-16 text-right">{amt} ml</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Add Entry Section */}
                  <PermissionGate permissions={['nursing.create']}>
                    {showAddForm ? (
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-gray-900">
                            Add {addType === 'intake' ? 'Intake' : 'Output'}
                          </h3>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setAddType('intake')}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                                addType === 'intake'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              Intake
                            </button>
                            <button
                              onClick={() => setAddType('output')}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                                addType === 'output'
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              Output
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-6 gap-3 mb-4">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Time</label>
                            <input
                              type="time"
                              value={newEntry.time}
                              onChange={(e) => setNewEntry({ ...newEntry, time: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Type</label>
                            <select
                              value={newEntry.category}
                              onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value, subCategory: '' })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="">Select...</option>
                              {(addType === 'intake' ? intakeCategories : outputCategories).map((cat) => (
                                <option key={cat.value} value={cat.label}>
                                  {cat.icon} {cat.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Sub-type</label>
                            <select
                              value={newEntry.subCategory}
                              onChange={(e) => setNewEntry({ ...newEntry, subCategory: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              disabled={!newEntry.category}
                            >
                              <option value="">Select...</option>
                              {(addType === 'intake' ? intakeCategories : outputCategories)
                                .find(c => c.label === newEntry.category)?.subItems?.map((sub) => (
                                  <option key={sub} value={sub}>{sub}</option>
                                ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Amount (ml)</label>
                            <input
                              type="number"
                              value={newEntry.amount}
                              onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                              placeholder="0"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-gray-500 block mb-1">Notes</label>
                            <input
                              type="text"
                              value={newEntry.notes}
                              onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                              placeholder="Optional notes..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                        </div>

                        {/* Quick Amount Buttons */}
                        <div className="mb-4">
                          <label className="text-xs text-gray-500 block mb-2">Quick Amounts</label>
                          <div className="flex flex-wrap gap-2">
                            {quickAmounts.map((amt) => (
                              <button
                                key={amt}
                                onClick={() => setNewEntry({ ...newEntry, amount: amt.toString() })}
                                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                                  newEntry.amount === amt.toString()
                                    ? 'bg-teal-500 text-white border-teal-500'
                                    : 'border-gray-300 hover:border-teal-500 hover:bg-teal-50'
                                }`}
                              >
                                {amt} ml
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Characteristics for Urine/Stool */}
                        {addType === 'output' && (newEntry.category === 'Urine' || newEntry.category === 'Stool') && (
                          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <label className="text-xs text-gray-500 block mb-2">Characteristics</label>
                            <div className="grid grid-cols-3 gap-3">
                              {newEntry.category === 'Urine' && (
                                <>
                                  <div>
                                    <label className="text-xs text-gray-500 block mb-1">Color</label>
                                    <select
                                      value={newEntry.characteristics.color}
                                      onChange={(e) => setNewEntry({
                                        ...newEntry,
                                        characteristics: { ...newEntry.characteristics, color: e.target.value }
                                      })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    >
                                      <option value="">Select...</option>
                                      {urineColors.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500 block mb-1">Clarity</label>
                                    <select
                                      value={newEntry.characteristics.clarity}
                                      onChange={(e) => setNewEntry({
                                        ...newEntry,
                                        characteristics: { ...newEntry.characteristics, clarity: e.target.value }
                                      })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    >
                                      <option value="">Select...</option>
                                      {urineClarity.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                  </div>
                                </>
                              )}
                              {newEntry.category === 'Stool' && (
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Consistency</label>
                                  <select
                                    value={newEntry.characteristics.consistency}
                                    onChange={(e) => setNewEntry({
                                      ...newEntry,
                                      characteristics: { ...newEntry.characteristics, consistency: e.target.value }
                                    })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  >
                                    <option value="">Select...</option>
                                    {stoolConsistency.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setShowAddForm(false)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleAddEntry}
                            disabled={!newEntry.category || !newEntry.amount || !canCreate}
                            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
                          >
                            Add Entry
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setAddType('intake'); setShowAddForm(true); }}
                          disabled={!canCreate}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                          Add Intake
                        </button>
                        <button
                          onClick={() => { setAddType('output'); setShowAddForm(true); }}
                          disabled={!canCreate}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50"
                        >
                          <Minus className="w-4 h-4" />
                          Add Output
                        </button>
                      </div>
                    )}
                  </PermissionGate>
                </div>
              )}

              {/* I/O Chart Tab */}
              {activeTab === 'chart' && (
                <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <h3 className="font-semibold text-gray-900">Hourly I/O Chart</h3>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-500 rounded" />
                        <span>Intake</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-orange-500 rounded" />
                        <span>Output</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-500 rounded" />
                        <span>Balance</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="text-left text-xs text-gray-500 border-b">
                          <th className="pb-2 font-medium w-8"></th>
                          <th className="pb-2 font-medium">Hour</th>
                          <th className="pb-2 font-medium text-right text-green-600">Intake</th>
                          <th className="pb-2 font-medium text-right text-orange-600">Output</th>
                          <th className="pb-2 font-medium text-right">Hourly Bal.</th>
                          <th className="pb-2 font-medium text-right">Running Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hourlyData.filter(h => h.intake > 0 || h.output > 0).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-gray-500">
                              <Droplet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                              <p>No entries recorded yet</p>
                            </td>
                          </tr>
                        ) : (
                          hourlyData.map((hour) => {
                            const hasEntries = hour.entries.length > 0;
                            const isExpanded = expandedHours.has(hour.hour);
                            
                            if (!hasEntries) return null;
                            
                            return (
                              <React.Fragment key={hour.hour}>
                                <tr 
                                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                  onClick={() => toggleHourExpand(hour.hour)}
                                >
                                  <td className="py-2">
                                    {hasEntries && (
                                      isExpanded 
                                        ? <ChevronDown className="w-4 h-4 text-gray-400" />
                                        : <ChevronRight className="w-4 h-4 text-gray-400" />
                                    )}
                                  </td>
                                  <td className="py-2 font-medium">{hour.hour}</td>
                                  <td className="py-2 text-right text-green-600 font-medium">
                                    {hour.intake > 0 ? `${hour.intake} ml` : '-'}
                                  </td>
                                  <td className="py-2 text-right text-orange-600 font-medium">
                                    {hour.output > 0 ? `${hour.output} ml` : '-'}
                                  </td>
                                  <td className={`py-2 text-right font-medium ${
                                    hour.balance > 0 ? 'text-blue-600' : hour.balance < 0 ? 'text-red-600' : 'text-gray-400'
                                  }`}>
                                    {hour.balance !== 0 ? `${hour.balance > 0 ? '+' : ''}${hour.balance}` : '-'}
                                  </td>
                                  <td className={`py-2 text-right font-bold ${
                                    hour.cumulativeBalance > 0 ? 'text-blue-700' : hour.cumulativeBalance < 0 ? 'text-red-700' : 'text-gray-500'
                                  }`}>
                                    {hour.cumulativeBalance > 0 ? '+' : ''}{hour.cumulativeBalance} ml
                                  </td>
                                </tr>
                                
                                {/* Expanded entries */}
                                {isExpanded && hour.entries.map((entry) => (
                                  <tr key={entry.id} className="bg-gray-50 text-xs">
                                    <td></td>
                                    <td className="py-1.5 pl-4 text-gray-500">{entry.time}</td>
                                    <td colSpan={2} className="py-1.5">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
                                        entry.type === 'intake' 
                                          ? 'bg-green-100 text-green-700' 
                                          : 'bg-orange-100 text-orange-700'
                                      }`}>
                                        {entry.type === 'intake' ? 'IN' : 'OUT'}: {entry.category}
                                        {entry.subCategory && ` (${entry.subCategory})`}
                                      </span>
                                    </td>
                                    <td className="py-1.5 text-right font-medium">{entry.amount} ml</td>
                                    <td className="py-1.5 text-right">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id); }}
                                        className="p-1 text-gray-400 hover:text-red-500"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })
                        )}
                        
                        {/* Shift Subtotals */}
                        {entries.length > 0 && (
                          <>
                            <tr className="bg-teal-50 font-semibold">
                              <td></td>
                              <td className="py-2">Shift Total</td>
                              <td className="py-2 text-right text-green-700">{shiftIntake} ml</td>
                              <td className="py-2 text-right text-orange-700">{shiftOutput} ml</td>
                              <td className={`py-2 text-right ${shiftBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                                {shiftBalance >= 0 ? '+' : ''}{shiftBalance} ml
                              </td>
                              <td></td>
                            </tr>
                            <tr className="bg-gray-100 font-bold">
                              <td></td>
                              <td className="py-2">24hr Total</td>
                              <td className="py-2 text-right text-green-700">{totalIntake} ml</td>
                              <td className="py-2 text-right text-orange-700">{totalOutput} ml</td>
                              <td className={`py-2 text-right ${balance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                                {balance >= 0 ? '+' : ''}{balance} ml
                              </td>
                              <td></td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Visualization Tab */}
              {activeTab === 'visualization' && (
                <div className="flex-1 grid grid-cols-1 gap-4 overflow-y-auto">
                  {/* Bar Chart - Intake vs Output */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Hourly Intake vs Output</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourlyData.filter(h => h.intake > 0 || h.output > 0)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip 
                            formatter={(value) => `${value} ml`}
                            labelFormatter={(label) => `Hour: ${label}`}
                          />
                          <Legend />
                          <Bar dataKey="intake" name="Intake" fill="#22c55e" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="output" name="Output" fill="#f97316" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Line Chart - Cumulative Balance */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Cumulative Fluid Balance</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={hourlyData.filter(h => h.intake > 0 || h.output > 0 || h.cumulativeBalance !== 0)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip 
                            formatter={(value) => `${value} ml`}
                            labelFormatter={(label) => `Hour: ${label}`}
                          />
                          <Legend />
                          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                          <ReferenceLine y={500} stroke="#fbbf24" strokeDasharray="3 3" />
                          <ReferenceLine y={-500} stroke="#fbbf24" strokeDasharray="3 3" />
                          <ReferenceLine y={1000} stroke="#ef4444" strokeDasharray="3 3" />
                          <Area 
                            type="monotone" 
                            dataKey="cumulativeBalance" 
                            name="Cumulative Balance"
                            fill="#3b82f6"
                            fillOpacity={0.2}
                            stroke="#3b82f6"
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="balance" 
                            name="Hourly Balance"
                            stroke="#8b5cf6"
                            strokeWidth={1}
                            dot={{ r: 3 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* Alert zones legend */}
                    <div className="flex justify-center gap-6 mt-4 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5 bg-green-500" />
                        <span className="text-gray-600">Normal Range</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5 bg-yellow-500" />
                        <span className="text-gray-600">±500ml Alert Zone</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5 bg-red-500" />
                        <span className="text-gray-600">Fluid Overload (&gt;1000ml)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 bg-white rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Droplet className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to track intake/output</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Target Modal */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Set Fluid Targets</h3>
              <button onClick={() => setShowTargetModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 block mb-1">Daily Intake Target (ml)</label>
                <input
                  type="number"
                  value={fluidTarget.dailyIntake}
                  onChange={(e) => setFluidTarget({ ...fluidTarget, dailyIntake: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Daily Output Target (ml)</label>
                <input
                  type="number"
                  value={fluidTarget.dailyOutput}
                  onChange={(e) => setFluidTarget({ ...fluidTarget, dailyOutput: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Min Urine Output Alert (ml/kg/hr)</label>
                <input
                  type="number"
                  step="0.1"
                  value={fluidTarget.minUrineOutput}
                  onChange={(e) => setFluidTarget({ ...fluidTarget, minUrineOutput: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Standard: 0.5 ml/kg/hr</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowTargetModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  toast.success('Fluid targets updated');
                  setShowTargetModal(false);
                }}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
              >
                Save Targets
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Amount Modal */}
      {selectedQuickAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{selectedQuickAction.label}</h3>
            <p className="text-sm text-gray-600 mb-4">Enter the amount:</p>
            
            <input
              type="number"
              value={quickActionAmount || ''}
              onChange={(e) => setQuickActionAmount(parseInt(e.target.value) || 0)}
              placeholder="Amount in ml"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
              autoFocus
            />
            
            <div className="flex flex-wrap gap-2 mb-4">
              {[100, 200, 300, 400, 500, 600].map(amt => (
                <button
                  key={amt}
                  onClick={() => setQuickActionAmount(amt)}
                  className={`px-3 py-1 rounded border text-sm ${
                    quickActionAmount === amt 
                      ? 'bg-teal-500 text-white border-teal-500' 
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {amt} ml
                </button>
              ))}
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedQuickAction(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickActionWithAmount}
                disabled={quickActionAmount <= 0}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
              >
                Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
