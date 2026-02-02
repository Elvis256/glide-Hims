import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Send,
  Users,
  MessageSquare,
  Mail,
  Phone,
  Search,
  CheckCircle,
  Loader2,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../services/api';
import { useFacilityId } from '../../../lib/facility';

interface Patient {
  id: string;
  mrn: string;
  fullName: string;
  phone?: string;
  email?: string;
  gender: string;
  dateOfBirth: string;
}

export default function BulkSmsPage() {
  const facilityId = useFacilityId();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [channel, setChannel] = useState<'sms' | 'whatsapp' | 'email' | 'all'>('sms');
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [filter, setFilter] = useState<'all' | 'with_phone' | 'with_email'>('with_phone');

  const { data: patients = [], isLoading } = useQuery<Patient[]>({
    queryKey: ['patients-for-sms', facilityId, filter],
    queryFn: async () => {
      const { data } = await api.get('/patients', {
        params: { facilityId, limit: 1000 },
      });
      // Filter based on contact availability
      if (filter === 'with_phone') {
        return data.filter((p: Patient) => p.phone);
      } else if (filter === 'with_email') {
        return data.filter((p: Patient) => p.email);
      }
      return data;
    },
    enabled: !!facilityId,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/notifications/bulk', {
        facilityId,
        patientIds: selectedPatients,
        channel,
        subject,
        message,
        type: 'custom',
      });
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sent to ${data.sent || selectedPatients.length} patients`);
      setSelectedPatients([]);
      setMessage('');
      setSubject('');
    },
    onError: () => toast.error('Failed to send messages'),
  });

  const filteredPatients = patients.filter(p => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return p.fullName.toLowerCase().includes(search) || 
           p.mrn.toLowerCase().includes(search) ||
           (p.phone && p.phone.includes(search));
  });

  const togglePatient = (id: string) => {
    setSelectedPatients(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedPatients.length === filteredPatients.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(filteredPatients.map(p => p.id));
    }
  };

  const selectedWithContacts = patients.filter(p => {
    if (!selectedPatients.includes(p.id)) return false;
    if (channel === 'sms' || channel === 'whatsapp') return !!p.phone;
    if (channel === 'email') return !!p.email;
    return p.phone || p.email;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-100 rounded-lg">
          <Send className="w-6 h-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Bulk Messaging</h1>
          <p className="text-sm text-gray-500">Send SMS, WhatsApp, or Email to multiple patients</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Patient Selection */}
        <div className="col-span-2 bg-white rounded-lg border">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Select Recipients
              </h2>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-3 py-1.5 border rounded-lg text-sm"
              >
                <option value="all">All Patients</option>
                <option value="with_phone">With Phone Number</option>
                <option value="with_email">With Email</option>
              </select>
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by name, MRN, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
              <button
                onClick={selectAll}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                {selectedPatients.length === filteredPatients.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading patients...</div>
            ) : filteredPatients.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No patients found</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selectedPatients.length === filteredPatients.length && filteredPatients.length > 0}
                        onChange={selectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPatients.map((patient) => (
                    <tr 
                      key={patient.id} 
                      className={`hover:bg-gray-50 cursor-pointer ${selectedPatients.includes(patient.id) ? 'bg-orange-50' : ''}`}
                      onClick={() => togglePatient(patient.id)}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedPatients.includes(patient.id)}
                          onChange={() => togglePatient(patient.id)}
                          className="rounded border-gray-300"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{patient.fullName}</div>
                        <div className="text-xs text-gray-500">{patient.mrn}</div>
                      </td>
                      <td className="px-4 py-3">
                        {patient.phone ? (
                          <span className="flex items-center gap-1 text-sm text-gray-600">
                            <Phone className="w-3 h-3" />
                            {patient.phone}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No phone</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {patient.email ? (
                          <span className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            {patient.email}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No email</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t bg-gray-50">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{selectedPatients.length}</span> patients selected
              {selectedPatients.length > 0 && (
                <span className="ml-2 text-green-600">
                  ({selectedWithContacts.length} with valid contact for {channel})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: Compose Message */}
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Compose Message
          </h2>

          {/* Channel Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'sms', label: 'SMS', icon: Phone },
                { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                { value: 'email', label: 'Email', icon: Mail },
                { value: 'all', label: 'All', icon: Send },
              ].map((ch) => (
                <button
                  key={ch.value}
                  onClick={() => setChannel(ch.value as any)}
                  className={`flex items-center justify-center gap-2 p-2 border rounded-lg transition-colors ${
                    channel === ch.value 
                      ? 'border-orange-500 bg-orange-50 text-orange-700' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <ch.icon className="w-4 h-4" />
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject (for email) */}
          {(channel === 'email' || channel === 'all') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Message from Hospital"
              />
            </div>
          )}

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Type your message here..."
            />
            <p className="text-xs text-gray-500 mt-1">
              {message.length} characters
              {channel === 'sms' && message.length > 160 && (
                <span className="text-orange-600 ml-2">
                  ({Math.ceil(message.length / 160)} SMS segments)
                </span>
              )}
            </p>
          </div>

          {/* Preview */}
          {message && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Preview:</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{message}</p>
            </div>
          )}

          {/* Warnings */}
          {selectedPatients.length > 0 && selectedWithContacts.length < selectedPatients.length && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
              <p className="text-sm text-yellow-800">
                {selectedPatients.length - selectedWithContacts.length} selected patients don't have a valid {channel === 'email' ? 'email' : 'phone number'}.
              </p>
            </div>
          )}

          {/* Send Button */}
          <button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || selectedPatients.length === 0 || !message.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            Send to {selectedWithContacts.length} Recipients
          </button>
        </div>
      </div>
    </div>
  );
}
