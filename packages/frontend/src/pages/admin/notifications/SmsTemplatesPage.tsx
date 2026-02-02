import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  MessageSquare,
  Mail,
  Info,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../services/api';
import { useFacilityId } from '../../../lib/facility';

interface SmsTemplate {
  id: string;
  facilityId: string;
  type: string;
  name: string;
  smsTemplate: string;
  whatsappTemplate?: string;
  emailSubject?: string;
  emailTemplate?: string;
  isActive: boolean;
  variables?: string[];
}

const defaultTemplates: Omit<SmsTemplate, 'id' | 'facilityId'>[] = [
  {
    type: 'appointment',
    name: 'Appointment Reminder',
    smsTemplate: 'Dear {patientName}, this is a reminder for your appointment on {appointmentDate} at {appointmentTime}. Please arrive 15 mins early. - {hospitalName}',
    whatsappTemplate: '📅 *Appointment Reminder*\n\nDear {patientName},\n\nThis is a reminder for your upcoming appointment:\n\n📆 Date: {appointmentDate}\n⏰ Time: {appointmentTime}\n👨‍⚕️ Doctor: {doctorName}\n\nPlease arrive 15 minutes early.\n\nFor any changes, please call us.\n\n- {hospitalName}',
    emailSubject: 'Appointment Reminder - {hospitalName}',
    emailTemplate: '<h2>Appointment Reminder</h2><p>Dear {patientName},</p><p>This is a reminder for your appointment on <strong>{appointmentDate}</strong> at <strong>{appointmentTime}</strong> with Dr. {doctorName}.</p><p>Please arrive 15 minutes early.</p><p>Best regards,<br/>{hospitalName}</p>',
    isActive: true,
    variables: ['{patientName}', '{appointmentDate}', '{appointmentTime}', '{doctorName}', '{hospitalName}'],
  },
  {
    type: 'lab_result',
    name: 'Lab Results Ready',
    smsTemplate: 'Dear {patientName}, your lab results are ready. Please visit {hospitalName} to collect them or contact us for details.',
    whatsappTemplate: '🔬 *Lab Results Ready*\n\nDear {patientName},\n\nYour laboratory test results are now available.\n\nPlease visit our facility to collect your results or contact us for more information.\n\n- {hospitalName}',
    emailSubject: 'Your Lab Results are Ready - {hospitalName}',
    emailTemplate: '<h2>Lab Results Ready</h2><p>Dear {patientName},</p><p>Your laboratory test results are now ready for collection.</p><p>Please visit {hospitalName} to collect your results or contact us for more details.</p><p>Best regards,<br/>{hospitalName}</p>',
    isActive: true,
    variables: ['{patientName}', '{hospitalName}', '{testName}'],
  },
  {
    type: 'prescription_ready',
    name: 'Prescription Ready',
    smsTemplate: 'Dear {patientName}, your prescription is ready for pickup at {hospitalName} pharmacy. Receipt: {receiptNumber}',
    whatsappTemplate: '💊 *Prescription Ready*\n\nDear {patientName},\n\nYour prescription is ready for pickup at our pharmacy.\n\n🧾 Receipt: {receiptNumber}\n\nPlease bring this message when collecting your medication.\n\n- {hospitalName}',
    emailSubject: 'Your Prescription is Ready - {hospitalName}',
    emailTemplate: '<h2>Prescription Ready</h2><p>Dear {patientName},</p><p>Your prescription is now ready for pickup at our pharmacy.</p><p>Receipt Number: <strong>{receiptNumber}</strong></p><p>Please bring your ID when collecting your medication.</p><p>Best regards,<br/>{hospitalName}</p>',
    isActive: true,
    variables: ['{patientName}', '{hospitalName}', '{receiptNumber}'],
  },
  {
    type: 'thank_you',
    name: 'Thank You Message',
    smsTemplate: 'Thank you for visiting {hospitalName}, {patientName}. We wish you good health! Receipt: {receiptNumber}',
    whatsappTemplate: '🙏 *Thank You for Your Visit*\n\nDear {patientName},\n\nThank you for choosing {hospitalName} for your healthcare needs.\n\nWe wish you good health and a speedy recovery!\n\nIf you have any concerns, please don\'t hesitate to contact us.\n\n- {hospitalName}',
    emailSubject: 'Thank You for Visiting {hospitalName}',
    emailTemplate: '<h2>Thank You for Your Visit!</h2><p>Dear {patientName},</p><p>Thank you for choosing <strong>{hospitalName}</strong> for your healthcare needs.</p><p>We wish you good health and a speedy recovery. If you have any concerns, please don\'t hesitate to contact us.</p><p>Best regards,<br/>{hospitalName}</p>',
    isActive: true,
    variables: ['{patientName}', '{hospitalName}', '{receiptNumber}'],
  },
  {
    type: 'follow_up',
    name: 'Follow-up Reminder',
    smsTemplate: 'Dear {patientName}, your follow-up visit is due. Please schedule an appointment at {hospitalName}. Call: {hospitalPhone}',
    whatsappTemplate: '📋 *Follow-up Reminder*\n\nDear {patientName},\n\nYour follow-up visit is due soon.\n\nPlease schedule an appointment at your earliest convenience.\n\n📞 Contact: {hospitalPhone}\n\n- {hospitalName}',
    emailSubject: 'Follow-up Reminder - {hospitalName}',
    emailTemplate: '<h2>Follow-up Reminder</h2><p>Dear {patientName},</p><p>Your follow-up visit is due. Please schedule an appointment at your earliest convenience.</p><p>Contact us at: <strong>{hospitalPhone}</strong></p><p>Best regards,<br/>{hospitalName}</p>',
    isActive: true,
    variables: ['{patientName}', '{hospitalName}', '{hospitalPhone}'],
  },
  {
    type: 'payment_reminder',
    name: 'Payment Reminder',
    smsTemplate: 'Dear {patientName}, you have an outstanding balance of {amount} at {hospitalName}. Please settle at your earliest convenience.',
    whatsappTemplate: '💳 *Payment Reminder*\n\nDear {patientName},\n\nThis is a friendly reminder that you have an outstanding balance of *{amount}* at {hospitalName}.\n\nPlease settle your account at your earliest convenience.\n\n- {hospitalName}',
    emailSubject: 'Payment Reminder - {hospitalName}',
    emailTemplate: '<h2>Payment Reminder</h2><p>Dear {patientName},</p><p>This is a friendly reminder that you have an outstanding balance of <strong>{amount}</strong> at {hospitalName}.</p><p>Please settle your account at your earliest convenience.</p><p>Best regards,<br/>{hospitalName}</p>',
    isActive: true,
    variables: ['{patientName}', '{hospitalName}', '{amount}', '{dueDate}'],
  },
];

export default function SmsTemplatesPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: templates = [], isLoading } = useQuery<SmsTemplate[]>({
    queryKey: ['sms-templates', facilityId],
    queryFn: async () => {
      try {
        const { data } = await api.get('/notifications/templates', {
          params: { facilityId },
        });
        return data;
      } catch {
        // Return default templates if none exist
        return [];
      }
    },
    enabled: !!facilityId,
  });

  const saveMutation = useMutation({
    mutationFn: async (template: Partial<SmsTemplate>) => {
      if (template.id) {
        const { data } = await api.put(`/notifications/templates/${template.id}`, template);
        return data;
      } else {
        const { data } = await api.post('/notifications/templates', { ...template, facilityId });
        return data;
      }
    },
    onSuccess: () => {
      toast.success('Template saved successfully');
      queryClient.invalidateQueries({ queryKey: ['sms-templates'] });
      setEditingTemplate(null);
      setIsCreating(false);
    },
    onError: () => toast.error('Failed to save template'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notifications/templates/${id}`);
    },
    onSuccess: () => {
      toast.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['sms-templates'] });
    },
    onError: () => toast.error('Failed to delete template'),
  });

  const initializeDefaults = async () => {
    for (const template of defaultTemplates) {
      await saveMutation.mutateAsync({ ...template, facilityId });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Merge saved templates with defaults
  const allTemplates = templates.length > 0 ? templates : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <FileText className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Message Templates</h1>
            <p className="text-sm text-gray-500">Customize SMS, WhatsApp, and Email templates</p>
          </div>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <button
              onClick={initializeDefaults}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" />
              Initialize Defaults
            </button>
          )}
          <button
            onClick={() => {
              setIsCreating(true);
              setEditingTemplate({
                id: '',
                facilityId,
                type: 'custom',
                name: '',
                smsTemplate: '',
                isActive: true,
                variables: [],
              });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>
      </div>

      {/* Variables Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">Available Variables</h3>
            <p className="text-sm text-blue-700 mt-1">
              Use these placeholders in your templates. They will be replaced with actual values when sending:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {['{patientName}', '{hospitalName}', '{appointmentDate}', '{appointmentTime}', '{doctorName}', '{receiptNumber}', '{amount}', '{hospitalPhone}', '{testName}'].map(v => (
                <button
                  key={v}
                  onClick={() => copyToClipboard(v)}
                  className="px-2 py-1 bg-white border border-blue-300 rounded text-xs text-blue-800 hover:bg-blue-100"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Default Templates (if no custom ones) */}
      {templates.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            No custom templates found. Click "Initialize Defaults" to create standard templates, or create a new one.
          </p>
        </div>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(templates.length > 0 ? templates : defaultTemplates.map((t, i) => ({ ...t, id: `default-${i}`, facilityId }))).map((template) => (
          <div
            key={template.id || template.type}
            className="bg-white rounded-lg border p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{template.name}</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize">
                  {template.type.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${template.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                <button
                  onClick={() => setEditingTemplate(template as SmsTemplate)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Edit2 className="w-4 h-4 text-gray-500" />
                </button>
                {template.id && !template.id.startsWith('default-') && (
                  <button
                    onClick={() => deleteMutation.mutate(template.id)}
                    className="p-1 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">SMS:</span>
              </div>
              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded line-clamp-2">
                {template.smsTemplate}
              </p>
            </div>

            {template.whatsappTemplate && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MessageSquare className="w-4 h-4 text-green-500" />
                  <span className="text-gray-500">WhatsApp:</span>
                </div>
                <p className="text-sm text-gray-600 bg-green-50 p-2 rounded line-clamp-2 whitespace-pre-line">
                  {template.whatsappTemplate}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {isCreating ? 'Create Template' : 'Edit Template'}
              </h2>
              <button
                onClick={() => { setEditingTemplate(null); setIsCreating(false); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                  <input
                    type="text"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Appointment Reminder"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={editingTemplate.type}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="appointment">Appointment Reminder</option>
                    <option value="follow_up">Follow-up Reminder</option>
                    <option value="lab_result">Lab Results Ready</option>
                    <option value="prescription_ready">Prescription Ready</option>
                    <option value="thank_you">Thank You Message</option>
                    <option value="payment_reminder">Payment Reminder</option>
                    <option value="discharge">Discharge Instructions</option>
                    <option value="birthday">Birthday Wishes</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  SMS Template (160 chars recommended)
                </label>
                <textarea
                  value={editingTemplate.smsTemplate}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, smsTemplate: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Dear {patientName}..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editingTemplate.smsTemplate.length} characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MessageSquare className="w-4 h-4 inline mr-1 text-green-500" />
                  WhatsApp Template (supports formatting)
                </label>
                <textarea
                  value={editingTemplate.whatsappTemplate || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, whatsappTemplate: e.target.value })}
                  rows={5}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Use *bold*, _italic_, and emojis 📅"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email Subject
                </label>
                <input
                  type="text"
                  value={editingTemplate.emailSubject || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, emailSubject: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Appointment Reminder - {hospitalName}"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email Template (HTML)
                </label>
                <textarea
                  value={editingTemplate.emailTemplate || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, emailTemplate: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  placeholder="<h2>Hello {patientName}</h2>..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingTemplate.isActive}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <label className="text-sm text-gray-700">Template is active</label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => { setEditingTemplate(null); setIsCreating(false); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate(editingTemplate)}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
