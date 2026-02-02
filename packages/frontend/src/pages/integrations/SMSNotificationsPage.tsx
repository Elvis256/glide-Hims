import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  MessageSquare,
  Send,
  Users,
  Calendar,
  TestTube,
  Pill,
  Loader2,
  Phone,
  CheckCircle,
  XCircle,
  AlertCircle,
  Wallet,
  Settings,
} from 'lucide-react';
import { integrationsService } from '../../../services/integrations';

type MessageType = 'custom' | 'appointment' | 'lab-results' | 'prescription';

export default function SMSNotificationsPage() {
  const queryClient = useQueryClient();
  const [messageType, setMessageType] = useState<MessageType>('custom');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  
  // Appointment reminder fields
  const [patientName, setPatientName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [doctorName, setDoctorName] = useState('');
  
  // Bulk SMS
  const [bulkRecipients, setBulkRecipients] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');

  // Get SMS status
  const { data: smsStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['sms-status'],
    queryFn: () => integrationsService.getSMSStatus(),
  });

  // Send single SMS
  const sendMutation = useMutation({
    mutationFn: async () => {
      switch (messageType) {
        case 'custom':
          return integrationsService.sendSMS(phoneNumber, customMessage);
        case 'appointment':
          return integrationsService.sendAppointmentReminder({
            phone: phoneNumber,
            patientName,
            appointmentDate,
            appointmentTime,
            doctorName: doctorName || undefined,
          });
        case 'lab-results':
          return integrationsService.sendLabResultsNotification({
            phone: phoneNumber,
            patientName,
          });
        case 'prescription':
          return integrationsService.sendPrescriptionReady({
            phone: phoneNumber,
            patientName,
          });
        default:
          throw new Error('Invalid message type');
      }
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`SMS sent successfully! Cost: ${result.cost || 'N/A'}`);
        resetForm();
      } else {
        toast.error(`Failed: ${result.status}`);
      }
    },
    onError: () => toast.error('Failed to send SMS'),
  });

  // Send bulk SMS
  const bulkMutation = useMutation({
    mutationFn: () => {
      const recipients = bulkRecipients.split('\n').map(r => r.trim()).filter(r => r);
      return integrationsService.sendBulkSMS(recipients, bulkMessage);
    },
    onSuccess: (result) => {
      toast.success(`Sent: ${result.sent}, Failed: ${result.failed}`);
      setBulkRecipients('');
      setBulkMessage('');
    },
    onError: () => toast.error('Failed to send bulk SMS'),
  });

  const resetForm = () => {
    setPhoneNumber('');
    setCustomMessage('');
    setPatientName('');
    setAppointmentDate('');
    setAppointmentTime('');
    setDoctorName('');
  };

  const messageTypes = [
    { id: 'custom', label: 'Custom Message', icon: MessageSquare, color: 'bg-blue-100 text-blue-700' },
    { id: 'appointment', label: 'Appointment Reminder', icon: Calendar, color: 'bg-green-100 text-green-700' },
    { id: 'lab-results', label: 'Lab Results Ready', icon: TestTube, color: 'bg-purple-100 text-purple-700' },
    { id: 'prescription', label: 'Prescription Ready', icon: Pill, color: 'bg-orange-100 text-orange-700' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-green-600" />
            SMS Notifications
          </h1>
          <p className="text-sm text-gray-500 mt-1">Send SMS reminders and notifications to patients</p>
        </div>

        {/* Status Badge */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
          smsStatus?.configured ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {isLoadingStatus ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : smsStatus?.configured ? (
            <>
              <CheckCircle className="w-4 h-4" />
              <span>SMS Service Active</span>
              {smsStatus.balance && (
                <span className="ml-2 px-2 py-0.5 bg-white rounded text-sm">
                  <Wallet className="w-3 h-3 inline mr-1" />
                  {smsStatus.balance.currency} {smsStatus.balance.balance}
                </span>
              )}
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4" />
              <span>Not Configured</span>
            </>
          )}
        </div>
      </div>

      {!smsStatus?.configured && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-medium text-amber-800 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Setup Required
          </h3>
          <p className="text-sm text-amber-700 mt-1">
            To enable SMS, add these to your backend .env file:
          </p>
          <pre className="mt-2 p-2 bg-amber-100 rounded text-sm font-mono">
{`AFRICASTALKING_API_KEY=your_api_key
AFRICASTALKING_USERNAME=your_username
AFRICASTALKING_SANDBOX=true`}
          </pre>
          <p className="text-sm text-amber-700 mt-2">
            Register at <a href="https://africastalking.com" target="_blank" className="underline">africastalking.com</a> (free sandbox available)
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Single SMS */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-green-600" />
            Send Single SMS
          </h2>

          {/* Message Type Selector */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {messageTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setMessageType(type.id as MessageType)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  messageType === type.id
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <type.icon className={`w-5 h-5 mx-auto mb-1 ${
                  messageType === type.id ? 'text-green-600' : 'text-gray-400'
                }`} />
                <span className={`text-sm ${
                  messageType === type.id ? 'text-green-700 font-medium' : 'text-gray-600'
                }`}>
                  {type.label}
                </span>
              </button>
            ))}
          </div>

          {/* Phone Number */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0751234567 or +256751234567"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Custom Message */}
          {messageType === 'custom' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={4}
                maxLength={160}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">{customMessage.length}/160 characters</p>
            </div>
          )}

          {/* Appointment Reminder Fields */}
          {messageType === 'appointment' && (
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Name (optional)</label>
                <input
                  type="text"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Dr. Smith"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          )}

          {/* Lab Results / Prescription Fields */}
          {(messageType === 'lab-results' || messageType === 'prescription') && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          {/* Preview */}
          {messageType !== 'custom' && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
              <p className="text-xs text-gray-500 mb-1">Message Preview:</p>
              <p className="text-sm text-gray-700">
                {messageType === 'appointment' && patientName && appointmentDate && appointmentTime && (
                  <>Dear {patientName}, this is a reminder for your appointment{doctorName ? ` with Dr. ${doctorName}` : ''} on {appointmentDate} at {appointmentTime}. Please arrive 15 mins early.</>
                )}
                {messageType === 'lab-results' && patientName && (
                  <>Dear {patientName}, your lab results are ready. Please visit the hospital to collect them or contact us for more information.</>
                )}
                {messageType === 'prescription' && patientName && (
                  <>Dear {patientName}, your prescription is ready for pickup at the pharmacy. Please bring your ID.</>
                )}
              </p>
            </div>
          )}

          <button
            onClick={() => sendMutation.mutate()}
            disabled={!phoneNumber || sendMutation.isPending || !smsStatus?.configured}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sendMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send SMS
          </button>
        </div>

        {/* Bulk SMS */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Bulk SMS
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipients (one per line)
            </label>
            <textarea
              value={bulkRecipients}
              onChange={(e) => setBulkRecipients(e.target.value)}
              placeholder="0751234567
0772345678
0783456789"
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              {bulkRecipients.split('\n').filter(r => r.trim()).length} recipients
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              value={bulkMessage}
              onChange={(e) => setBulkMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={4}
              maxLength={160}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">{bulkMessage.length}/160 characters</p>
          </div>

          <button
            onClick={() => bulkMutation.mutate()}
            disabled={!bulkRecipients || !bulkMessage || bulkMutation.isPending || !smsStatus?.configured}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {bulkMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Users className="w-4 h-4" />
            )}
            Send to All ({bulkRecipients.split('\n').filter(r => r.trim()).length})
          </button>

          {bulkMutation.data && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  Sent: {bulkMutation.data.sent}
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" />
                  Failed: {bulkMutation.data.failed}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Message Templates */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: 'Appointment Reminder', msg: 'Dear [Name], reminder: appointment tomorrow at [Time]. Please arrive 15 mins early.' },
            { title: 'Lab Results Ready', msg: 'Dear [Name], your lab results are ready. Visit us to collect or call for info.' },
            { title: 'Payment Reminder', msg: 'Dear [Name], you have an outstanding balance. Please visit billing for payment.' },
            { title: 'Follow-up Reminder', msg: 'Dear [Name], it\'s time for your follow-up visit. Please schedule an appointment.' },
            { title: 'Medication Reminder', msg: 'Dear [Name], reminder to take your medication as prescribed.' },
            { title: 'Clinic Hours', msg: 'We are open Mon-Fri 8am-5pm, Sat 9am-1pm. Emergency: [Phone]' },
          ].map((template, i) => (
            <div
              key={i}
              className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                setMessageType('custom');
                setCustomMessage(template.msg);
              }}
            >
              <h4 className="font-medium text-gray-800 text-sm">{template.title}</h4>
              <p className="text-xs text-gray-500 mt-1 truncate">{template.msg}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
