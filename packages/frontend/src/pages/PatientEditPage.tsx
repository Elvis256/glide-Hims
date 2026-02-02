import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { patientsService, type UpdatePatientDto } from '../services/patients';
import { usePermissions } from '../components/PermissionGate';
import { toast } from 'sonner';
import {
  Loader2,
  ArrowLeft,
  User,
  Phone,
  CreditCard,
  Users,
  Camera,
  Upload,
  X,
  Check,
  Save,
  AlertCircle,
} from 'lucide-react';

// Uganda Districts
const UGANDA_DISTRICTS = [
  'Kampala', 'Wakiso', 'Mukono', 'Jinja', 'Mbarara', 'Gulu', 'Lira', 'Soroti',
  'Masaka', 'Entebbe', 'Mbale', 'Arua', 'Fort Portal', 'Kabale', 'Kasese',
  'Hoima', 'Tororo', 'Iganga', 'Busia', 'Mityana', 'Mpigi', 'Kayunga',
  'Luweero', 'Nakasongola', 'Kiboga', 'Kyankwanzi', 'Buikwe', 'Buvuma',
  'Kalangala', 'Rakai', 'Lyantonde', 'Sembabule', 'Gomba', 'Butambala',
  'Kalungu', 'Lwengo', 'Bukomansimbi', 'Kyotera', 'Ntungamo', 'Rukungiri',
  'Kanungu', 'Kisoro', 'Rubanda', 'Isingiro', 'Kiruhura', 'Ibanda', 'Kamwenge',
  'Kyenjojo', 'Bundibugyo', 'Ntoroko', 'Kabarole', 'Bunyangabu', 'Kibaale',
  'Kagadi', 'Kakumiro', 'Kiryandongo', 'Masindi', 'Buliisa', 'Nebbi', 'Pakwach',
  'Zombo', 'Moyo', 'Adjumani', 'Obongi', 'Yumbe', 'Koboko', 'Maracha', 'Terego',
  'Amuru', 'Nwoya', 'Omoro', 'Pader', 'Agago', 'Kitgum', 'Lamwo', 'Oyam', 'Kole',
  'Apac', 'Kwania', 'Dokolo', 'Amolatar', 'Alebtong', 'Otuke', 'Kaberamaido',
  'Serere', 'Ngora', 'Kumi', 'Bukedea', 'Pallisa', 'Kibuku', 'Budaka', 'Butebo',
  'Namutumba', 'Kaliro', 'Kamuli', 'Buyende', 'Luuka', 'Mayuge', 'Namayingo',
  'Bugiri', 'Bugweri', 'Sironko', 'Bulambuli', 'Kapchorwa', 'Kween', 'Bukwo',
  'Bududa', 'Manafwa', 'Namisindwa', 'Mbale', 'Moroto', 'Nakapiripirit', 'Napak',
  'Kotido', 'Abim', 'Kaabong', 'Karenga', 'Amudat', 'Katakwi', 'Amuria', 'Kapelebyong'
].sort();

// Religion options
const RELIGIONS = [
  'Catholic',
  'Protestant/Anglican',
  'Muslim',
  'Pentecostal/Born Again',
  'SDA',
  'Orthodox',
  'Traditional',
  'Other'
];

// Nationalities
const NATIONALITIES = [
  'Ugandan',
  'Kenyan',
  'Tanzanian',
  'Rwandan',
  'South Sudanese',
  'Congolese',
  'Burundian',
  'Ethiopian',
  'Somali',
  'Nigerian',
  'Other'
];

interface FormData {
  fullName: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  nationality?: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  address?: string;
  occupation?: string;
  bloodGroup?: string;
  allergies?: string;
  religion?: string;
  district?: string;
  village?: string;
  photoUrl?: string;
  nextOfKin?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
}

// NIN validation: 2 letters + 8 digits + 5 alphanumeric
const NIN_REGEX = /^[A-Z]{2}\d{8}[A-Z0-9]{5}$/i;

const validateNIN = (nin: string): boolean => {
  if (!nin) return false;
  return NIN_REGEX.test(nin.toUpperCase());
};

// Calculate age from DOB
const calculateAge = (dob: string): string => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const today = new Date();
  
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  
  if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
    years--;
    months += 12;
  }
  
  if (today.getDate() < birthDate.getDate()) {
    months--;
    if (months < 0) months += 12;
  }
  
  if (years === 0) {
    return months === 1 ? '1 month' : `${months} months`;
  } else if (years === 1) {
    return '1 year';
  }
  return `${years} years`;
};

export default function PatientEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  
  const [showWebcam, setShowWebcam] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    gender: 'male',
    dateOfBirth: '',
    nationality: '',
    nationalId: '',
    phone: '',
    email: '',
    address: '',
    occupation: '',
    bloodGroup: '',
    allergies: '',
    religion: '',
    district: '',
    village: '',
    photoUrl: '',
    nextOfKin: { name: '', phone: '', relationship: '' },
  });

  // Store original data to detect changes
  const [originalData, setOriginalData] = useState<FormData | null>(null);

  // Fetch patient data
  const { data: patient, isLoading, error } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsService.getById(id!),
    enabled: !!id,
  });

  // Populate form when patient data is loaded
  useEffect(() => {
    if (patient) {
      const metadata = patient.metadata as Record<string, unknown> || {};
      const initialData: FormData = {
        fullName: patient.fullName || '',
        gender: patient.gender || 'male',
        dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.split('T')[0] : '',
        nationality: (metadata.nationality as string) || '',
        nationalId: patient.nationalId || '',
        phone: patient.phone || '',
        email: patient.email || '',
        address: patient.address || '',
        occupation: (metadata.occupation as string) || '',
        bloodGroup: patient.bloodGroup || '',
        allergies: (metadata.allergies as string) || '',
        religion: (metadata.religion as string) || '',
        district: (metadata.district as string) || '',
        village: (metadata.village as string) || '',
        photoUrl: (metadata.photoUrl as string) || '',
        nextOfKin: {
          name: patient.nextOfKin?.name || '',
          phone: patient.nextOfKin?.phone || '',
          relationship: patient.nextOfKin?.relationship || '',
        },
      };
      setFormData(initialData);
      setOriginalData(initialData);
    }
  }, [patient]);

  // Check which fields have changed
  const changedFields = useMemo(() => {
    if (!originalData) return new Set<string>();
    const changes = new Set<string>();
    
    (Object.keys(formData) as (keyof FormData)[]).forEach((key) => {
      if (key === 'nextOfKin') {
        const orig = originalData.nextOfKin || {};
        const curr = formData.nextOfKin || {};
        if (orig.name !== curr.name) changes.add('nextOfKin.name');
        if (orig.phone !== curr.phone) changes.add('nextOfKin.phone');
        if (orig.relationship !== curr.relationship) changes.add('nextOfKin.relationship');
      } else if (formData[key] !== originalData[key]) {
        changes.add(key);
      }
    });
    
    return changes;
  }, [formData, originalData]);

  const hasChanges = changedFields.size > 0;

  // Form validation
  const isNINValid = formData.nationalId ? validateNIN(formData.nationalId) : null;
  const calculatedAge = calculateAge(formData.dateOfBirth);
  
  const isFormValid = 
    formData.fullName.trim() !== '' &&
    formData.gender !== undefined &&
    formData.dateOfBirth !== '';

  // Permission check
  const canEdit = hasPermission('patients.update');

  // Webcam handlers
  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 320, height: 240 } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowWebcam(true);
    } catch (err) {
      console.error('Error accessing webcam:', err);
      toast.error('Could not access webcam. Please check permissions.');
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowWebcam(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setFormData(prev => ({ ...prev, photoUrl: dataUrl }));
        stopWebcam();
      }
    }
  }, [stopWebcam]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const removePhoto = useCallback(() => {
    setFormData(prev => ({ ...prev, photoUrl: '' }));
  }, []);

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Update patient mutation
  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Construct address from district and village
      const address = [data.village, data.district].filter(Boolean).join(', ') || data.address;
      
      const apiData: UpdatePatientDto = {
        fullName: data.fullName,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth,
        nationalId: data.nationalId || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: address || undefined,
        bloodGroup: data.bloodGroup || undefined,
        nextOfKin: data.nextOfKin?.name ? {
          name: data.nextOfKin.name,
          phone: data.nextOfKin.phone,
          relationship: data.nextOfKin.relationship,
        } : undefined,
        metadata: {
          occupation: data.occupation,
          allergies: data.allergies,
          religion: data.religion,
          district: data.district,
          village: data.village,
          nationality: data.nationality,
          photoUrl: data.photoUrl,
        },
      };
      
      return patientsService.update(id!, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
      toast.success('Patient updated successfully');
      navigate(`/patients/${id}`);
    },
    onError: () => {
      toast.error('Failed to update patient. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  // Helper to get field class with change highlighting
  const getFieldClass = (fieldName: string, baseClass: string = '') => {
    const isChanged = changedFields.has(fieldName);
    return `${baseClass} ${isChanged ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading patient data...</span>
      </div>
    );
  }

  // Error state
  if (error || !patient) {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <div className="card p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Patient Not Found</h2>
          <p className="text-gray-500 mb-4">
            Unable to load patient data. The patient may not exist or you may not have access.
          </p>
          <button onClick={() => navigate(-1)} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Permission denied
  if (!canEdit) {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <div className="card p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-4">
            You do not have permission to edit patient records.
          </p>
          <button onClick={() => navigate(-1)} className="btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Edit Patient</h1>
            <p className="text-gray-500 text-sm">
              MRN: {patient.mrn} • {patient.fullName}
              {hasChanges && <span className="ml-2 text-yellow-600 font-medium">• Unsaved changes</span>}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        {/* Form Grid - All sections in one view */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-y-auto">
          {/* Column 1: Personal Info + Photo */}
          <div className="space-y-3">
            {/* Photo Section */}
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-2">
                <Camera className="w-4 h-4 text-blue-600" />
                <h2 className="font-semibold text-sm">Patient Photo</h2>
                {changedFields.has('photoUrl') && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Changed</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {formData.photoUrl ? (
                    <div className="relative">
                      <img
                        src={formData.photoUrl}
                        alt="Patient"
                        className={`w-20 h-20 rounded-full object-cover border-2 ${changedFields.has('photoUrl') ? 'border-yellow-400' : 'border-gray-200'}`}
                      />
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                      <User className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={startWebcam}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                  >
                    <Camera className="w-3 h-3" />
                    Capture
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
                  >
                    <Upload className="w-3 h-3" />
                    Upload
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>
              
              {/* Webcam Modal */}
              {showWebcam && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-4 max-w-md">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold">Capture Photo</h3>
                      <button type="button" onClick={stopWebcam} className="text-gray-500 hover:text-gray-700">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full rounded-lg mb-3"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={stopWebcam}
                        className="btn-secondary flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        Capture
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Personal Information */}
            <div className="card p-4 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-blue-600" />
                <h2 className="font-semibold text-sm">Personal Information</h2>
              </div>
              <div className="space-y-3 flex-1">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className={getFieldClass('fullName', `input text-sm py-1.5 ${!formData.fullName.trim() ? 'border-red-300' : ''}`)}
                    placeholder="Patient's full name"
                    required
                  />
                  {!formData.fullName.trim() && (
                    <p className="text-xs text-red-500 mt-0.5">Full name is required</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' | 'other' })}
                      className={getFieldClass('gender', 'input text-sm py-1.5')}
                      required
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      DOB <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className={getFieldClass('dateOfBirth', `input text-sm py-1.5 ${!formData.dateOfBirth ? 'border-red-300' : ''}`)}
                      required
                    />
                    {calculatedAge && (
                      <p className="text-xs text-blue-600 mt-0.5 font-medium">{calculatedAge}</p>
                    )}
                    {!formData.dateOfBirth && (
                      <p className="text-xs text-red-500 mt-0.5">Date of birth is required</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nationality</label>
                    <select
                      value={formData.nationality}
                      onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                      className={getFieldClass('nationality', 'input text-sm py-1.5')}
                    >
                      <option value="">Select...</option>
                      {NATIONALITIES.map(nat => (
                        <option key={nat} value={nat}>{nat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Religion</label>
                    <select
                      value={formData.religion}
                      onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                      className={getFieldClass('religion', 'input text-sm py-1.5')}
                    >
                      <option value="">Select...</option>
                      {RELIGIONS.map(rel => (
                        <option key={rel} value={rel}>{rel}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Blood Group</label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    className={getFieldClass('bloodGroup', 'input text-sm py-1.5')}
                  >
                    <option value="">Select...</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Occupation</label>
                  <input
                    type="text"
                    value={formData.occupation}
                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    className={getFieldClass('occupation', 'input text-sm py-1.5')}
                    placeholder="Occupation"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Known Allergies</label>
                  <input
                    type="text"
                    value={formData.allergies}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                    className={getFieldClass('allergies', 'input text-sm py-1.5')}
                    placeholder="List allergies..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Contact & ID */}
          <div className="space-y-3">
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-blue-600" />
                <h2 className="font-semibold text-sm">Contact Information</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={getFieldClass('phone', 'input text-sm py-1.5')}
                    placeholder="+256..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={getFieldClass('email', 'input text-sm py-1.5')}
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">District</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className={getFieldClass('district', 'input text-sm py-1.5')}
                  >
                    <option value="">Select district...</option>
                    {UGANDA_DISTRICTS.map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Village/Address</label>
                  <input
                    type="text"
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                    className={getFieldClass('village', 'input text-sm py-1.5')}
                    placeholder="Village name"
                  />
                </div>
              </div>
            </div>

            <div className="card p-3">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <h2 className="font-semibold text-sm">Identification</h2>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  National ID (NIN)
                  {formData.nationalId && (
                    <span className="ml-2">
                      {isNINValid ? (
                        <Check className="w-4 h-4 text-green-500 inline" />
                      ) : (
                        <X className="w-4 h-4 text-red-500 inline" />
                      )}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.nationalId}
                  onChange={(e) => setFormData({ ...formData, nationalId: e.target.value.toUpperCase() })}
                  className={getFieldClass('nationalId', `input text-sm py-1.5 ${
                    formData.nationalId 
                      ? isNINValid 
                        ? 'border-green-300 focus:border-green-500' 
                        : 'border-red-300 focus:border-red-500'
                      : ''
                  }`)}
                  placeholder="CM12345678ABCDE"
                  maxLength={15}
                />
                <p className="text-xs text-gray-500 mt-0.5">
                  Format: 2 letters + 8 digits + 5 alphanumeric (e.g., CM12345678ABCDE)
                </p>
                {formData.nationalId && !isNINValid && (
                  <p className="text-xs text-red-500 mt-0.5">Invalid NIN format</p>
                )}
              </div>
            </div>
          </div>

          {/* Column 3: Next of Kin */}
          <div className="card p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-blue-600" />
              <h2 className="font-semibold text-sm">Next of Kin</h2>
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.nextOfKin?.name || ''}
                  onChange={(e) => setFormData({ ...formData, nextOfKin: { ...formData.nextOfKin, name: e.target.value } })}
                  className={getFieldClass('nextOfKin.name', 'input text-sm py-1.5')}
                  placeholder="Next of kin name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.nextOfKin?.phone || ''}
                  onChange={(e) => setFormData({ ...formData, nextOfKin: { ...formData.nextOfKin, phone: e.target.value } })}
                  className={getFieldClass('nextOfKin.phone', 'input text-sm py-1.5')}
                  placeholder="+256..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Relationship</label>
                <select
                  value={formData.nextOfKin?.relationship || ''}
                  onChange={(e) => setFormData({ ...formData, nextOfKin: { ...formData.nextOfKin, relationship: e.target.value } })}
                  className={getFieldClass('nextOfKin.relationship', 'input text-sm py-1.5')}
                >
                  <option value="">Select...</option>
                  <option value="spouse">Spouse</option>
                  <option value="parent">Parent</option>
                  <option value="child">Child</option>
                  <option value="sibling">Sibling</option>
                  <option value="friend">Friend</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Actions - Fixed at bottom */}
        <div className="flex gap-4 mt-4 pt-4 border-t flex-shrink-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary px-8"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending || !isFormValid || !hasChanges}
            className={`btn-primary flex-1 flex items-center justify-center gap-2 ${
              (!isFormValid || !hasChanges) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </div>

        {updateMutation.isError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mt-2">
            Failed to update patient. Please try again.
          </div>
        )}
      </form>
    </div>
  );
}
