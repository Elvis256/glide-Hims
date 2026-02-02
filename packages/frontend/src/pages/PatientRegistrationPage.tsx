import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { usePatientStore, type PatientRecord } from '../store/patients';
import { patientsService, type CreatePatientDto } from '../services/patients';
import {
  UserPlus,
  Loader2,
  CheckCircle,
  ArrowLeft,
  User,
  Phone,
  CreditCard,
  Users,
  AlertTriangle,
  Camera,
  Upload,
  X,
  Check,
  ToggleLeft,
  ToggleRight,
  Wallet,
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

// Insurance providers
const INSURANCE_PROVIDERS = [
  'UAP',
  'Jubilee',
  'AAR',
  'ICEA',
  'Sanlam',
  'Liberty',
  'APA',
  'CIC',
  'GA Insurance',
  'Other'
];

// Corporate companies (sample list)
const CORPORATE_COMPANIES = [
  'MTN Uganda',
  'Airtel Uganda',
  'Stanbic Bank',
  'DFCU Bank',
  'Centenary Bank',
  'Bank of Uganda',
  'NSSF',
  'Uganda Revenue Authority',
  'Total Energies',
  'UMEME',
  'NWSC',
  'Parliament of Uganda',
  'Makerere University',
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
  maritalStatus?: string;
  bloodGroup?: string;
  allergies?: string;
  religion?: string;
  district?: string;
  village?: string;
  paymentType?: 'cash' | 'insurance' | 'corporate';
  insuranceProvider?: string;
  insuranceId?: string;
  corporateName?: string;
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

export default function PatientRegistrationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addPatient = usePatientStore((state) => state.addPatient);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdPatient, setCreatedPatient] = useState<{ mrn: string; fullName: string } | null>(null);
  const [duplicates, setDuplicates] = useState<Array<{ id: string; mrn: string; fullName: string; phone?: string }>>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [quickRegistration, setQuickRegistration] = useState(false);
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
    maritalStatus: '',
    bloodGroup: '',
    allergies: '',
    religion: '',
    district: '',
    village: '',
    paymentType: 'cash',
    insuranceProvider: '',
    insuranceId: '',
    corporateName: '',
    photoUrl: '',
    nextOfKin: { name: '', phone: '', relationship: '' },
  });

  // Form validation
  const isNINValid = formData.nationalId ? validateNIN(formData.nationalId) : null;
  const calculatedAge = calculateAge(formData.dateOfBirth);
  
  const isFormValid = 
    formData.fullName.trim() !== '' &&
    formData.gender !== undefined &&
    formData.dateOfBirth !== '';

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
      alert('Could not access webcam. Please check permissions.');
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

  // Handle nationality change - auto-prefix phone with +256 for Ugandan
  const handleNationalityChange = (nationality: string) => {
    if (nationality === 'Ugandan') {
      // Set phone to +256 if empty or doesn't start with +256
      const currentPhone = formData.phone || '';
      if (!currentPhone.startsWith('+256')) {
        setFormData({ ...formData, nationality, phone: '+256' });
      } else {
        setFormData({ ...formData, nationality });
      }
    } else {
      // For non-Ugandan, clear the +256 prefix if it was auto-added
      const currentPhone = formData.phone || '';
      if (currentPhone === '+256') {
        setFormData({ ...formData, nationality, phone: '' });
      } else {
        setFormData({ ...formData, nationality });
      }
    }
  };

  // Check for duplicates mutation
  const checkDuplicatesMutation = useMutation({
    mutationFn: async (data: CreatePatientDto) => {
      return patientsService.checkDuplicates(data);
    },
    onSuccess: (result) => {
      if (result.hasDuplicates) {
        setDuplicates(result.duplicates);
        setShowDuplicateWarning(true);
      } else {
        // No duplicates, proceed with registration
        createMutation.mutate(formData);
      }
    },
    onError: () => {
      // If check fails, proceed anyway (backend will validate)
      createMutation.mutate(formData);
    },
  });

  // Create patient mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Construct address from district and village
      const address = [data.village, data.district].filter(Boolean).join(', ') || data.address;
      
      const apiData: CreatePatientDto = {
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
          maritalStatus: data.maritalStatus,
          allergies: data.allergies,
          religion: data.religion,
          district: data.district,
          village: data.village,
          nationality: data.nationality,
          paymentType: data.paymentType,
          insuranceProvider: data.insuranceProvider,
          insuranceId: data.insuranceId,
          corporateName: data.corporateName,
          photoUrl: data.photoUrl,
        },
      };
      
      return patientsService.create(apiData);
    },
    onSuccess: (patient) => {
      // Add to shared patient store for local access
      const patientRecord: PatientRecord = {
        id: patient.id,
        mrn: patient.mrn,
        fullName: patient.fullName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        nationalId: patient.nationalId,
        bloodGroup: patient.bloodGroup,
        createdAt: patient.createdAt,
        paymentType: formData.paymentType || 'cash',
        nextOfKin: formData.nextOfKin,
      };
      
      addPatient(patientRecord);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setCreatedPatient({
        mrn: patient.mrn,
        fullName: patient.fullName,
      });
      setShowSuccess(true);
      setShowDuplicateWarning(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // First check for duplicates
    const apiData: CreatePatientDto = {
      fullName: formData.fullName,
      gender: formData.gender,
      dateOfBirth: formData.dateOfBirth,
      nationalId: formData.nationalId || undefined,
      phone: formData.phone || undefined,
    };
    
    checkDuplicatesMutation.mutate(apiData);
  };

  const handleProceedAnyway = () => {
    setShowDuplicateWarning(false);
    createMutation.mutate(formData);
  };

  const handleReset = () => {
    setFormData({
      fullName: '',
      gender: 'male',
      dateOfBirth: '',
      nationality: '',
      nationalId: '',
      phone: '',
      email: '',
      address: '',
      occupation: '',
      maritalStatus: '',
      bloodGroup: '',
      allergies: '',
      religion: '',
      district: '',
      village: '',
      paymentType: 'cash',
      insuranceProvider: '',
      insuranceId: '',
      corporateName: '',
      photoUrl: '',
      nextOfKin: { name: '', phone: '', relationship: '' },
    });
    setShowSuccess(false);
    setCreatedPatient(null);
    setDuplicates([]);
    setShowDuplicateWarning(false);
    setQuickRegistration(false);
    stopWebcam();
  };

  // Duplicate Warning Modal
  if (showDuplicateWarning && duplicates.length > 0) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-10 h-10 text-yellow-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Possible Duplicate Found</h2>
          <p className="text-gray-500 mb-4 text-center">
            We found existing patients that may match this registration:
          </p>
          <div className="space-y-2 mb-6">
            {duplicates.map((dup) => (
              <div key={dup.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="font-medium text-gray-900">{dup.fullName}</p>
                <p className="text-sm text-gray-600">MRN: {dup.mrn}</p>
                {dup.phone && <p className="text-sm text-gray-600">Phone: {dup.phone}</p>}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowDuplicateWarning(false)} className="btn-secondary flex-1">
              Go Back
            </button>
            <button
              onClick={handleProceedAnyway}
              disabled={createMutation.isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Register Anyway'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showSuccess && createdPatient) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Patient Registered!</h2>
          <p className="text-gray-500 mb-4">
            {createdPatient.fullName} has been registered successfully.
          </p>
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">Patient MRN</p>
            <p className="text-2xl font-mono font-bold text-blue-700">{createdPatient.mrn}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleReset} className="btn-secondary flex-1">
              Register Another
            </button>
            <button
              onClick={() => navigate('/opd/token')}
              className="btn-primary flex-1"
            >
              Issue OPD Token
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header with Quick Registration Toggle */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Register New Patient</h1>
            <p className="text-gray-500 text-sm">Enter patient details to create a new record</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setQuickRegistration(!quickRegistration)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
            quickRegistration 
              ? 'bg-blue-50 border-blue-300 text-blue-700' 
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
        >
          {quickRegistration ? (
            <ToggleRight className="w-5 h-5" />
          ) : (
            <ToggleLeft className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">Quick Registration</span>
        </button>
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
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {formData.photoUrl ? (
                    <div className="relative">
                      <img
                        src={formData.photoUrl}
                        alt="Patient"
                        className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
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
                    className={`input text-sm py-1.5 ${!formData.fullName.trim() ? 'border-red-300' : ''}`}
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
                      className="input text-sm py-1.5"
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
                      className={`input text-sm py-1.5 ${!formData.dateOfBirth ? 'border-red-300' : ''}`}
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
                
                {!quickRegistration && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nationality</label>
                        <select
                          value={formData.nationality}
                          onChange={(e) => handleNationalityChange(e.target.value)}
                          className="input text-sm py-1.5"
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
                          className="input text-sm py-1.5"
                        >
                          <option value="">Select...</option>
                          {RELIGIONS.map(rel => (
                            <option key={rel} value={rel}>{rel}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Marital Status</label>
                        <select
                          value={formData.maritalStatus}
                          onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
                          className="input text-sm py-1.5"
                        >
                          <option value="">Select...</option>
                          <option value="single">Single</option>
                          <option value="married">Married</option>
                          <option value="divorced">Divorced</option>
                          <option value="widowed">Widowed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Blood Group</label>
                        <select
                          value={formData.bloodGroup}
                          onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                          className="input text-sm py-1.5"
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
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Occupation</label>
                      <input
                        type="text"
                        value={formData.occupation}
                        onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                        className="input text-sm py-1.5"
                        placeholder="Occupation"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Known Allergies</label>
                      <input
                        type="text"
                        value={formData.allergies}
                        onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                        className="input text-sm py-1.5"
                        placeholder="List allergies..."
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Contact, ID & Payment */}
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
                    className="input text-sm py-1.5"
                    placeholder="+256..."
                  />
                </div>
                {!quickRegistration && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input text-sm py-1.5"
                      placeholder="email@example.com"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">District</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="input text-sm py-1.5"
                  >
                    <option value="">Select district...</option>
                    {UGANDA_DISTRICTS.map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Village/LC1</label>
                  <input
                    type="text"
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                    className="input text-sm py-1.5"
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
                  className={`input text-sm py-1.5 ${
                    formData.nationalId 
                      ? isNINValid 
                        ? 'border-green-300 focus:border-green-500' 
                        : 'border-red-300 focus:border-red-500'
                      : ''
                  }`}
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

            {/* Payment Type Section */}
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-blue-600" />
                <h2 className="font-semibold text-sm">Payment / Insurance Type</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Payment Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'insurance', 'corporate'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ 
                          ...formData, 
                          paymentType: type,
                          insuranceProvider: type !== 'insurance' ? '' : formData.insuranceProvider,
                          insuranceId: type !== 'insurance' ? '' : formData.insuranceId,
                          corporateName: type !== 'corporate' ? '' : formData.corporateName
                        })}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                          formData.paymentType === type
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {formData.paymentType === 'insurance' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Insurance Provider</label>
                      <select
                        value={formData.insuranceProvider}
                        onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                        className="input text-sm py-1.5"
                      >
                        <option value="">Select provider...</option>
                        {INSURANCE_PROVIDERS.map(provider => (
                          <option key={provider} value={provider}>{provider}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Insurance ID / Member Number</label>
                      <input
                        type="text"
                        value={formData.insuranceId}
                        onChange={(e) => setFormData({ ...formData, insuranceId: e.target.value })}
                        className="input text-sm py-1.5"
                        placeholder="Enter insurance ID"
                      />
                    </div>
                  </>
                )}

                {formData.paymentType === 'corporate' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Company Name</label>
                    <select
                      value={formData.corporateName}
                      onChange={(e) => setFormData({ ...formData, corporateName: e.target.value })}
                      className="input text-sm py-1.5"
                    >
                      <option value="">Select company...</option>
                      {CORPORATE_COMPANIES.map(company => (
                        <option key={company} value={company}>{company}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 3: Next of Kin */}
          {!quickRegistration && (
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
                    className="input text-sm py-1.5"
                    placeholder="Next of kin name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.nextOfKin?.phone || ''}
                    onChange={(e) => setFormData({ ...formData, nextOfKin: { ...formData.nextOfKin, phone: e.target.value } })}
                    className="input text-sm py-1.5"
                    placeholder="+256..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Relationship</label>
                  <select
                    value={formData.nextOfKin?.relationship || ''}
                    onChange={(e) => setFormData({ ...formData, nextOfKin: { ...formData.nextOfKin, relationship: e.target.value } })}
                    className="input text-sm py-1.5"
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
          )}
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
            disabled={createMutation.isPending || checkDuplicatesMutation.isPending || !isFormValid}
            className={`btn-primary flex-1 flex items-center justify-center gap-2 ${
              !isFormValid ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {(createMutation.isPending || checkDuplicatesMutation.isPending) ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Register Patient
              </>
            )}
          </button>
        </div>

        {createMutation.isError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mt-2">
            Failed to register patient. Please try again.
          </div>
        )}
      </form>
    </div>
  );
}
