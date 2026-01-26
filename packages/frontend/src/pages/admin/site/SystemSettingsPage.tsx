import { useState } from 'react';
import {
  Settings,
  Globe,
  Calendar,
  Hash,
  Mail,
  MessageSquare,
  Database,
  Save,
  Clock,
  Languages,
  Bell,
  Shield,
  HardDrive,
  RefreshCw,
} from 'lucide-react';

interface SettingSection {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const settingSections: SettingSection[] = [
  { id: 'general', title: 'General', icon: <Settings className="w-5 h-5" /> },
  { id: 'datetime', title: 'Date & Time', icon: <Calendar className="w-5 h-5" /> },
  { id: 'locale', title: 'Language & Region', icon: <Languages className="w-5 h-5" /> },
  { id: 'email', title: 'Email Settings', icon: <Mail className="w-5 h-5" /> },
  { id: 'sms', title: 'SMS Settings', icon: <MessageSquare className="w-5 h-5" /> },
  { id: 'notifications', title: 'Notifications', icon: <Bell className="w-5 h-5" /> },
  { id: 'backup', title: 'Backup & Recovery', icon: <Database className="w-5 h-5" /> },
  { id: 'security', title: 'Security', icon: <Shield className="w-5 h-5" /> },
];

const mockSettings = {
  general: {
    systemName: 'Glide HIMS',
    defaultCurrency: 'KES',
    fiscalYearStart: '01',
    patientIdPrefix: 'PAT',
    invoicePrefix: 'INV',
    receiptPrefix: 'RCP',
    sessionTimeout: 30,
    maxLoginAttempts: 5,
  },
  datetime: {
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    timezone: 'Africa/Nairobi',
    firstDayOfWeek: 'Monday',
  },
  locale: {
    primaryLanguage: 'en',
    secondaryLanguage: 'sw',
    numberFormat: '1,234.56',
    currencyPosition: 'before',
  },
  email: {
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUsername: 'noreply@glidehospital.com',
    useTLS: true,
    fromName: 'Glide Hospital',
    fromEmail: 'noreply@glidehospital.com',
  },
  sms: {
    provider: 'AfricasTalking',
    apiKey: '••••••••••••••••',
    senderId: 'GLIDE',
    enabled: true,
  },
  notifications: {
    appointmentReminders: true,
    labResultsReady: true,
    paymentReceipts: true,
    prescriptionReady: true,
    reminderHoursBefore: 24,
  },
  backup: {
    autoBackup: true,
    backupFrequency: 'daily',
    backupTime: '02:00',
    retentionDays: 30,
    backupLocation: '/backups/hims',
    lastBackup: '2024-01-25 02:00:15',
    lastBackupSize: '2.4 GB',
  },
  security: {
    passwordMinLength: 8,
    requireSpecialChar: true,
    requireNumber: true,
    passwordExpiryDays: 90,
    twoFactorAuth: true,
    ipWhitelist: false,
  },
};

export default function SystemSettingsPage() {
  const [activeSection, setActiveSection] = useState('general');
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = () => {
    setHasChanges(true);
  };

  const handleSave = () => {
    setHasChanges(false);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600">Configure system preferences and options</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            hasChanges
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Sidebar */}
        <div className="flex-shrink-0 w-56">
          <nav className="space-y-1">
            {settingSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {section.icon}
                {section.title}
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {activeSection === 'general' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      System Name
                    </label>
                    <input
                      type="text"
                      defaultValue={mockSettings.general.systemName}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Currency
                    </label>
                    <select
                      defaultValue={mockSettings.general.defaultCurrency}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="KES">KES - Kenyan Shilling</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Patient ID Prefix
                    </label>
                    <input
                      type="text"
                      defaultValue={mockSettings.general.patientIdPrefix}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice Prefix
                    </label>
                    <input
                      type="text"
                      defaultValue={mockSettings.general.invoicePrefix}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      defaultValue={mockSettings.general.sessionTimeout}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Login Attempts
                    </label>
                    <input
                      type="number"
                      defaultValue={mockSettings.general.maxLoginAttempts}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'datetime' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Date & Time Settings</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date Format
                    </label>
                    <select
                      defaultValue={mockSettings.datetime.dateFormat}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY (25/01/2024)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (01/25/2024)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (2024-01-25)</option>
                      <option value="DD-MMM-YYYY">DD-MMM-YYYY (25-Jan-2024)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time Format
                    </label>
                    <select
                      defaultValue={mockSettings.datetime.timeFormat}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="24h">24-hour (14:30)</option>
                      <option value="12h">12-hour (2:30 PM)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Timezone
                    </label>
                    <select
                      defaultValue={mockSettings.datetime.timezone}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="Africa/Nairobi">Africa/Nairobi (EAT, UTC+3)</option>
                      <option value="Africa/Lagos">Africa/Lagos (WAT, UTC+1)</option>
                      <option value="Europe/London">Europe/London (GMT, UTC+0)</option>
                      <option value="America/New_York">America/New_York (EST, UTC-5)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Day of Week
                    </label>
                    <select
                      defaultValue={mockSettings.datetime.firstDayOfWeek}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="Monday">Monday</option>
                      <option value="Sunday">Sunday</option>
                      <option value="Saturday">Saturday</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'locale' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Language & Region</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Language
                    </label>
                    <select
                      defaultValue={mockSettings.locale.primaryLanguage}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="en">English</option>
                      <option value="sw">Swahili</option>
                      <option value="fr">French</option>
                      <option value="ar">Arabic</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Secondary Language
                    </label>
                    <select
                      defaultValue={mockSettings.locale.secondaryLanguage}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="sw">Swahili</option>
                      <option value="en">English</option>
                      <option value="fr">French</option>
                      <option value="ar">Arabic</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number Format
                    </label>
                    <select
                      defaultValue={mockSettings.locale.numberFormat}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="1,234.56">1,234.56</option>
                      <option value="1.234,56">1.234,56</option>
                      <option value="1 234,56">1 234,56</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency Symbol Position
                    </label>
                    <select
                      defaultValue={mockSettings.locale.currencyPosition}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="before">Before (KES 1,000)</option>
                      <option value="after">After (1,000 KES)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'email' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Email Settings</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      defaultValue={mockSettings.email.smtpHost}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Port
                    </label>
                    <input
                      type="number"
                      defaultValue={mockSettings.email.smtpPort}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Username
                    </label>
                    <input
                      type="text"
                      defaultValue={mockSettings.email.smtpUsername}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Password
                    </label>
                    <input
                      type="password"
                      defaultValue="••••••••"
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From Name
                    </label>
                    <input
                      type="text"
                      defaultValue={mockSettings.email.fromName}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From Email
                    </label>
                    <input
                      type="email"
                      defaultValue={mockSettings.email.fromEmail}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        defaultChecked={mockSettings.email.useTLS}
                        onChange={handleChange}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Use TLS/SSL encryption</span>
                    </label>
                  </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Mail className="w-4 h-4" />
                  Send Test Email
                </button>
              </div>
            )}

            {activeSection === 'sms' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">SMS Settings</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMS Provider
                    </label>
                    <select
                      defaultValue={mockSettings.sms.provider}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="AfricasTalking">Africa's Talking</option>
                      <option value="Twilio">Twilio</option>
                      <option value="Nexmo">Vonage (Nexmo)</option>
                      <option value="InfoBip">InfoBip</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sender ID
                    </label>
                    <input
                      type="text"
                      defaultValue={mockSettings.sms.senderId}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      defaultValue={mockSettings.sms.apiKey}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 h-full pt-6">
                      <input
                        type="checkbox"
                        defaultChecked={mockSettings.sms.enabled}
                        onChange={handleChange}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Enable SMS notifications</span>
                    </label>
                  </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <MessageSquare className="w-4 h-4" />
                  Send Test SMS
                </button>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Notification Settings</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Appointment Reminders</p>
                      <p className="text-sm text-gray-500">Send reminders before appointments</p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked={mockSettings.notifications.appointmentReminders}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Lab Results Ready</p>
                      <p className="text-sm text-gray-500">Notify when lab results are available</p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked={mockSettings.notifications.labResultsReady}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Payment Receipts</p>
                      <p className="text-sm text-gray-500">Send receipts after payments</p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked={mockSettings.notifications.paymentReceipts}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Prescription Ready</p>
                      <p className="text-sm text-gray-500">Notify when prescription is ready</p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked={mockSettings.notifications.prescriptionReady}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reminder Hours Before Appointment
                  </label>
                  <input
                    type="number"
                    defaultValue={mockSettings.notifications.reminderHoursBefore}
                    onChange={handleChange}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {activeSection === 'backup' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Backup & Recovery</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 mb-4">
                      <input
                        type="checkbox"
                        defaultChecked={mockSettings.backup.autoBackup}
                        onChange={handleChange}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Enable Automatic Backups</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Backup Frequency
                    </label>
                    <select
                      defaultValue={mockSettings.backup.backupFrequency}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Backup Time
                    </label>
                    <input
                      type="time"
                      defaultValue={mockSettings.backup.backupTime}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Retention Period (days)
                    </label>
                    <input
                      type="number"
                      defaultValue={mockSettings.backup.retentionDays}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Backup Location
                    </label>
                    <input
                      type="text"
                      defaultValue={mockSettings.backup.backupLocation}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <HardDrive className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">Last Backup</p>
                        <p className="text-sm text-gray-500">{mockSettings.backup.lastBackup}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{mockSettings.backup.lastBackupSize}</p>
                      <p className="text-sm text-gray-500">Backup Size</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Database className="w-4 h-4" />
                    Backup Now
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <RefreshCw className="w-4 h-4" />
                    Restore from Backup
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Security Settings</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Password Length
                    </label>
                    <input
                      type="number"
                      defaultValue={mockSettings.security.passwordMinLength}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password Expiry (days)
                    </label>
                    <input
                      type="number"
                      defaultValue={mockSettings.security.passwordExpiryDays}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked={mockSettings.security.requireSpecialChar}
                      onChange={handleChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Require special character in password</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked={mockSettings.security.requireNumber}
                      onChange={handleChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Require number in password</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked={mockSettings.security.twoFactorAuth}
                      onChange={handleChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Enable Two-Factor Authentication</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked={mockSettings.security.ipWhitelist}
                      onChange={handleChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Enable IP Whitelist</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
