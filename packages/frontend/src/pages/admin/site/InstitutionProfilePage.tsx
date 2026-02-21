import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facilitiesService } from '../../../services/facilities';
import type { Facility } from '../../../services/facilities';
import { useFacilityId } from '../../../lib/facility';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Award,
  FileText,
  Camera,
  Save,
  Edit2,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Loader2,
  Check,
  Plus,
  Trash2,
  X,
  Stethoscope,
  Users,
  Bed,
  Calendar,
  AlertCircle,
  ChevronDown,
  Building,
} from 'lucide-react';

interface OperatingHours {
  day: string;
  open: string;
  close: string;
  is24hr: boolean;
  closed: boolean;
}

interface Accreditation {
  id: string;
  name: string;
  issuedBy: string;
  validFrom: string;
  validTo: string;
  status: 'active' | 'expired' | 'pending';
}

interface ProfileData {
  name: string;
  logo: string;
  tagline: string;
  about: string;
  type: string;
  specialties: string[];
  registrationNumber: string;
  licenseNumber: string;
  taxId: string;
  address: {
    street: string;
    city: string;
    county: string;
    postalCode: string;
    country: string;
  };
  contact: {
    phone: string;
    emergency: string;
    fax: string;
    email: string;
  };
  website: string;
  social: {
    facebook: string;
    twitter: string;
    linkedin: string;
    instagram: string;
  };
  founded: string;
  bedCapacity: number;
  employeeCount: number;
}

const DEFAULT_OPERATING_HOURS: OperatingHours[] = [
  { day: 'Monday',    open: '08:00', close: '18:00', is24hr: false, closed: false },
  { day: 'Tuesday',   open: '08:00', close: '18:00', is24hr: false, closed: false },
  { day: 'Wednesday', open: '08:00', close: '18:00', is24hr: false, closed: false },
  { day: 'Thursday',  open: '08:00', close: '18:00', is24hr: false, closed: false },
  { day: 'Friday',    open: '08:00', close: '18:00', is24hr: false, closed: false },
  { day: 'Saturday',  open: '09:00', close: '14:00', is24hr: false, closed: false },
  { day: 'Sunday',    open: '00:00', close: '00:00', is24hr: false, closed: true  },
];

/** Map a Facility API response into the local ProfileData shape. */
function facilityToProfile(f: Facility): ProfileData {
  const s = (f.settings || {}) as Record<string, any>;
  return {
    name: f.name || '',
    logo: s.logo || '',
    tagline: s.tagline || '',
    about: s.about || '',
    type: f.type || 'hospital',
    specialties: s.specialties || [],
    registrationNumber: s.registrationNumber || '',
    licenseNumber: s.licenseNumber || '',
    taxId: s.taxId || '',
    address: {
      street: s.address?.street || '',
      city: s.address?.city || f.location || '',
      county: s.address?.county || '',
      postalCode: s.address?.postalCode || '',
      country: s.address?.country || 'Uganda',
    },
    contact: {
      phone: f.contact?.phone || '',
      emergency: s.emergency || '',
      fax: s.fax || '',
      email: f.contact?.email || '',
    },
    website: s.website || '',
    social: {
      facebook: s.social?.facebook || '',
      twitter: s.social?.twitter || '',
      linkedin: s.social?.linkedin || '',
      instagram: s.social?.instagram || '',
    },
    founded: s.founded || '',
    bedCapacity: s.bedCapacity || 0,
    employeeCount: s.employeeCount || 0,
  };
}

/** Build the PATCH payload from local ProfileData + extra lists. */
function profileToPayload(
  p: ProfileData,
  operatingHours: OperatingHours[],
  accreditations: Accreditation[],
): Partial<Facility> {
  return {
    name: p.name,
    type: p.type as Facility['type'],
    location: [p.address.city, p.address.country].filter(Boolean).join(', '),
    contact: { phone: p.contact.phone, email: p.contact.email },
    settings: {
      logo: p.logo,
      tagline: p.tagline,
      about: p.about,
      specialties: p.specialties,
      registrationNumber: p.registrationNumber,
      licenseNumber: p.licenseNumber,
      taxId: p.taxId,
      address: p.address,
      emergency: p.contact.emergency,
      fax: p.contact.fax,
      website: p.website,
      social: p.social,
      founded: p.founded,
      bedCapacity: p.bedCapacity,
      employeeCount: p.employeeCount,
      operatingHours,
      accreditations,
    },
  };
}

const FACILITY_TYPES = [
  'Hospital', 'Clinic', 'Health Center', 'Pharmacy', 'Laboratory',
  'Specialist Clinic', 'Dental Clinic', 'Eye Clinic', 'Maternity Home',
];

// ── small helpers ─────────────────────────────────────────────────────────────

function Field({
  label, value, editing, onChange, type = 'text', placeholder = '', hint,
}: {
  label: string; value: string | number; editing: boolean;
  onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {editing ? (
        <input
          type={type}
          value={value as string}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || label}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      ) : (
        <p className={`text-sm ${value ? 'text-gray-900' : 'text-gray-400 italic'}`}>
          {value || `No ${label.toLowerCase()} set`}
        </p>
      )}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-5">
        <span className="text-blue-500">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── completion score ──────────────────────────────────────────────────────────

function profileScore(p: ProfileData): number {
  const fields = [
    p.name, p.tagline, p.about, p.registrationNumber, p.licenseNumber, p.taxId,
    p.address.street, p.address.city, p.contact.phone, p.contact.email,
    p.website, p.founded, p.bedCapacity, p.employeeCount,
  ];
  const filled = fields.filter(f => f !== '' && f !== 0 && f != null).length;
  return Math.round((filled / fields.length) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function InstitutionProfilePage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'hours' | 'accreditations'>('general');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newAccreditation, setNewAccreditation] = useState<Partial<Accreditation> | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [operatingHours, setOperatingHours] = useState<OperatingHours[]>(DEFAULT_OPERATING_HOURS);
  const [accreditations, setAccreditations] = useState<Accreditation[]>([]);

  // Fetch facility from API
  const { data: facility, isLoading: isFetching } = useQuery({
    queryKey: ['facility', facilityId],
    queryFn: () => facilitiesService.getById(facilityId),
    enabled: !!facilityId,
  });

  // Populate local state when facility data arrives
  const lastFacilityRef = useRef<string | null>(null);
  if (facility && lastFacilityRef.current !== facility.id) {
    lastFacilityRef.current = facility.id;
    const s = (facility.settings || {}) as Record<string, any>;
    setProfile(facilityToProfile(facility));
    setOperatingHours(s.operatingHours || DEFAULT_OPERATING_HOURS);
    setAccreditations(s.accreditations || []);
  }

  // Save mutation
  const updateMutation = useMutation({
    mutationFn: (payload: Partial<Facility>) =>
      facilitiesService.update(facilityId, payload as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility', facilityId] });
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const isSaving = updateMutation.isPending;

  const handleSave = () => {
    if (!profile) return;
    updateMutation.mutate(profileToPayload(profile, operatingHours, accreditations));
  };

  const handleCancel = () => {
    if (facility) {
      const s = (facility.settings || {}) as Record<string, any>;
      setProfile(facilityToProfile(facility));
      setOperatingHours(s.operatingHours || DEFAULT_OPERATING_HOURS);
      setAccreditations(s.accreditations || []);
    }
    setIsEditing(false);
  };

  const set = (field: keyof ProfileData, value: any) =>
    setProfile(p => p ? { ...p, [field]: value } : p);
  const setAddr = (field: string, value: string) =>
    setProfile(p => p ? { ...p, address: { ...p.address, [field]: value } } : p);
  const setContact = (field: string, value: string) =>
    setProfile(p => p ? { ...p, contact: { ...p.contact, [field]: value } } : p);
  const setSocial = (field: string, value: string) =>
    setProfile(p => p ? { ...p, social: { ...p.social, [field]: value } } : p);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set('logo', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const addSpecialty = () => {
    if (!newSpecialty.trim() || !profile) return;
    set('specialties', [...(profile.specialties || []), newSpecialty.trim()]);
    setNewSpecialty('');
  };

  const removeSpecialty = (i: number) => {
    if (!profile) return;
    set('specialties', profile.specialties.filter((_, idx) => idx !== i));
  };

  const updateHours = (i: number, field: keyof OperatingHours, value: any) =>
    setOperatingHours(prev => prev.map((h, idx) => idx === i ? { ...h, [field]: value } : h));

  const addAccreditation = () => {
    if (!newAccreditation?.name?.trim()) return;
    const acc: Accreditation = {
      id: Date.now().toString(),
      name: newAccreditation.name || '',
      issuedBy: newAccreditation.issuedBy || '',
      validFrom: newAccreditation.validFrom || '',
      validTo: newAccreditation.validTo || '',
      status: newAccreditation.status || 'active',
    };
    setAccreditations(prev => [...prev, acc]);
    setNewAccreditation(null);
  };

  const getStatusColor = (status: string) => ({
    active:  'bg-green-100 text-green-800',
    expired: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
  }[status] || 'bg-gray-100 text-gray-800');

  const daysToExpiry = (validTo: string) => {
    const diff = new Date(validTo).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (!profile || isFetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const score = profileScore(profile);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Institution Profile</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your facility's information, credentials and operating details</p>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <Check className="w-4 h-4" /> Saved
            </span>
          )}
          {isEditing ? (
            <>
              <button onClick={handleCancel} disabled={isSaving}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <Edit2 className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex-shrink-0 border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {[
            { id: 'general',        label: 'General Information' },
            { id: 'hours',          label: 'Operating Hours'     },
            { id: 'accreditations', label: 'Accreditations & Licenses' },
          ].map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto space-y-6">

        {/* ════════════════ GENERAL ════════════════ */}
        {activeTab === 'general' && (
          <>
            {/* Profile completion banner */}
            {score < 80 && (
              <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">Profile {score}% complete</p>
                  <div className="mt-1 h-1.5 bg-amber-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${score}%` }} />
                  </div>
                </div>
                {!isEditing && (
                  <button onClick={() => setIsEditing(true)}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap">
                    Complete now →
                  </button>
                )}
              </div>
            )}

            {/* Hero card */}
            <div className="relative bg-gradient-to-r from-blue-700 to-indigo-700 rounded-xl p-6 text-white overflow-hidden">
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <div className="relative flex items-center gap-6">
                {/* Logo */}
                <div className="relative flex-shrink-0">
                  <div className="w-24 h-24 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center overflow-hidden border-2 border-white/30">
                    {profile.logo
                      ? <img src={profile.logo} alt="logo" className="w-full h-full object-cover" />
                      : <Building2 className="w-12 h-12 text-white/80" />
                    }
                  </div>
                  {isEditing && (
                    <>
                      <button onClick={() => logoInputRef.current?.click()}
                        className="absolute -bottom-2 -right-2 w-8 h-8 bg-white text-blue-700 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-50">
                        <Camera className="w-4 h-4" />
                      </button>
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </>
                  )}
                </div>

                {/* Name & stats */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input value={profile.name} onChange={e => set('name', e.target.value)}
                        placeholder="Institution name"
                        className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/60 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-white/50" />
                      <input value={profile.tagline} onChange={e => set('tagline', e.target.value)}
                        placeholder="Tagline / motto"
                        className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-1.5 text-sm text-white/90 placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50" />
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold truncate">{profile.name || 'Your Institution Name'}</h2>
                      <p className="text-white/80 text-sm mt-0.5">{profile.tagline}</p>
                    </>
                  )}

                  <div className="mt-3 flex flex-wrap gap-3">
                    {/* Stat: Beds */}
                    <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
                      <Bed className="w-4 h-4" />
                      {isEditing
                        ? <input type="number" min={0} value={profile.bedCapacity}
                            onChange={e => set('bedCapacity', parseInt(e.target.value) || 0)}
                            className="w-16 bg-transparent text-sm font-semibold text-white focus:outline-none" />
                        : <span className="text-sm font-semibold">{profile.bedCapacity} Beds</span>}
                    </div>
                    {/* Stat: Staff */}
                    <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
                      <Users className="w-4 h-4" />
                      {isEditing
                        ? <input type="number" min={0} value={profile.employeeCount}
                            onChange={e => set('employeeCount', parseInt(e.target.value) || 0)}
                            className="w-16 bg-transparent text-sm font-semibold text-white focus:outline-none" />
                        : <span className="text-sm font-semibold">{profile.employeeCount} Staff</span>}
                    </div>
                    {/* Stat: Founded */}
                    <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
                      <Calendar className="w-4 h-4" />
                      {isEditing
                        ? <input type="text" value={profile.founded}
                            onChange={e => set('founded', e.target.value)}
                            placeholder="Year"
                            className="w-16 bg-transparent text-sm font-semibold text-white focus:outline-none" />
                        : <span className="text-sm font-semibold">Est. {profile.founded}</span>}
                    </div>
                    {/* Type badge */}
                    <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
                      <Building className="w-4 h-4" />
                      {isEditing
                        ? <select value={profile.type} onChange={e => set('type', e.target.value)}
                            className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer">
                            {FACILITY_TYPES.map(t => <option key={t} value={t} className="text-gray-900">{t}</option>)}
                          </select>
                        : <span className="text-sm font-semibold">{profile.type}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* About */}
              <Section title="About" icon={<FileText className="w-5 h-5" />}>
                {isEditing ? (
                  <textarea value={profile.about}
                    onChange={e => set('about', e.target.value)}
                    rows={4}
                    placeholder="Describe your institution — its mission, vision, and what makes it unique…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                ) : (
                  <p className={`text-sm leading-relaxed ${profile.about ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                    {profile.about || 'No description added yet. Click Edit Profile to add one.'}
                  </p>
                )}

                <div className="mt-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Specialties & Services</p>
                  <div className="flex flex-wrap gap-2">
                    {(profile.specialties || []).map((s, i) => (
                      <span key={i} className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-800 text-xs rounded-full font-medium">
                        <Stethoscope className="w-3 h-3" /> {s}
                        {isEditing && (
                          <button onClick={() => removeSpecialty(i)} className="ml-1 hover:text-red-600">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                    {isEditing && (
                      <div className="flex items-center gap-1">
                        <input value={newSpecialty} onChange={e => setNewSpecialty(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addSpecialty()}
                          placeholder="Add specialty…"
                          className="px-2 py-1 border border-dashed border-gray-300 rounded-full text-xs focus:outline-none focus:border-blue-400 w-28" />
                        <button onClick={addSpecialty}
                          className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              {/* Contact Information */}
              <Section title="Contact Information" icon={<Phone className="w-5 h-5" />}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Main Phone" value={profile.contact.phone} editing={isEditing}
                      onChange={v => setContact('phone', v)} placeholder="+256 700 000 000" type="tel" />
                    <Field label="Emergency Line" value={profile.contact.emergency} editing={isEditing}
                      onChange={v => setContact('emergency', v)} placeholder="+256 800 000 000" type="tel" />
                  </div>
                  <Field label="Email Address" value={profile.contact.email} editing={isEditing}
                    onChange={v => setContact('email', v)} placeholder="info@hospital.ug" type="email" />
                  <Field label="Fax" value={profile.contact.fax} editing={isEditing}
                    onChange={v => setContact('fax', v)} placeholder="Fax number" type="tel" />
                  <Field label="Website" value={profile.website} editing={isEditing}
                    onChange={v => set('website', v)} placeholder="https://www.yourhospital.ug" />
                </div>
              </Section>

              {/* Address */}
              <Section title="Physical Address" icon={<MapPin className="w-5 h-5" />}>
                <div className="space-y-4">
                  <Field label="Street / Plot" value={profile.address.street} editing={isEditing}
                    onChange={v => setAddr('street', v)} placeholder="Plot 123, Hospital Road" />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="City / Town" value={profile.address.city} editing={isEditing}
                      onChange={v => setAddr('city', v)} placeholder="Kampala" />
                    <Field label="County / District" value={profile.address.county} editing={isEditing}
                      onChange={v => setAddr('county', v)} placeholder="Nakawa" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Postal Code" value={profile.address.postalCode} editing={isEditing}
                      onChange={v => setAddr('postalCode', v)} placeholder="00000" />
                    <Field label="Country" value={profile.address.country} editing={isEditing}
                      onChange={v => setAddr('country', v)} placeholder="Uganda" />
                  </div>
                </div>
              </Section>

              {/* Registration & Social */}
              <div className="space-y-6">
                <Section title="Registration Details" icon={<Award className="w-5 h-5" />}>
                  <div className="space-y-4">
                    <Field label="Registration Number" value={profile.registrationNumber} editing={isEditing}
                      onChange={v => set('registrationNumber', v)} placeholder="REG-2023-XXXX" />
                    <Field label="License Number" value={profile.licenseNumber} editing={isEditing}
                      onChange={v => set('licenseNumber', v)} placeholder="MOH/LIC/XXXX" />
                    <Field label="Tax ID / TIN" value={profile.taxId} editing={isEditing}
                      onChange={v => set('taxId', v)} placeholder="1000XXXXXX" />
                  </div>
                </Section>

                <Section title="Social Media" icon={<Globe className="w-5 h-5" />}>
                  <div className="space-y-3">
                    {[
                      { key: 'facebook',  Icon: Facebook,  color: 'text-blue-600',  label: 'Facebook'  },
                      { key: 'twitter',   Icon: Twitter,   color: 'text-sky-500',   label: 'Twitter/X' },
                      { key: 'linkedin',  Icon: Linkedin,  color: 'text-blue-700',  label: 'LinkedIn'  },
                      { key: 'instagram', Icon: Instagram, color: 'text-pink-600',  label: 'Instagram' },
                    ].map(({ key, Icon, color, label }) => (
                      <div key={key} className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />
                        {isEditing ? (
                          <input
                            type="url"
                            value={(profile.social as any)[key]}
                            onChange={e => setSocial(key, e.target.value)}
                            placeholder={`https://${key}.com/yourpage`}
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (profile.social as any)[key] ? (
                          <a href={(profile.social as any)[key]} target="_blank" rel="noreferrer"
                            className="text-sm text-blue-600 hover:underline truncate">
                            {(profile.social as any)[key]}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Not set</span>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              </div>

            </div>
          </>
        )}

        {/* ════════════════ OPERATING HOURS ════════════════ */}
        {activeTab === 'hours' && (
          <Section title="Operating Hours" icon={<Clock className="w-5 h-5" />}>
            <div className="space-y-1">
              <div className="grid grid-cols-[120px_1fr_1fr_100px_80px] gap-4 px-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <span>Day</span>
                <span>Opens</span>
                <span>Closes</span>
                <span>24 Hours</span>
                <span>Closed</span>
              </div>
              {operatingHours.map((h, i) => (
                <div key={h.day} className={`grid grid-cols-[120px_1fr_1fr_100px_80px] gap-4 items-center px-3 py-3 rounded-lg ${h.closed ? 'bg-red-50' : h.is24hr ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                  <span className="font-medium text-gray-800 text-sm">{h.day}</span>

                  {/* Open time */}
                  {isEditing && !h.closed && !h.is24hr ? (
                    <input type="time" value={h.open} onChange={e => updateHours(i, 'open', e.target.value)}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  ) : (
                    <span className={`text-sm ${h.closed || h.is24hr ? 'text-gray-400' : 'text-gray-700'}`}>{h.is24hr ? '—' : h.closed ? '—' : h.open}</span>
                  )}

                  {/* Close time */}
                  {isEditing && !h.closed && !h.is24hr ? (
                    <input type="time" value={h.close} onChange={e => updateHours(i, 'close', e.target.value)}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  ) : (
                    <span className={`text-sm ${h.closed || h.is24hr ? 'text-gray-400' : 'text-gray-700'}`}>{h.is24hr ? '—' : h.closed ? '—' : h.close}</span>
                  )}

                  {/* 24hr toggle */}
                  <div className="flex justify-center">
                    <button disabled={!isEditing || h.closed}
                      onClick={() => updateHours(i, 'is24hr', !h.is24hr)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${!isEditing || h.closed ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${h.is24hr ? 'bg-green-500' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${h.is24hr ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {/* Closed toggle */}
                  <div className="flex justify-center">
                    <button disabled={!isEditing}
                      onClick={() => updateHours(i, 'closed', !h.closed)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${!isEditing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${h.closed ? 'bg-red-500' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${h.closed ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <p className="text-sm text-blue-800"><strong>Emergency / Casualty:</strong> Available 24 hours, 7 days a week regardless of operating hours.</p>
            </div>
          </Section>
        )}

        {/* ════════════════ ACCREDITATIONS ════════════════ */}
        {activeTab === 'accreditations' && (
          <div className="space-y-4">
            {isEditing && (
              <div className="bg-white rounded-xl border border-dashed border-blue-300 p-5">
                <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" /> Add Accreditation / License
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Name *</label>
                    <input value={newAccreditation?.name || ''}
                      onChange={e => setNewAccreditation(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., UMDPC Certification"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Issued By</label>
                    <input value={newAccreditation?.issuedBy || ''}
                      onChange={e => setNewAccreditation(p => ({ ...p, issuedBy: e.target.value }))}
                      placeholder="Issuing body"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Valid From</label>
                    <input type="date" value={newAccreditation?.validFrom || ''}
                      onChange={e => setNewAccreditation(p => ({ ...p, validFrom: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Valid To</label>
                    <input type="date" value={newAccreditation?.validTo || ''}
                      onChange={e => setNewAccreditation(p => ({ ...p, validTo: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
                    <select value={newAccreditation?.status || 'active'}
                      onChange={e => setNewAccreditation(p => ({ ...p, status: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button onClick={addAccreditation}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {accreditations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Award className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">No accreditations added yet</p>
                  {!isEditing && <button onClick={() => setIsEditing(true)} className="mt-2 text-blue-600 text-sm hover:underline">Add one</button>}
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Accreditation / License', 'Issued By', 'Valid Period', 'Status', ''].map(h => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {accreditations.map(acc => {
                      const days = daysToExpiry(acc.validTo);
                      const expiringSoon = days > 0 && days <= 60;
                      return (
                        <tr key={acc.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                acc.status === 'active' ? 'bg-green-100' : acc.status === 'expired' ? 'bg-red-100' : 'bg-yellow-100'}`}>
                                <Award className={`w-4 h-4 ${acc.status === 'active' ? 'text-green-600' : acc.status === 'expired' ? 'text-red-600' : 'text-yellow-600'}`} />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{acc.name}</p>
                                {expiringSoon && <p className="text-xs text-amber-600 font-medium">⚠ Expires in {days} days</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{acc.issuedBy}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <p>{acc.validFrom}</p>
                            <p className="text-xs text-gray-400">to {acc.validTo}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 text-xs rounded-full font-medium capitalize ${getStatusColor(acc.status)}`}>
                              {acc.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {isEditing && (
                              <button onClick={() => setAccreditations(p => p.filter(a => a.id !== acc.id))}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
