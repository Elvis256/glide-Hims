import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  ArrowLeft,
  Stethoscope,
  Search,
  UserCircle,
  Save,
  CheckCircle,
  Upload,
  Camera,
  Loader2,
  Plus,
  X,
  RotateCcw,
  Image,
  ZoomIn,
  Trash2,
  Calendar,
  Clock,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
  FileText,
  Printer,
  Download,
  ChevronRight,
  ChevronDown,
  Activity,
  Ruler,
  Layers,
  Droplets,
  ThermometerSun,
  AlertCircle,
  ClipboardCheck,
  User,
  MapPin,
  Edit3,
  Eye,
  History,
  BarChart3,
  Shield,
} from 'lucide-react';
import { patientsService } from '../../services/patients';
import { ipdService, type CreateNursingNoteDto } from '../../services/ipd';
import { usePermissions } from '../../components/PermissionGate';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  ward?: string;
  bed?: string;
}

interface Wound {
  id: string;
  location: string;
  locationCoords?: { x: number; y: number; view: 'front' | 'back' };
  type: string;
  stage?: string;
  startDate: string;
  status: 'healing' | 'stable' | 'worsening' | 'healed' | 'new';
  measurements: WoundMeasurement[];
  photos: WoundPhoto[];
  treatmentPlan?: TreatmentPlan;
}

interface WoundMeasurement {
  id: string;
  date: string;
  length: number;
  width: number;
  depth: number;
  area: number;
  woundBed: {
    granulation: number;
    slough: number;
    eschar: number;
    epithelial: number;
  };
  exudate: { amount: string; type: string };
  periwound: string[];
  painLevel: number;
  odor: string;
  infectionSigns: string[];
}

interface WoundPhoto {
  id: string;
  date: string;
  url: string;
  thumbnail: string;
  hasRuler: boolean;
  notes?: string;
}

interface TreatmentPlan {
  dressingType: string;
  changeFrequency: string;
  specialTreatments: string[];
  consults: string[];
  notes?: string;
}

interface WoundAssessment {
  woundLocation: string;
  locationCoords?: { x: number; y: number; view: 'front' | 'back' };
  woundType: string;
  stage: string;
  length: string;
  width: string;
  depth: string;
  woundBed: {
    granulation: string;
    slough: string;
    eschar: string;
    epithelial: string;
  };
  exudateAmount: string;
  exudateType: string;
  periwound: string[];
  painLevel: string;
  odor: string;
  infectionSigns: string[];
  dressingType: string;
  changeFrequency: string;
  specialTreatments: string[];
  consults: string[];
  notes: string;
}

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

// Calculate days since date
const daysSince = (dateStr: string): number => {
  const date = new Date(dateStr);
  const today = new Date();
  return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
};

// Body map location coordinates for click detection
const bodyMapLocations: Record<string, { x: number; y: number; width: number; height: number; view: 'front' | 'back' }> = {
  'Head/Scalp': { x: 145, y: 10, width: 50, height: 40, view: 'front' },
  'Face': { x: 145, y: 50, width: 50, height: 40, view: 'front' },
  'Neck': { x: 150, y: 90, width: 40, height: 25, view: 'front' },
  'Chest': { x: 120, y: 115, width: 100, height: 60, view: 'front' },
  'Abdomen': { x: 130, y: 175, width: 80, height: 60, view: 'front' },
  'Left Shoulder': { x: 90, y: 105, width: 35, height: 30, view: 'front' },
  'Right Shoulder': { x: 215, y: 105, width: 35, height: 30, view: 'front' },
  'Left Upper Arm': { x: 70, y: 135, width: 25, height: 50, view: 'front' },
  'Right Upper Arm': { x: 245, y: 135, width: 25, height: 50, view: 'front' },
  'Left Elbow': { x: 55, y: 185, width: 25, height: 25, view: 'front' },
  'Right Elbow': { x: 260, y: 185, width: 25, height: 25, view: 'front' },
  'Left Forearm': { x: 40, y: 210, width: 25, height: 50, view: 'front' },
  'Right Forearm': { x: 275, y: 210, width: 25, height: 50, view: 'front' },
  'Left Hand': { x: 25, y: 260, width: 30, height: 40, view: 'front' },
  'Right Hand': { x: 285, y: 260, width: 30, height: 40, view: 'front' },
  'Left Hip': { x: 115, y: 235, width: 35, height: 35, view: 'front' },
  'Right Hip': { x: 190, y: 235, width: 35, height: 35, view: 'front' },
  'Left Thigh': { x: 120, y: 270, width: 40, height: 70, view: 'front' },
  'Right Thigh': { x: 180, y: 270, width: 40, height: 70, view: 'front' },
  'Left Knee': { x: 125, y: 340, width: 30, height: 30, view: 'front' },
  'Right Knee': { x: 185, y: 340, width: 30, height: 30, view: 'front' },
  'Left Lower Leg': { x: 125, y: 370, width: 30, height: 70, view: 'front' },
  'Right Lower Leg': { x: 185, y: 370, width: 30, height: 70, view: 'front' },
  'Left Ankle': { x: 125, y: 440, width: 25, height: 20, view: 'front' },
  'Right Ankle': { x: 190, y: 440, width: 25, height: 20, view: 'front' },
  'Left Foot': { x: 115, y: 460, width: 35, height: 30, view: 'front' },
  'Right Foot': { x: 190, y: 460, width: 35, height: 30, view: 'front' },
  'Upper Back': { x: 130, y: 115, width: 80, height: 50, view: 'back' },
  'Lower Back': { x: 135, y: 165, width: 70, height: 50, view: 'back' },
  'Sacrum/Coccyx': { x: 150, y: 215, width: 40, height: 30, view: 'back' },
  'Buttocks': { x: 130, y: 245, width: 80, height: 40, view: 'back' },
};

const woundLocations = Object.keys(bodyMapLocations);

const woundTypes = [
  { value: 'surgical', label: 'Surgical Wound' },
  { value: 'pressure', label: 'Pressure Ulcer' },
  { value: 'trauma', label: 'Trauma' },
  { value: 'diabetic', label: 'Diabetic Ulcer' },
  { value: 'venous', label: 'Venous Ulcer' },
  { value: 'other', label: 'Other' },
];

const pressureUlcerStages = [
  { value: 'I', label: 'Stage I', description: 'Intact skin with non-blanchable redness' },
  { value: 'II', label: 'Stage II', description: 'Partial-thickness skin loss' },
  { value: 'III', label: 'Stage III', description: 'Full-thickness skin loss' },
  { value: 'IV', label: 'Stage IV', description: 'Full-thickness tissue loss' },
  { value: 'unstageable', label: 'Unstageable', description: 'Obscured by slough or eschar' },
  { value: 'dti', label: 'DTI', description: 'Deep Tissue Injury' },
];

const exudateAmounts = ['None', 'Scant', 'Moderate', 'Large'];
const exudateTypes = ['Serous', 'Sanguineous', 'Purulent', 'Serosanguineous'];
const periwoundConditions = ['Intact', 'Macerated', 'Erythema', 'Induration'];
const odorOptions = ['None', 'Mild', 'Moderate', 'Strong'];

const infectionSignsOptions = [
  'Increased pain',
  'Increased exudate',
  'Erythema spreading',
  'Warmth',
  'Fever',
  'Malodor',
  'Purulent drainage',
  'Delayed healing',
  'Friable granulation',
  'Wound breakdown',
];

const dressingTypes = [
  'Foam dressing',
  'Hydrocolloid',
  'Alginate',
  'Hydrogel',
  'Silver dressing',
  'Gauze',
  'Film dressing',
  'Collagen dressing',
  'Composite dressing',
  'Honey dressing',
];

const changeFrequencies = [
  'Daily',
  'Every 2 days',
  'Every 3 days',
  'Twice weekly',
  'Weekly',
  'As needed',
  'PRN',
];

const specialTreatmentOptions = [
  'Negative pressure wound therapy (NPWT)',
  'Debridement needed',
  'Sharp debridement',
  'Enzymatic debridement',
  'Autolytic debridement',
  'Compression therapy',
  'Offloading required',
  'Hyperbaric oxygen therapy',
];

const consultOptions = [
  'Wound care nurse',
  'Plastic surgery',
  'Vascular surgery',
  'Infectious disease',
  'Endocrinology',
  'Nutrition/Dietitian',
  'Physical therapy',
  'Podiatry',
];

const statusConfig = {
  healing: { label: 'Healing', color: 'bg-green-100 text-green-700 border-green-200', dotColor: 'bg-green-500' },
  stable: { label: 'Stable', color: 'bg-blue-100 text-blue-700 border-blue-200', dotColor: 'bg-blue-500' },
  worsening: { label: 'Worsening', color: 'bg-red-100 text-red-700 border-red-200', dotColor: 'bg-red-500' },
  healed: { label: 'Healed', color: 'bg-teal-100 text-teal-700 border-teal-200', dotColor: 'bg-teal-500' },
  new: { label: 'New', color: 'bg-purple-100 text-purple-700 border-purple-200', dotColor: 'bg-purple-500' },
};

// Mock existing wounds for demo
const mockWounds: Wound[] = [
  {
    id: 'w1',
    location: 'Sacrum/Coccyx',
    locationCoords: { x: 170, y: 230, view: 'back' },
    type: 'pressure',
    stage: 'II',
    startDate: '2025-01-10',
    status: 'healing',
    measurements: [
      { id: 'm1', date: '2025-01-10', length: 4.5, width: 3.2, depth: 0.3, area: 14.4, woundBed: { granulation: 20, slough: 60, eschar: 10, epithelial: 10 }, exudate: { amount: 'Moderate', type: 'Serous' }, periwound: ['Erythema'], painLevel: 5, odor: 'None', infectionSigns: [] },
      { id: 'm2', date: '2025-01-15', length: 4.0, width: 2.8, depth: 0.2, area: 11.2, woundBed: { granulation: 40, slough: 40, eschar: 5, epithelial: 15 }, exudate: { amount: 'Scant', type: 'Serous' }, periwound: ['Intact'], painLevel: 3, odor: 'None', infectionSigns: [] },
      { id: 'm3', date: '2025-01-20', length: 3.2, width: 2.2, depth: 0.1, area: 7.0, woundBed: { granulation: 60, slough: 15, eschar: 0, epithelial: 25 }, exudate: { amount: 'None', type: 'Serous' }, periwound: ['Intact'], painLevel: 2, odor: 'None', infectionSigns: [] },
    ],
    photos: [],
    treatmentPlan: { dressingType: 'Hydrocolloid', changeFrequency: 'Every 3 days', specialTreatments: ['Offloading required'], consults: ['Wound care nurse'], notes: 'Ensure pressure relief' },
  },
  {
    id: 'w2',
    location: 'Left Heel',
    locationCoords: { x: 125, y: 475, view: 'back' },
    type: 'diabetic',
    startDate: '2025-01-05',
    status: 'stable',
    measurements: [
      { id: 'm4', date: '2025-01-05', length: 2.0, width: 1.5, depth: 0.5, area: 3.0, woundBed: { granulation: 50, slough: 30, eschar: 10, epithelial: 10 }, exudate: { amount: 'Scant', type: 'Serous' }, periwound: ['Intact'], painLevel: 4, odor: 'Mild', infectionSigns: [] },
      { id: 'm5', date: '2025-01-15', length: 2.0, width: 1.5, depth: 0.4, area: 3.0, woundBed: { granulation: 55, slough: 25, eschar: 5, epithelial: 15 }, exudate: { amount: 'Scant', type: 'Serous' }, periwound: ['Intact'], painLevel: 3, odor: 'None', infectionSigns: [] },
    ],
    photos: [],
    treatmentPlan: { dressingType: 'Foam dressing', changeFrequency: 'Daily', specialTreatments: ['Offloading required'], consults: ['Endocrinology', 'Podiatry'], notes: 'Monitor blood glucose closely' },
  },
];

// Body Map Component
function BodyMap({ 
  view, 
  wounds, 
  selectedLocation, 
  onLocationClick,
  onViewChange 
}: { 
  view: 'front' | 'back';
  wounds: Wound[];
  selectedLocation?: string;
  onLocationClick: (location: string, coords: { x: number; y: number }) => void;
  onViewChange: (view: 'front' | 'back') => void;
}) {
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Find clicked location
    for (const [location, coords] of Object.entries(bodyMapLocations)) {
      if (coords.view === view &&
          x >= coords.x && x <= coords.x + coords.width &&
          y >= coords.y && y <= coords.y + coords.height) {
        onLocationClick(location, { x: coords.x + coords.width / 2, y: coords.y + coords.height / 2 });
        return;
      }
    }
  };

  const getWoundMarkerColor = (status: Wound['status']) => {
    switch (status) {
      case 'healing': return '#22c55e';
      case 'stable': return '#3b82f6';
      case 'worsening': return '#ef4444';
      case 'healed': return '#14b8a6';
      case 'new': return '#a855f7';
      default: return '#6b7280';
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => onViewChange('front')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            view === 'front' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Front
        </button>
        <button
          onClick={() => onViewChange('back')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            view === 'back' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Back
        </button>
      </div>
      <div className="relative bg-gray-50 rounded-lg p-2">
        <svg 
          width="340" 
          height="500" 
          viewBox="0 0 340 500" 
          onClick={handleClick}
          className="cursor-crosshair"
        >
          {/* Body outline */}
          <g fill="none" stroke="#d1d5db" strokeWidth="2">
            {/* Head */}
            <ellipse cx="170" cy="45" rx="35" ry="40" />
            {/* Neck */}
            <rect x="155" y="85" width="30" height="30" rx="5" />
            {/* Torso */}
            <path d="M105 115 Q95 140 95 180 L95 240 Q95 260 115 270 L115 285 L225 285 L225 270 Q245 260 245 240 L245 180 Q245 140 235 115 Z" />
            {/* Arms */}
            <path d="M95 120 Q70 130 55 180 L40 260 Q35 280 45 290 L55 285 Q65 275 70 260 L85 190 Q90 160 95 140" />
            <path d="M245 120 Q270 130 285 180 L300 260 Q305 280 295 290 L285 285 Q275 275 270 260 L255 190 Q250 160 245 140" />
            {/* Legs */}
            <path d="M115 285 L110 350 Q108 380 115 420 L120 470 Q122 485 135 490 L145 488 Q155 485 155 470 L155 420 Q160 350 160 320 L160 285" />
            <path d="M225 285 L230 350 Q232 380 225 420 L220 470 Q218 485 205 490 L195 488 Q185 485 185 470 L185 420 Q180 350 180 320 L180 285" />
          </g>
          
          {/* Highlight selected location */}
          {selectedLocation && bodyMapLocations[selectedLocation]?.view === view && (
            <rect
              x={bodyMapLocations[selectedLocation].x - 2}
              y={bodyMapLocations[selectedLocation].y - 2}
              width={bodyMapLocations[selectedLocation].width + 4}
              height={bodyMapLocations[selectedLocation].height + 4}
              fill="none"
              stroke="#14b8a6"
              strokeWidth="3"
              strokeDasharray="5,3"
              rx="4"
            />
          )}
          
          {/* Wound markers */}
          {wounds.filter(w => w.locationCoords?.view === view).map(wound => (
            <g key={wound.id}>
              <circle
                cx={wound.locationCoords!.x}
                cy={wound.locationCoords!.y}
                r="12"
                fill={getWoundMarkerColor(wound.status)}
                stroke="white"
                strokeWidth="2"
                className="cursor-pointer"
              />
              <text
                x={wound.locationCoords!.x}
                y={wound.locationCoords!.y + 4}
                textAnchor="middle"
                fontSize="10"
                fill="white"
                fontWeight="bold"
              >
                {wounds.indexOf(wound) + 1}
              </text>
            </g>
          ))}
          
          {/* Location labels on hover areas */}
          {Object.entries(bodyMapLocations)
            .filter(([, coords]) => coords.view === view)
            .map(([location, coords]) => (
              <rect
                key={location}
                x={coords.x}
                y={coords.y}
                width={coords.width}
                height={coords.height}
                fill="transparent"
                className="hover:fill-teal-100 hover:fill-opacity-50 cursor-pointer transition-colors"
              />
            ))}
        </svg>
        <p className="text-xs text-gray-500 text-center mt-2">Click on body to mark wound location</p>
      </div>
    </div>
  );
}

// Wound Card Component
function WoundCard({ wound, onClick, isSelected }: { wound: Wound; onClick: () => void; isSelected: boolean }) {
  const latestMeasurement = wound.measurements[wound.measurements.length - 1];
  const firstMeasurement = wound.measurements[0];
  const days = daysSince(wound.startDate);
  
  const healingPercent = firstMeasurement && latestMeasurement && firstMeasurement.area > 0
    ? Math.round(((firstMeasurement.area - latestMeasurement.area) / firstMeasurement.area) * 100)
    : 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        isSelected
          ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200'
          : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${statusConfig[wound.status].dotColor}`} />
          <span className="font-medium text-gray-900 text-sm">{wound.location}</span>
        </div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${statusConfig[wound.status].color}`}>
          {statusConfig[wound.status].label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div>
          <span className="text-gray-400">Type:</span>{' '}
          {woundTypes.find(t => t.value === wound.type)?.label || wound.type}
        </div>
        {wound.stage && (
          <div>
            <span className="text-gray-400">Stage:</span> {wound.stage}
          </div>
        )}
        <div>
          <span className="text-gray-400">Size:</span>{' '}
          {latestMeasurement ? `${latestMeasurement.length}x${latestMeasurement.width} cm` : 'N/A'}
        </div>
        <div>
          <span className="text-gray-400">Days:</span> {days}
        </div>
      </div>
      {wound.measurements.length > 1 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  healingPercent > 0 ? 'bg-green-500' : healingPercent < 0 ? 'bg-red-500' : 'bg-gray-400'
                }`}
                style={{ width: `${Math.min(Math.abs(healingPercent), 100)}%` }}
              />
            </div>
            <span className={`text-xs font-medium ${healingPercent > 0 ? 'text-green-600' : healingPercent < 0 ? 'text-red-600' : 'text-gray-500'}`}>
              {healingPercent > 0 ? '+' : ''}{healingPercent}%
            </span>
          </div>
        </div>
      )}
    </button>
  );
}

// Progress Chart Component
function ProgressChart({ measurements }: { measurements: WoundMeasurement[] }) {
  const chartData = measurements.map(m => ({
    date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    area: m.area,
    healingPercent: measurements[0].area > 0
      ? Math.round(((measurements[0].area - m.area) / measurements[0].area) * 100)
      : 0,
  }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value, name) => [
              name === 'area' ? `${value} cm²` : `${value}%`,
              name === 'area' ? 'Wound Area' : 'Healing %'
            ]}
          />
          <Area
            type="monotone"
            dataKey="area"
            stroke="#14b8a6"
            fill="#14b8a6"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function WoundAssessmentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Permission check
  const canCreate = hasPermission('nursing.create');
  const canUpdate = hasPermission('nursing.update');

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientWounds, setPatientWounds] = useState<Wound[]>([]);
  const [selectedWound, setSelectedWound] = useState<Wound | null>(null);
  const [bodyMapView, setBodyMapView] = useState<'front' | 'back'>('front');
  const [showNewForm, setShowNewForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'assessment' | 'photos' | 'treatment' | 'progress' | 'reports'>('assessment');
  const [uploadedPhotos, setUploadedPhotos] = useState<{ file: File; preview: string; hasRuler: boolean }[]>([]);
  const [showPhotoModal, setShowPhotoModal] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Assessment form state
  const [assessment, setAssessment] = useState<WoundAssessment>({
    woundLocation: '',
    locationCoords: undefined,
    woundType: '',
    stage: '',
    length: '',
    width: '',
    depth: '',
    woundBed: { granulation: '', slough: '', eschar: '', epithelial: '' },
    exudateAmount: '',
    exudateType: '',
    periwound: [],
    painLevel: '',
    odor: '',
    infectionSigns: [],
    dressingType: '',
    changeFrequency: '',
    specialTreatments: [],
    consults: [],
    notes: '',
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

  // Create nursing note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: CreateNursingNoteDto) => ipdService.nursingNotes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nursing-notes'] });
      toast.success('Wound assessment saved successfully');
      setSaved(true);
    },
    onError: () => {
      toast.error('Failed to save wound assessment');
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
    }));
  }, [apiPatients, searchTerm]);

  // Load mock wounds when patient is selected
  const handlePatientSelect = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setSearchTerm('');
    // Load mock wounds for demo
    setPatientWounds(mockWounds);
    setSelectedWound(null);
    setShowNewForm(false);
  }, []);

  const handleBodyMapClick = (location: string, coords: { x: number; y: number }) => {
    setAssessment(prev => ({
      ...prev,
      woundLocation: location,
      locationCoords: { ...coords, view: bodyMapView },
    }));
    if (!showNewForm) {
      setShowNewForm(true);
    }
  };

  const handleToggleArray = (field: 'periwound' | 'infectionSigns' | 'specialTreatments' | 'consults', value: string) => {
    setAssessment(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedPhotos(prev => [...prev, {
          file,
          preview: event.target?.result as string,
          hasRuler: false,
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSave = () => {
    if (!canCreate && !canUpdate) {
      toast.error('You do not have permission to save wound assessments');
      return;
    }

    const woundBedTotal = 
      (parseInt(assessment.woundBed.granulation) || 0) +
      (parseInt(assessment.woundBed.slough) || 0) +
      (parseInt(assessment.woundBed.eschar) || 0) +
      (parseInt(assessment.woundBed.epithelial) || 0);

    if (woundBedTotal > 0 && woundBedTotal !== 100) {
      toast.error('Wound bed percentages must total 100%');
      return;
    }

    const area = (parseFloat(assessment.length) || 0) * (parseFloat(assessment.width) || 0);

    const woundDetails = [
      `Location: ${assessment.woundLocation}`,
      `Type: ${woundTypes.find(t => t.value === assessment.woundType)?.label}`,
      assessment.stage && `Stage: ${assessment.stage}`,
      `Size: ${assessment.length}x${assessment.width}x${assessment.depth} cm (Area: ${area.toFixed(1)} cm²)`,
      `Wound Bed: Gran ${assessment.woundBed.granulation}%, Slough ${assessment.woundBed.slough}%, Eschar ${assessment.woundBed.eschar}%, Epithelial ${assessment.woundBed.epithelial}%`,
      `Exudate: ${assessment.exudateAmount} - ${assessment.exudateType}`,
      assessment.periwound.length > 0 && `Periwound: ${assessment.periwound.join(', ')}`,
      `Pain Level: ${assessment.painLevel}/10`,
      `Odor: ${assessment.odor}`,
      assessment.infectionSigns.length > 0 && `Infection Signs: ${assessment.infectionSigns.join(', ')}`,
      assessment.dressingType && `Dressing: ${assessment.dressingType}`,
      assessment.changeFrequency && `Change Frequency: ${assessment.changeFrequency}`,
      assessment.specialTreatments.length > 0 && `Special Treatments: ${assessment.specialTreatments.join(', ')}`,
      assessment.consults.length > 0 && `Consults: ${assessment.consults.join(', ')}`,
      assessment.notes && `Notes: ${assessment.notes}`,
    ].filter(Boolean).join('. ');

    if (admission?.id) {
      createNoteMutation.mutate({
        admissionId: admission.id,
        type: 'assessment',
        content: `Wound Assessment: ${woundDetails}`,
        vitals: {
          painLevel: assessment.painLevel ? parseInt(assessment.painLevel) : undefined,
        },
      });
    } else {
      // Demo mode
      toast.success('Wound assessment saved successfully');
      setSaved(true);
    }
  };

  const handleReset = () => {
    setSelectedPatient(null);
    setPatientWounds([]);
    setSelectedWound(null);
    setShowNewForm(false);
    setUploadedPhotos([]);
    setAssessment({
      woundLocation: '',
      locationCoords: undefined,
      woundType: '',
      stage: '',
      length: '',
      width: '',
      depth: '',
      woundBed: { granulation: '', slough: '', eschar: '', epithelial: '' },
      exudateAmount: '',
      exudateType: '',
      periwound: [],
      painLevel: '',
      odor: '',
      infectionSigns: [],
      dressingType: '',
      changeFrequency: '',
      specialTreatments: [],
      consults: [],
      notes: '',
    });
    setSaved(false);
  };

  const generateReport = (type: 'assessment' | 'instructions') => {
    const reportContent = type === 'assessment'
      ? `WOUND ASSESSMENT REPORT
Patient: ${selectedPatient?.name} (${selectedPatient?.mrn})
Date: ${new Date().toLocaleDateString()}

${selectedWound ? `
WOUND DETAILS
Location: ${selectedWound.location}
Type: ${woundTypes.find(t => t.value === selectedWound.type)?.label}
${selectedWound.stage ? `Stage: ${selectedWound.stage}` : ''}
Status: ${statusConfig[selectedWound.status].label}
Days Since Onset: ${daysSince(selectedWound.startDate)}

LATEST MEASUREMENTS
${selectedWound.measurements.length > 0 ? `
Length: ${selectedWound.measurements[selectedWound.measurements.length - 1].length} cm
Width: ${selectedWound.measurements[selectedWound.measurements.length - 1].width} cm
Depth: ${selectedWound.measurements[selectedWound.measurements.length - 1].depth} cm
Area: ${selectedWound.measurements[selectedWound.measurements.length - 1].area} cm²
Pain Level: ${selectedWound.measurements[selectedWound.measurements.length - 1].painLevel}/10
` : 'No measurements recorded'}

TREATMENT PLAN
${selectedWound.treatmentPlan ? `
Dressing: ${selectedWound.treatmentPlan.dressingType}
Change Frequency: ${selectedWound.treatmentPlan.changeFrequency}
Special Treatments: ${selectedWound.treatmentPlan.specialTreatments.join(', ') || 'None'}
Consults: ${selectedWound.treatmentPlan.consults.join(', ') || 'None'}
` : 'No treatment plan documented'}
` : 'No wound selected'}`
      : `WOUND CARE INSTRUCTIONS FOR PATIENT

Patient: ${selectedPatient?.name}
Date: ${new Date().toLocaleDateString()}

${selectedWound?.treatmentPlan ? `
YOUR WOUND CARE PLAN

Dressing Type: ${selectedWound.treatmentPlan.dressingType}
How Often to Change: ${selectedWound.treatmentPlan.changeFrequency}

INSTRUCTIONS:
1. Wash your hands thoroughly before and after dressing changes
2. Remove old dressing gently
3. Clean the wound as instructed by your nurse
4. Apply new dressing as shown
5. Dispose of old dressing properly

WATCH FOR THESE WARNING SIGNS:
- Increased redness or swelling
- Increased pain
- Fever
- Unusual discharge or odor
- Wound getting larger

If you notice any of these signs, contact your healthcare provider immediately.

FOLLOW-UP:
${selectedWound.treatmentPlan.consults.length > 0 ? `Scheduled consultations: ${selectedWound.treatmentPlan.consults.join(', ')}` : 'Follow up as directed by your nurse'}
` : 'No wound care plan available'}`;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wound_${type}_${selectedPatient?.mrn}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${type === 'assessment' ? 'Assessment report' : 'Care instructions'} downloaded`);
  };

  // Wound history summary
  const woundHistorySummary = useMemo(() => {
    const total = patientWounds.length;
    const healing = patientWounds.filter(w => w.status === 'healing').length;
    const stable = patientWounds.filter(w => w.status === 'stable').length;
    const worsening = patientWounds.filter(w => w.status === 'worsening').length;
    const healed = patientWounds.filter(w => w.status === 'healed').length;
    return { total, healing, stable, worsening, healed };
  }, [patientWounds]);

  const saving = createNoteMutation.isPending;

  if (saved) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Wound Assessment Saved</h2>
          <p className="text-gray-600 mb-6">
            Assessment for {selectedPatient?.name} has been recorded
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              New Assessment
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Wound Assessment</h1>
              <p className="text-sm text-gray-500">Comprehensive wound evaluation & tracking</p>
            </div>
          </div>
        </div>
        {(!canCreate && !canUpdate) && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
            <Shield className="w-4 h-4" />
            View only - No edit permission
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        {/* Left Panel: Patient Selection & Wound List */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          {/* Patient Selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Select Patient
            </h2>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            
            {searchTerm && searchTerm.length >= 2 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {searchLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                  </div>
                ) : filteredPatients.length > 0 ? (
                  filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => handlePatientSelect(patient)}
                      className="w-full text-left p-2 rounded-lg border border-gray-200 hover:border-teal-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <UserCircle className="w-6 h-6 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{patient.name}</p>
                          <p className="text-xs text-gray-500">{patient.mrn}</p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">No patients found</p>
                )}
              </div>
            ) : selectedPatient ? (
              <div className="p-3 rounded-lg border border-teal-500 bg-teal-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCircle className="w-8 h-8 text-teal-600" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{selectedPatient.name}</p>
                      <p className="text-xs text-gray-500">{selectedPatient.mrn} • {selectedPatient.age}y {selectedPatient.gender}</p>
                    </div>
                  </div>
                  <button onClick={handleReset} className="p-1 hover:bg-teal-100 rounded">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                {/* Wound History Summary */}
                {patientWounds.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-teal-200">
                    <p className="text-xs font-medium text-gray-700 mb-2">Wound History</p>
                    <div className="grid grid-cols-4 gap-1 text-center">
                      <div className="bg-white rounded p-1">
                        <p className="text-sm font-bold text-gray-900">{woundHistorySummary.total}</p>
                        <p className="text-xs text-gray-500">Total</p>
                      </div>
                      <div className="bg-green-50 rounded p-1">
                        <p className="text-sm font-bold text-green-600">{woundHistorySummary.healing}</p>
                        <p className="text-xs text-green-600">Healing</p>
                      </div>
                      <div className="bg-blue-50 rounded p-1">
                        <p className="text-sm font-bold text-blue-600">{woundHistorySummary.stable}</p>
                        <p className="text-xs text-blue-600">Stable</p>
                      </div>
                      <div className="bg-red-50 rounded p-1">
                        <p className="text-sm font-bold text-red-600">{woundHistorySummary.worsening}</p>
                        <p className="text-xs text-red-600">Worsening</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <UserCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">Search for a patient</p>
              </div>
            )}
          </div>

          {/* Wound List */}
          {selectedPatient && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Active Wounds
                </h2>
                {(canCreate || canUpdate) && (
                  <button
                    onClick={() => {
                      setSelectedWound(null);
                      setShowNewForm(true);
                      setActiveTab('assessment');
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-teal-600 text-white rounded-lg text-xs hover:bg-teal-700"
                  >
                    <Plus className="w-3 h-3" />
                    New
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {patientWounds.filter(w => w.status !== 'healed').map(wound => (
                  <WoundCard
                    key={wound.id}
                    wound={wound}
                    isSelected={selectedWound?.id === wound.id}
                    onClick={() => {
                      setSelectedWound(wound);
                      setShowNewForm(false);
                    }}
                  />
                ))}
                {patientWounds.filter(w => w.status !== 'healed').length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm">No active wounds</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Center Panel: Body Map */}
        {selectedPatient && (
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Body Map
            </h2>
            <div className="flex-1 overflow-y-auto flex items-center justify-center">
              <BodyMap
                view={bodyMapView}
                wounds={patientWounds.filter(w => w.status !== 'healed')}
                selectedLocation={showNewForm ? assessment.woundLocation : selectedWound?.location}
                onLocationClick={handleBodyMapClick}
                onViewChange={setBodyMapView}
              />
            </div>
            {/* Legend */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Legend</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(statusConfig).map(([status, config]) => (
                  <div key={status} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                    <span className="text-xs text-gray-600">{config.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Right Panel: Details/Form */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-gray-200 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              {/* Tabs */}
              <div className="flex border-b border-gray-200 px-4">
                {(['assessment', 'photos', 'treatment', 'progress', 'reports'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-teal-600 text-teal-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {/* Assessment Tab */}
                {activeTab === 'assessment' && (showNewForm || selectedWound) && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Location */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Wound Location *</label>
                        <select
                          value={showNewForm ? assessment.woundLocation : selectedWound?.location || ''}
                          onChange={(e) => setAssessment(prev => ({ ...prev, woundLocation: e.target.value }))}
                          disabled={!showNewForm && !canUpdate}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                        >
                          <option value="">Select or click on body map...</option>
                          {woundLocations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                      </div>

                      {/* Type */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Wound Type *</label>
                        <select
                          value={showNewForm ? assessment.woundType : selectedWound?.type || ''}
                          onChange={(e) => setAssessment(prev => ({ ...prev, woundType: e.target.value }))}
                          disabled={!showNewForm && !canUpdate}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                        >
                          <option value="">Select type...</option>
                          {woundTypes.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Stage (for pressure ulcers) */}
                      {(assessment.woundType === 'pressure' || selectedWound?.type === 'pressure') && (
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Pressure Ulcer Stage</label>
                          <div className="grid grid-cols-3 gap-2">
                            {pressureUlcerStages.map(stage => (
                              <button
                                key={stage.value}
                                type="button"
                                onClick={() => setAssessment(prev => ({ ...prev, stage: stage.value }))}
                                disabled={!showNewForm && !canUpdate}
                                className={`p-2 rounded-lg border text-left transition-colors ${
                                  (showNewForm ? assessment.stage : selectedWound?.stage) === stage.value
                                    ? 'border-teal-500 bg-teal-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                } disabled:opacity-50`}
                              >
                                <p className="font-medium text-sm">{stage.label}</p>
                                <p className="text-xs text-gray-500">{stage.description}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dimensions */}
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
                          <Ruler className="w-4 h-4" />
                          Dimensions (cm)
                        </label>
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Length</label>
                            <input
                              type="number"
                              step="0.1"
                              value={showNewForm ? assessment.length : ''}
                              onChange={(e) => setAssessment(prev => ({ ...prev, length: e.target.value }))}
                              disabled={!showNewForm && !canUpdate}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                              placeholder="0.0"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Width</label>
                            <input
                              type="number"
                              step="0.1"
                              value={showNewForm ? assessment.width : ''}
                              onChange={(e) => setAssessment(prev => ({ ...prev, width: e.target.value }))}
                              disabled={!showNewForm && !canUpdate}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                              placeholder="0.0"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Depth</label>
                            <input
                              type="number"
                              step="0.1"
                              value={showNewForm ? assessment.depth : ''}
                              onChange={(e) => setAssessment(prev => ({ ...prev, depth: e.target.value }))}
                              disabled={!showNewForm && !canUpdate}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                              placeholder="0.0"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Area (calc)</label>
                            <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700">
                              {((parseFloat(assessment.length) || 0) * (parseFloat(assessment.width) || 0)).toFixed(1)} cm²
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Wound Bed */}
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Wound Bed Composition (%)</label>
                        <div className="grid grid-cols-4 gap-3">
                          {[
                            { key: 'granulation', label: 'Granulation', color: 'bg-red-400' },
                            { key: 'slough', label: 'Slough', color: 'bg-yellow-400' },
                            { key: 'eschar', label: 'Eschar', color: 'bg-gray-800' },
                            { key: 'epithelial', label: 'Epithelial', color: 'bg-pink-300' },
                          ].map(item => (
                            <div key={item.key}>
                              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                <div className={`w-3 h-3 rounded ${item.color}`} />
                                {item.label}
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={assessment.woundBed[item.key as keyof typeof assessment.woundBed]}
                                onChange={(e) => setAssessment(prev => ({
                                  ...prev,
                                  woundBed: { ...prev.woundBed, [item.key]: e.target.value }
                                }))}
                                disabled={!showNewForm && !canUpdate}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Total: {
                            (parseInt(assessment.woundBed.granulation) || 0) +
                            (parseInt(assessment.woundBed.slough) || 0) +
                            (parseInt(assessment.woundBed.eschar) || 0) +
                            (parseInt(assessment.woundBed.epithelial) || 0)
                          }% (should equal 100%)
                        </p>
                      </div>

                      {/* Exudate */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-2">
                          <Droplets className="w-4 h-4" />
                          Exudate Amount
                        </label>
                        <select
                          value={showNewForm ? assessment.exudateAmount : ''}
                          onChange={(e) => setAssessment(prev => ({ ...prev, exudateAmount: e.target.value }))}
                          disabled={!showNewForm && !canUpdate}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                        >
                          <option value="">Select amount...</option>
                          {exudateAmounts.map(amt => (
                            <option key={amt} value={amt}>{amt}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Exudate Type</label>
                        <select
                          value={showNewForm ? assessment.exudateType : ''}
                          onChange={(e) => setAssessment(prev => ({ ...prev, exudateType: e.target.value }))}
                          disabled={!showNewForm && !canUpdate}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                        >
                          <option value="">Select type...</option>
                          {exudateTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>

                      {/* Periwound */}
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Periwound Condition</label>
                        <div className="flex flex-wrap gap-2">
                          {periwoundConditions.map(condition => (
                            <button
                              key={condition}
                              type="button"
                              onClick={() => handleToggleArray('periwound', condition)}
                              disabled={!showNewForm && !canUpdate}
                              className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                                assessment.periwound.includes(condition)
                                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                                  : 'border-gray-200 hover:border-gray-300'
                              } disabled:opacity-50`}
                            >
                              {condition}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Pain Level */}
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Pain Level (0-10)</label>
                        <div className="flex gap-1">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setAssessment(prev => ({ ...prev, painLevel: num.toString() }))}
                              disabled={!showNewForm && !canUpdate}
                              className={`flex-1 py-2 text-sm font-medium rounded transition-colors ${
                                assessment.painLevel === num.toString()
                                  ? num <= 3 ? 'bg-green-500 text-white'
                                    : num <= 6 ? 'bg-yellow-500 text-white'
                                    : 'bg-red-500 text-white'
                                  : 'bg-gray-100 hover:bg-gray-200'
                              } disabled:opacity-50`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Odor */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-2">
                          <ThermometerSun className="w-4 h-4" />
                          Odor
                        </label>
                        <select
                          value={showNewForm ? assessment.odor : ''}
                          onChange={(e) => setAssessment(prev => ({ ...prev, odor: e.target.value }))}
                          disabled={!showNewForm && !canUpdate}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                        >
                          <option value="">Select...</option>
                          {odorOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      {/* Infection Signs */}
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          Signs of Infection
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {infectionSignsOptions.map(sign => (
                            <button
                              key={sign}
                              type="button"
                              onClick={() => handleToggleArray('infectionSigns', sign)}
                              disabled={!showNewForm && !canUpdate}
                              className={`px-2 py-1 rounded-lg border text-xs transition-colors ${
                                assessment.infectionSigns.includes(sign)
                                  ? 'border-red-500 bg-red-50 text-red-700'
                                  : 'border-gray-200 hover:border-gray-300'
                              } disabled:opacity-50`}
                            >
                              {sign}
                            </button>
                          ))}
                        </div>
                        {assessment.infectionSigns.length > 0 && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                            <AlertTriangle className="w-4 h-4" />
                            {assessment.infectionSigns.length} infection sign(s) noted - consider intervention
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Additional Notes</label>
                        <textarea
                          rows={2}
                          value={showNewForm ? assessment.notes : ''}
                          onChange={(e) => setAssessment(prev => ({ ...prev, notes: e.target.value }))}
                          disabled={!showNewForm && !canUpdate}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none disabled:bg-gray-100"
                          placeholder="Any other observations..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Photos Tab */}
                {activeTab === 'photos' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">Photo Documentation</h3>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoUpload}
                        accept="image/*"
                        multiple
                        className="hidden"
                      />
                      {(canCreate || canUpdate) && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
                          >
                            <Upload className="w-4 h-4" />
                            Upload
                          </button>
                          <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                            <Camera className="w-4 h-4" />
                            Take Photo
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Uploaded Photos */}
                    {uploadedPhotos.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">New Photos</p>
                        <div className="grid grid-cols-4 gap-3">
                          {uploadedPhotos.map((photo, idx) => (
                            <div key={idx} className="relative group">
                              <img
                                src={photo.preview}
                                alt={`Wound photo ${idx + 1}`}
                                className="w-full h-24 object-cover rounded-lg cursor-pointer"
                                onClick={() => setShowPhotoModal(photo.preview)}
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                <button
                                  onClick={() => setShowPhotoModal(photo.preview)}
                                  className="p-1 bg-white rounded-full"
                                >
                                  <ZoomIn className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setUploadedPhotos(prev => prev.filter((_, i) => i !== idx))}
                                  className="p-1 bg-white rounded-full text-red-500"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <label className="absolute bottom-1 left-1 flex items-center gap-1 px-1.5 py-0.5 bg-white rounded text-xs">
                                <input
                                  type="checkbox"
                                  checked={photo.hasRuler}
                                  onChange={() => {
                                    const updated = [...uploadedPhotos];
                                    updated[idx].hasRuler = !updated[idx].hasRuler;
                                    setUploadedPhotos(updated);
                                  }}
                                  className="w-3 h-3"
                                />
                                Ruler
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Photo comparison */}
                    {selectedWound && selectedWound.photos.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Photo History</p>
                        <div className="grid grid-cols-4 gap-3">
                          {selectedWound.photos.map(photo => (
                            <div key={photo.id} className="relative group">
                              <img
                                src={photo.thumbnail}
                                alt={`Wound on ${photo.date}`}
                                className="w-full h-24 object-cover rounded-lg cursor-pointer"
                                onClick={() => setShowPhotoModal(photo.url)}
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-1 rounded-b-lg">
                                <p className="text-xs text-white">{photo.date}</p>
                              </div>
                              {photo.hasRuler && (
                                <div className="absolute top-1 right-1 px-1 py-0.5 bg-teal-500 text-white text-xs rounded">
                                  <Ruler className="w-3 h-3" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {uploadedPhotos.length === 0 && (!selectedWound || selectedWound.photos.length === 0) && (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <Image className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-600 mb-2">No photos yet</p>
                        <p className="text-sm text-gray-500">Upload or take photos to document wound appearance</p>
                        <div className="mt-4 text-xs text-gray-400">
                          Tip: Include a ruler in photos for accurate measurements
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Treatment Tab */}
                {activeTab === 'treatment' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Treatment Plan</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Dressing Type */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Current Dressing Type</label>
                        <select
                          value={showNewForm ? assessment.dressingType : selectedWound?.treatmentPlan?.dressingType || ''}
                          onChange={(e) => setAssessment(prev => ({ ...prev, dressingType: e.target.value }))}
                          disabled={!showNewForm && !canUpdate}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                        >
                          <option value="">Select dressing...</option>
                          {dressingTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>

                      {/* Change Frequency */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Dressing Change Frequency</label>
                        <select
                          value={showNewForm ? assessment.changeFrequency : selectedWound?.treatmentPlan?.changeFrequency || ''}
                          onChange={(e) => setAssessment(prev => ({ ...prev, changeFrequency: e.target.value }))}
                          disabled={!showNewForm && !canUpdate}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                        >
                          <option value="">Select frequency...</option>
                          {changeFrequencies.map(freq => (
                            <option key={freq} value={freq}>{freq}</option>
                          ))}
                        </select>
                      </div>

                      {/* Special Treatments */}
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Special Treatments</label>
                        <div className="flex flex-wrap gap-2">
                          {specialTreatmentOptions.map(treatment => (
                            <button
                              key={treatment}
                              type="button"
                              onClick={() => handleToggleArray('specialTreatments', treatment)}
                              disabled={!showNewForm && !canUpdate}
                              className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                                (showNewForm ? assessment.specialTreatments : selectedWound?.treatmentPlan?.specialTreatments || []).includes(treatment)
                                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                                  : 'border-gray-200 hover:border-gray-300'
                              } disabled:opacity-50`}
                            >
                              {treatment}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Consults */}
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Consults Ordered</label>
                        <div className="flex flex-wrap gap-2">
                          {consultOptions.map(consult => (
                            <button
                              key={consult}
                              type="button"
                              onClick={() => handleToggleArray('consults', consult)}
                              disabled={!showNewForm && !canUpdate}
                              className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                                (showNewForm ? assessment.consults : selectedWound?.treatmentPlan?.consults || []).includes(consult)
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 hover:border-gray-300'
                              } disabled:opacity-50`}
                            >
                              {consult}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Current Treatment Summary */}
                    {selectedWound?.treatmentPlan && !showNewForm && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">Current Treatment Summary</h4>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><span className="font-medium">Dressing:</span> {selectedWound.treatmentPlan.dressingType}</p>
                          <p><span className="font-medium">Change:</span> {selectedWound.treatmentPlan.changeFrequency}</p>
                          {selectedWound.treatmentPlan.specialTreatments.length > 0 && (
                            <p><span className="font-medium">Special:</span> {selectedWound.treatmentPlan.specialTreatments.join(', ')}</p>
                          )}
                          {selectedWound.treatmentPlan.consults.length > 0 && (
                            <p><span className="font-medium">Consults:</span> {selectedWound.treatmentPlan.consults.join(', ')}</p>
                          )}
                          {selectedWound.treatmentPlan.notes && (
                            <p><span className="font-medium">Notes:</span> {selectedWound.treatmentPlan.notes}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Progress Tab */}
                {activeTab === 'progress' && selectedWound && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Progress Tracking</h3>
                    
                    {/* Stats Cards */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Days Since Onset</p>
                        <p className="text-xl font-bold text-gray-900">{daysSince(selectedWound.startDate)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Measurements</p>
                        <p className="text-xl font-bold text-gray-900">{selectedWound.measurements.length}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Initial Size</p>
                        <p className="text-xl font-bold text-gray-900">
                          {selectedWound.measurements[0]?.area || 0} <span className="text-sm font-normal">cm²</span>
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Current Size</p>
                        <p className="text-xl font-bold text-gray-900">
                          {selectedWound.measurements[selectedWound.measurements.length - 1]?.area || 0} <span className="text-sm font-normal">cm²</span>
                        </p>
                      </div>
                    </div>

                    {/* Size Trend Chart */}
                    {selectedWound.measurements.length > 1 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" />
                          Size Trend
                        </h4>
                        <ProgressChart measurements={selectedWound.measurements} />
                      </div>
                    )}

                    {/* Healing Percentage */}
                    <div className="bg-gradient-to-r from-teal-50 to-green-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">Healing Progress</h4>
                        <span className="text-2xl font-bold text-teal-600">
                          {selectedWound.measurements.length > 1 && selectedWound.measurements[0].area > 0
                            ? Math.round(((selectedWound.measurements[0].area - selectedWound.measurements[selectedWound.measurements.length - 1].area) / selectedWound.measurements[0].area) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="h-3 rounded-full bg-gradient-to-r from-teal-500 to-green-500 transition-all"
                          style={{
                            width: `${Math.min(
                              selectedWound.measurements.length > 1 && selectedWound.measurements[0].area > 0
                                ? ((selectedWound.measurements[0].area - selectedWound.measurements[selectedWound.measurements.length - 1].area) / selectedWound.measurements[0].area) * 100
                                : 0,
                              100
                            )}%`
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Reduction from {selectedWound.measurements[0]?.area || 0} cm² to {selectedWound.measurements[selectedWound.measurements.length - 1]?.area || 0} cm²
                      </p>
                    </div>

                    {/* Measurement History */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Measurement History
                      </h4>
                      <div className="space-y-2">
                        {selectedWound.measurements.slice().reverse().map((m, idx) => (
                          <div key={m.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg text-sm">
                            <div className="flex items-center gap-2 text-gray-500 w-24">
                              <Calendar className="w-4 h-4" />
                              {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                            <div className="flex-1 grid grid-cols-4 gap-2">
                              <div><span className="text-gray-400">L:</span> {m.length}cm</div>
                              <div><span className="text-gray-400">W:</span> {m.width}cm</div>
                              <div><span className="text-gray-400">D:</span> {m.depth}cm</div>
                              <div><span className="text-gray-400">Area:</span> {m.area}cm²</div>
                            </div>
                            {idx === 0 && (
                              <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs font-medium">Latest</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Reports Tab */}
                {activeTab === 'reports' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Reports & Documentation</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Wound Assessment Report */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">Wound Assessment Report</h4>
                            <p className="text-sm text-gray-500 mt-1">Comprehensive documentation of wound status, measurements, and treatment plan</p>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => generateReport('assessment')}
                                disabled={!selectedWound}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                              >
                                <Download className="w-4 h-4" />
                                Download
                              </button>
                              <button
                                disabled={!selectedWound}
                                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                              >
                                <Printer className="w-4 h-4" />
                                Print
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Patient Care Instructions */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <ClipboardCheck className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">Patient Care Instructions</h4>
                            <p className="text-sm text-gray-500 mt-1">Simplified wound care instructions for patient education and home care</p>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => generateReport('instructions')}
                                disabled={!selectedWound}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                              >
                                <Download className="w-4 h-4" />
                                Download
                              </button>
                              <button
                                disabled={!selectedWound}
                                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                              >
                                <Printer className="w-4 h-4" />
                                Print
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {!selectedWound && (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p>Select a wound to generate reports</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state for right panel */}
                {!showNewForm && !selectedWound && (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Edit3 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>Select a wound or click "New" to add assessment</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button */}
              {(showNewForm || (selectedWound && canUpdate)) && (canCreate || canUpdate) && (
                <div className="p-4 border-t border-gray-200">
                  <div className="flex justify-end gap-3">
                    {showNewForm && (
                      <button
                        onClick={() => {
                          setShowNewForm(false);
                          setAssessment({
                            woundLocation: '',
                            locationCoords: undefined,
                            woundType: '',
                            stage: '',
                            length: '',
                            width: '',
                            depth: '',
                            woundBed: { granulation: '', slough: '', eschar: '', epithelial: '' },
                            exudateAmount: '',
                            exudateType: '',
                            periwound: [],
                            painLevel: '',
                            odor: '',
                            infectionSigns: [],
                            dressingType: '',
                            changeFrequency: '',
                            specialTreatments: [],
                            consults: [],
                            notes: '',
                          });
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={saving || (showNewForm && (!assessment.woundLocation || !assessment.woundType))}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Assessment
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Stethoscope className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to begin wound assessment</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Photo Modal */}
      {showPhotoModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setShowPhotoModal(null)}
        >
          <div className="max-w-4xl max-h-[90vh] p-4">
            <img
              src={showPhotoModal}
              alt="Wound photo"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
          <button
            onClick={() => setShowPhotoModal(null)}
            className="absolute top-4 right-4 p-2 bg-white rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
