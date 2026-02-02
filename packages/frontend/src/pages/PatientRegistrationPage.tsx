import { useState } from 'react';
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
} from 'lucide-react';

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
  nextOfKin?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
}

export default function PatientRegistrationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addPatient = usePatientStore((state) => state.addPatient);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdPatient, setCreatedPatient] = useState<{ mrn: string; fullName: string } | null>(null);
  const [duplicates, setDuplicates] = useState<Array<{ id: string; mrn: string; fullName: string; phone?: string }>>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

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
    nextOfKin: { name: '', phone: '', relationship: '' },
  });

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
      const apiData: CreatePatientDto = {
        fullName: data.fullName,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth,
        nationalId: data.nationalId || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
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
        paymentType: 'cash',
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
      nextOfKin: { name: '', phone: '', relationship: '' },
    });
    setShowSuccess(false);
    setCreatedPatient(null);
    setDuplicates([]);
    setShowDuplicateWarning(false);
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
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
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

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        {/* Form Grid - All sections in one view */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
          {/* Column 1: Personal Info */}
          <div className="card p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-blue-600" />
              <h2 className="font-semibold text-sm">Personal Information</h2>
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="input text-sm py-1.5"
                  placeholder="Patient's full name"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gender *</label>
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">DOB *</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="input text-sm py-1.5"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nationality</label>
                  <select
                    value={formData.nationality}
                    onChange={(e) => handleNationalityChange(e.target.value)}
                    className="input text-sm py-1.5"
                  >
                    <option value="">Select...</option>
                    <option value="Ugandan">Ugandan</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
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
              </div>
              <div className="grid grid-cols-2 gap-2">
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
            </div>
          </div>

          {/* Column 2: Contact, ID & Insurance/Payment */}
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
              </div>
              <div className="mt-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input text-sm py-1.5"
                  placeholder="Full address"
                />
              </div>
            </div>

            <div className="card p-3">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <h2 className="font-semibold text-sm">Identification</h2>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">National ID / Passport</label>
                <input
                  type="text"
                  value={formData.nationalId}
                  onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                  className="input text-sm py-1.5"
                  placeholder="ID number"
                />
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
            disabled={createMutation.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? (
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
