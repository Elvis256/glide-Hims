import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';
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
} from 'lucide-react';

interface OperatingHours {
  day: string;
  open: string;
  close: string;
  is24hr: boolean;
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

const defaultOperatingHours: OperatingHours[] = [
  { day: 'Monday', open: '08:00', close: '18:00', is24hr: false },
  { day: 'Tuesday', open: '08:00', close: '18:00', is24hr: false },
  { day: 'Wednesday', open: '08:00', close: '18:00', is24hr: false },
  { day: 'Thursday', open: '08:00', close: '18:00', is24hr: false },
  { day: 'Friday', open: '08:00', close: '18:00', is24hr: false },
  { day: 'Saturday', open: '09:00', close: '14:00', is24hr: false },
  { day: 'Sunday', open: '00:00', close: '00:00', is24hr: false },
];

const defaultAccreditations: Accreditation[] = [
  {
    id: '1',
    name: 'UMDPC Certification',
    issuedBy: 'Uganda Medical and Dental Practitioners Council',
    validFrom: '2023-01-15',
    validTo: '2026-01-14',
    status: 'active',
  },
  {
    id: '2',
    name: 'ISO 9001:2015',
    issuedBy: 'Bureau Veritas',
    validFrom: '2022-06-01',
    validTo: '2025-05-31',
    status: 'active',
  },
];

const STORAGE_KEYS = {
  PROFILE: 'institution_profile',
  OPERATING_HOURS: 'institution_operating_hours',
  ACCREDITATIONS: 'institution_accreditations',
};

export default function InstitutionProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'hours' | 'accreditations'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [operatingHours, setOperatingHours] = useState<OperatingHours[]>(defaultOperatingHours);
  const [accreditations, setAccreditations] = useState<Accreditation[]>(defaultAccreditations);

  // Fetch organization data
  const { data: orgData } = useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const response = await api.get('/setup/status');
      return response.data;
    },
  });

  // Fetch facility data
  const { data: facilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      const response = await api.get('/facilities');
      return response.data;
    },
  });

  // Load/build profile from API data and localStorage
  useEffect(() => {
    const savedProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
    const savedHours = localStorage.getItem(STORAGE_KEYS.OPERATING_HOURS);
    const savedAccreditations = localStorage.getItem(STORAGE_KEYS.ACCREDITATIONS);

    // Get the main facility (first one or parent)
    const mainFacility = facilities?.find((f: any) => !f.parentFacilityId) || facilities?.[0];

    // Build profile from API data, falling back to localStorage/defaults
    const baseProfile: ProfileData = savedProfile ? JSON.parse(savedProfile) : {
      name: '',
      logo: '/logo.png',
      tagline: 'Excellence in Healthcare',
      registrationNumber: '',
      licenseNumber: '',
      taxId: '',
      address: {
        street: '',
        city: '',
        county: '',
        postalCode: '',
        country: 'Uganda',
      },
      contact: {
        phone: '',
        emergency: '',
        fax: '',
        email: '',
      },
      website: '',
      social: {
        facebook: '',
        twitter: '',
        linkedin: '',
        instagram: '',
      },
      founded: new Date().getFullYear().toString(),
      bedCapacity: 0,
      employeeCount: 0,
    };

    // Override with real data from API if available
    if (orgData?.organizationName || mainFacility) {
      baseProfile.name = orgData?.organizationName || mainFacility?.name || baseProfile.name;
    }
    if (mainFacility) {
      baseProfile.address.city = mainFacility.location || baseProfile.address.city;
      baseProfile.contact.phone = mainFacility.phone || baseProfile.contact.phone;
      baseProfile.contact.email = mainFacility.email || baseProfile.contact.email;
    }

    setProfile(baseProfile);
    if (savedHours) setOperatingHours(JSON.parse(savedHours));
    if (savedAccreditations) setAccreditations(JSON.parse(savedAccreditations));
  }, [orgData, facilities]);

  const handleSave = async () => {
    if (!profile) return;
    
    setIsSaving(true);
    setSaveSuccess(false);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    localStorage.setItem(STORAGE_KEYS.OPERATING_HOURS, JSON.stringify(operatingHours));
    localStorage.setItem(STORAGE_KEYS.ACCREDITATIONS, JSON.stringify(accreditations));

    // Also save to hospital settings for header display
    const hospitalSettings = {
      name: profile.name,
      tagline: profile.tagline,
      registrationNumber: profile.registrationNumber,
      licenseNumber: profile.licenseNumber,
      taxId: profile.taxId,
      address: profile.address,
      contact: {
        phone: profile.contact.phone,
        emergency: profile.contact.emergency,
        email: profile.contact.email,
        website: profile.website,
      },
    };
    localStorage.setItem('glide_hospital_settings', JSON.stringify(hospitalSettings));
    window.dispatchEvent(new CustomEvent('hospital-settings-changed', { detail: hospitalSettings }));

    setIsSaving(false);
    setSaveSuccess(true);
    setIsEditing(false);

    // Clear success message after 3 seconds
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleCancel = () => {
    // Reload from localStorage to discard changes
    const savedProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
    const savedHours = localStorage.getItem(STORAGE_KEYS.OPERATING_HOURS);
    const savedAccreditations = localStorage.getItem(STORAGE_KEYS.ACCREDITATIONS);

    if (savedProfile) setProfile(JSON.parse(savedProfile));
    if (savedHours) setOperatingHours(JSON.parse(savedHours));
    if (savedAccreditations) setAccreditations(JSON.parse(savedAccreditations));
    setIsEditing(false);
  };

  const updateProfile = (field: string, value: string | number) => {
    if (!profile) return;
    setProfile((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const updateProfileAddress = (field: string, value: string) => {
    if (!profile) return;
    setProfile((prev) => prev ? { ...prev, address: { ...prev.address, [field]: value } } : prev);
  };

  const updateProfileContact = (field: string, value: string) => {
    if (!profile) return;
    setProfile((prev) => prev ? { ...prev, contact: { ...prev.contact, [field]: value } } : prev);
  };

  const updateProfileSocial = (field: string, value: string) => {
    if (!profile) return;
    setProfile((prev) => prev ? { ...prev, social: { ...prev.social, [field]: value } } : prev);
  };

  const updateOperatingHours = (index: number, field: keyof OperatingHours, value: string | boolean) => {
    setOperatingHours((prev) =>
      prev.map((hours, i) => (i === index ? { ...hours, [field]: value } : hours))
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Institution Profile</h1>
          <p className="text-gray-600">Manage your hospital information and credentials</p>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-green-600 text-sm">
              <Check className="w-4 h-4" />
              Saved successfully
            </span>
          )}
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {[
            { id: 'general', label: 'General Information' },
            { id: 'hours', label: 'Operating Hours' },
            { id: 'accreditations', label: 'Accreditations & Licenses' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Logo and Basic Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <div className="w-32 h-32 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-16 h-16 text-blue-600" />
                  </div>
                  {isEditing && (
                    <button className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700">
                      <Camera className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <h2 className="mt-4 text-xl font-bold text-gray-900">{profile.name}</h2>
                <p className="text-gray-500">{profile.tagline}</p>
                <div className="mt-4 flex gap-3">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                    {profile.bedCapacity} Beds
                  </span>
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                    {profile.employeeCount} Staff
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-500">Est. {profile.founded}</p>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-900">{profile.address.street}</p>
                    <p className="text-sm text-gray-500">
                      {profile.address.city}, {profile.address.postalCode}
                    </p>
                    <p className="text-sm text-gray-500">{profile.address.country}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-900">{profile.contact.phone}</p>
                    <p className="text-xs text-gray-500">Main Line</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="text-sm text-gray-900">{profile.contact.emergency}</p>
                    <p className="text-xs text-red-500">Emergency</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <p className="text-sm text-gray-900">{profile.contact.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-gray-400" />
                  <a href={profile.website} className="text-sm text-blue-600 hover:underline">
                    {profile.website}
                  </a>
                </div>
              </div>
            </div>

            {/* Registration & Social */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Registration Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Registration No.</p>
                      <p className="text-sm font-medium text-gray-900">{profile.registrationNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Award className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">License No.</p>
                      <p className="text-sm font-medium text-gray-900">{profile.licenseNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Tax ID</p>
                      <p className="text-sm font-medium text-gray-900">{profile.taxId}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Media</h3>
                <div className="grid grid-cols-2 gap-3">
                  <a href="#" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                    <Facebook className="w-5 h-5 text-blue-600" />
                    <span className="text-sm text-gray-600">Facebook</span>
                  </a>
                  <a href="#" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                    <Twitter className="w-5 h-5 text-blue-400" />
                    <span className="text-sm text-gray-600">Twitter</span>
                  </a>
                  <a href="#" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                    <Linkedin className="w-5 h-5 text-blue-700" />
                    <span className="text-sm text-gray-600">LinkedIn</span>
                  </a>
                  <a href="#" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                    <Instagram className="w-5 h-5 text-pink-600" />
                    <span className="text-sm text-gray-600">Instagram</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hours' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900">Operating Hours</h3>
            </div>
            <div className="space-y-3">
              {operatingHours.map((hours) => (
                <div
                  key={hours.day}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <span className="font-medium text-gray-900 w-32">{hours.day}</span>
                  {hours.day === 'Sunday' ? (
                    <span className="text-red-500">Closed</span>
                  ) : hours.is24hr ? (
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                      24 Hours
                    </span>
                  ) : (
                    <span className="text-gray-600">
                      {hours.open} - {hours.close}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Emergency Services:</strong> Available 24/7
              </p>
            </div>
          </div>
        )}

        {activeTab === 'accreditations' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Accreditation/License
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Issued By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Valid Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {accreditations.map((acc) => (
                  <tr key={acc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Award className="w-5 h-5 text-blue-500" />
                        <span className="font-medium text-gray-900">{acc.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{acc.issuedBy}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {acc.validFrom} to {acc.validTo}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusColor(acc.status)}`}>
                        {acc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
