import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, UserPlus } from 'lucide-react';
import { patientsService } from '../../services/patients';
import { toast } from 'sonner';

interface QuickRegModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (patient: any) => void;
}

export default function QuickRegModal({ isOpen, onClose, onSuccess }: QuickRegModalProps) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const createMutation = useMutation({
    mutationFn: patientsService.create,
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success("Patient registered successfully!");
      onSuccess(patient);
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Registration failed');
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Quick Register</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate({ fullName, phone, gender: 'other', dateOfBirth: new Date().toISOString().split('T')[0] });
        }}>
          <input 
            className="w-full p-2 border rounded mb-3" 
            placeholder="Full Name" 
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <input 
            className="w-full p-2 border rounded mb-3" 
            placeholder="Phone Number" 
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button 
            type="submit" 
            disabled={createMutation.isPending}
            className="w-full bg-blue-600 text-white p-2 rounded flex justify-center"
          >
            {createMutation.isPending ? <Loader2 className="animate-spin" /> : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}
