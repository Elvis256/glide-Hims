import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Mail,
  MessageSquare,
  Loader2,
  Save,
  TestTube,
  CheckCircle,
  Server,
} from 'lucide-react';
import { toast } from 'sonner';
import { notificationsService, type NotificationConfig, type NotificationType, type NotificationProvider } from '../../services/chronic-care';
import { useFacilityId } from '../../lib/facility';

const providers: { value: NotificationProvider; label: string; description: string }[] = [
  { value: 'smtp', label: 'SMTP', description: 'Standard email server' },
  { value: 'africas_talking', label: "Africa's Talking", description: 'Popular African SMS gateway' },
  { value: 'twilio', label: 'Twilio', description: 'Global SMS & Voice platform' },
  { value: 'custom', label: 'Custom API', description: 'Your own SMS API endpoint' },
];

export default function NotificationSettingsPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email');
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  
  const [emailConfig, setEmailConfig] = useState<Partial<NotificationConfig>>({
    type: 'email',
    isEnabled: false,
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: true,
    smtpUser: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: 'HIMS Notifications',
  });

  const [smsConfig, setSmsConfig] = useState<Partial<NotificationConfig>>({
    type: 'sms',
    provider: 'africas_talking',
    isEnabled: false,
    smsApiUrl: '',
    smsApiKey: '',
    smsApiSecret: '',
    smsSenderId: '',
    smsUsername: '',
  });

  // Fetch existing configs
  const { data: configs = [], isLoading } = useQuery<NotificationConfig[]>({
    queryKey: ['notification-configs', facilityId],
    queryFn: () => notificationsService.getConfig(facilityId),
    enabled: !!facilityId,
  });

  // Update state when configs load
  useEffect(() => {
    if (configs && configs.length > 0) {
      const email = configs.find((c: NotificationConfig) => c.type === 'email');
      const sms = configs.find((c: NotificationConfig) => c.type === 'sms');
      if (email) setEmailConfig((prev) => ({ ...prev, ...email }));
      if (sms) setSmsConfig((prev) => ({ ...prev, ...sms }));
    }
  }, [configs]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (config: Partial<NotificationConfig>) => 
      notificationsService.saveConfig({ ...config, facilityId }),
    onSuccess: () => {
      toast.success('Configuration saved successfully');
      queryClient.invalidateQueries({ queryKey: ['notification-configs'] });
    },
    onError: () => toast.error('Failed to save configuration'),
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: ({ type, email, phone }: { type: NotificationType; email?: string; phone?: string }) =>
      notificationsService.testConfig(facilityId, type, email, phone),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Test notification sent successfully!');
      } else {
        toast.error(`Test failed: ${result.message}`);
      }
      queryClient.invalidateQueries({ queryKey: ['notification-configs'] });
    },
    onError: () => toast.error('Test failed'),
  });

  const handleSaveEmail = () => {
    saveMutation.mutate(emailConfig);
  };

  const handleSaveSms = () => {
    saveMutation.mutate(smsConfig);
  };

  const handleTestEmail = () => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }
    testMutation.mutate({ type: 'email', email: testEmail });
  };

  const handleTestSms = () => {
    if (!testPhone) {
      toast.error('Please enter a test phone number');
      return;
    }
    testMutation.mutate({ type: 'sms', phone: testPhone });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  const emailConfigData = configs.find((c: NotificationConfig) => c.type === 'email');
  const smsConfigData = configs.find((c: NotificationConfig) => c.type === 'sms');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-100 rounded-lg">
          <Settings className="w-6 h-6 text-gray-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notification Settings</h1>
          <p className="text-sm text-gray-500">Configure Email and SMS notifications for patient reminders</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'email'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Mail className="w-4 h-4" />
          Email Configuration
          {emailConfigData?.isEnabled && <CheckCircle className="w-4 h-4 text-green-500" />}
        </button>
        <button
          onClick={() => setActiveTab('sms')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'sms'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          SMS Configuration
          {smsConfigData?.isEnabled && <CheckCircle className="w-4 h-4 text-green-500" />}
        </button>
      </div>

      {/* Email Configuration */}
      {activeTab === 'email' && (
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-gray-500" />
              <div>
                <h3 className="font-semibold">SMTP Email Settings</h3>
                <p className="text-sm text-gray-500">Configure your email server for sending notifications</p>
              </div>
            </div>
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Enable Email</span>
              <input
                type="checkbox"
                checked={emailConfig.isEnabled}
                onChange={(e) => setEmailConfig({ ...emailConfig, isEnabled: e.target.checked })}
                className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
              <input
                type="text"
                value={emailConfig.smtpHost || ''}
                onChange={(e) => setEmailConfig({ ...emailConfig, smtpHost: e.target.value })}
                placeholder="smtp.gmail.com"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
              <input
                type="number"
                value={emailConfig.smtpPort || 587}
                onChange={(e) => setEmailConfig({ ...emailConfig, smtpPort: parseInt(e.target.value) })}
                placeholder="587"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Username</label>
              <input
                type="text"
                value={emailConfig.smtpUser || ''}
                onChange={(e) => setEmailConfig({ ...emailConfig, smtpUser: e.target.value })}
                placeholder="your@email.com"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Password</label>
              <input
                type="password"
                value={emailConfig.smtpPassword || ''}
                onChange={(e) => setEmailConfig({ ...emailConfig, smtpPassword: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
              <input
                type="email"
                value={emailConfig.fromEmail || ''}
                onChange={(e) => setEmailConfig({ ...emailConfig, fromEmail: e.target.value })}
                placeholder="noreply@hospital.com"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
              <input
                type="text"
                value={emailConfig.fromName || ''}
                onChange={(e) => setEmailConfig({ ...emailConfig, fromName: e.target.value })}
                placeholder="Hospital Notifications"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={emailConfig.smtpSecure}
                onChange={(e) => setEmailConfig({ ...emailConfig, smtpSecure: e.target.checked })}
                className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
              />
              <label className="text-sm text-gray-700">Use SSL/TLS</label>
            </div>
          </div>

          {/* Test Section */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Test Email Configuration</h4>
            <div className="flex gap-3">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
              />
              <button
                onClick={handleTestEmail}
                disabled={testMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                Send Test
              </button>
            </div>
            {emailConfigData?.lastTestedAt && (
              <p className={`text-sm mt-2 ${emailConfigData.testSuccessful ? 'text-green-600' : 'text-red-600'}`}>
                Last tested: {new Date(emailConfigData.lastTestedAt).toLocaleString()} - 
                {emailConfigData.testSuccessful ? ' Success' : ' Failed'}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveEmail}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Email Settings
            </button>
          </div>
        </div>
      )}

      {/* SMS Configuration */}
      {activeTab === 'sms' && (
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-gray-500" />
              <div>
                <h3 className="font-semibold">SMS Gateway Settings</h3>
                <p className="text-sm text-gray-500">Configure your SMS provider for sending text messages</p>
              </div>
            </div>
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Enable SMS</span>
              <input
                type="checkbox"
                checked={smsConfig.isEnabled}
                onChange={(e) => setSmsConfig({ ...smsConfig, isEnabled: e.target.checked })}
                className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
              />
            </label>
          </div>

          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">SMS Provider</label>
            <div className="grid grid-cols-2 gap-3">
              {providers.map((provider) => (
                <button
                  key={provider.value}
                  onClick={() => setSmsConfig({ ...smsConfig, provider: provider.value })}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    smsConfig.provider === provider.value
                      ? 'border-rose-500 bg-rose-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium">{provider.label}</p>
                  <p className="text-sm text-gray-500">{provider.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Provider-specific fields */}
          <div className="grid grid-cols-2 gap-4">
            {smsConfig.provider === 'africas_talking' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={smsConfig.smsUsername || ''}
                    onChange={(e) => setSmsConfig({ ...smsConfig, smsUsername: e.target.value })}
                    placeholder="sandbox"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input
                    type="password"
                    value={smsConfig.smsApiKey || ''}
                    onChange={(e) => setSmsConfig({ ...smsConfig, smsApiKey: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </>
            )}

            {smsConfig.provider === 'twilio' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account SID</label>
                  <input
                    type="text"
                    value={smsConfig.smsUsername || ''}
                    onChange={(e) => setSmsConfig({ ...smsConfig, smsUsername: e.target.value })}
                    placeholder="ACxxxxxxxx"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auth Token</label>
                  <input
                    type="password"
                    value={smsConfig.smsApiKey || ''}
                    onChange={(e) => setSmsConfig({ ...smsConfig, smsApiKey: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </>
            )}

            {smsConfig.provider === 'custom' && (
              <>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
                  <input
                    type="url"
                    value={smsConfig.smsApiUrl || ''}
                    onChange={(e) => setSmsConfig({ ...smsConfig, smsApiUrl: e.target.value })}
                    placeholder="https://api.yourprovider.com/sms"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input
                    type="password"
                    value={smsConfig.smsApiKey || ''}
                    onChange={(e) => setSmsConfig({ ...smsConfig, smsApiKey: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Secret (optional)</label>
                  <input
                    type="password"
                    value={smsConfig.smsApiSecret || ''}
                    onChange={(e) => setSmsConfig({ ...smsConfig, smsApiSecret: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sender ID</label>
              <input
                type="text"
                value={smsConfig.smsSenderId || ''}
                onChange={(e) => setSmsConfig({ ...smsConfig, smsSenderId: e.target.value })}
                placeholder="HOSPITAL"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
              />
              <p className="text-xs text-gray-500 mt-1">The name that appears as sender (max 11 chars)</p>
            </div>
          </div>

          {/* Test Section */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Test SMS Configuration</h4>
            <div className="flex gap-3">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+256700000000"
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
              />
              <button
                onClick={handleTestSms}
                disabled={testMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                Send Test
              </button>
            </div>
            {smsConfigData?.lastTestedAt && (
              <p className={`text-sm mt-2 ${smsConfigData.testSuccessful ? 'text-green-600' : 'text-red-600'}`}>
                Last tested: {new Date(smsConfigData.lastTestedAt).toLocaleString()} - 
                {smsConfigData.testSuccessful ? ' Success' : ' Failed'}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveSms}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save SMS Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
