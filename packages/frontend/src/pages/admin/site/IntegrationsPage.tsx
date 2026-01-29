import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plug,
  Plus,
  Search,
  Settings,
  XCircle,
  AlertCircle,
  Key,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  ExternalLink,
  FlaskConical,
  CreditCard,
  Shield,
  FileText,
  Wifi,
  WifiOff,
  MoreVertical,
  Edit2,
  Trash2,
  TestTube,
  Loader2,
  Info,
} from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  category: 'lab' | 'insurance' | 'payment' | 'government' | 'other';
  description: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSync?: string;
  apiEndpoint?: string;
  logo?: string;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string;
  status: 'active' | 'revoked';
  permissions: string[];
}

const defaultIntegrations: Integration[] = [
  {
    id: '1',
    name: 'Roche Cobas 6000',
    category: 'lab',
    description: 'Automated chemistry and immunoassay analyzer',
    status: 'connected',
    lastSync: '2024-01-25 10:30:15',
    apiEndpoint: 'hl7://192.168.1.100:2575',
  },
  {
    id: '2',
    name: 'Sysmex XN-1000',
    category: 'lab',
    description: 'Hematology analyzer for complete blood count',
    status: 'connected',
    lastSync: '2024-01-25 10:28:45',
    apiEndpoint: 'hl7://192.168.1.101:2575',
  },
  {
    id: '3',
    name: 'GeneXpert MTB/RIF',
    category: 'lab',
    description: 'Molecular diagnostics for TB detection',
    status: 'error',
    lastSync: '2024-01-24 15:22:00',
    apiEndpoint: 'hl7://192.168.1.102:2575',
  },
  {
    id: '4',
    name: 'NHIF Portal',
    category: 'government',
    description: 'National Hospital Insurance Fund claims portal',
    status: 'connected',
    lastSync: '2024-01-25 09:00:00',
    apiEndpoint: 'https://api.nhif.or.ke/v1',
  },
  {
    id: '5',
    name: 'SHA Portal',
    category: 'government',
    description: 'Social Health Authority integration',
    status: 'pending',
    apiEndpoint: 'https://api.sha.go.ke/v1',
  },
  {
    id: '6',
    name: 'AAR Insurance',
    category: 'insurance',
    description: 'AAR Healthcare claims and verification',
    status: 'connected',
    lastSync: '2024-01-25 08:45:00',
    apiEndpoint: 'https://api.aar.co.ke/claims',
  },
  {
    id: '7',
    name: 'Jubilee Insurance',
    category: 'insurance',
    description: 'Jubilee Health Insurance integration',
    status: 'connected',
    lastSync: '2024-01-25 08:30:00',
    apiEndpoint: 'https://api.jubileekenya.com/health',
  },
  {
    id: '8',
    name: 'M-Pesa',
    category: 'payment',
    description: 'Safaricom M-Pesa payment gateway',
    status: 'connected',
    lastSync: '2024-01-25 10:32:00',
    apiEndpoint: 'https://api.safaricom.co.ke/mpesa',
  },
  {
    id: '9',
    name: 'Pesapal',
    category: 'payment',
    description: 'Card and mobile money payments',
    status: 'connected',
    lastSync: '2024-01-25 10:25:00',
    apiEndpoint: 'https://pay.pesapal.com/v3',
  },
  {
    id: '10',
    name: 'Equity Bank',
    category: 'payment',
    description: 'Bank payment integration',
    status: 'disconnected',
    apiEndpoint: 'https://api.equitybankgroup.com/v2',
  },
];

const defaultApiKeys: ApiKey[] = [
  {
    id: '1',
    name: 'Mobile App API',
    key: 'glide_live_sk_xxxxxxxxxxxxxxxxxxxx1234',
    createdAt: '2024-01-10',
    lastUsed: '2024-01-25 10:30:00',
    status: 'active',
    permissions: ['patients:read', 'appointments:read', 'appointments:write'],
  },
  {
    id: '2',
    name: 'Lab Interface',
    key: 'glide_live_sk_xxxxxxxxxxxxxxxxxxxx5678',
    createdAt: '2023-12-15',
    lastUsed: '2024-01-25 10:28:00',
    status: 'active',
    permissions: ['lab:read', 'lab:write', 'patients:read'],
  },
  {
    id: '3',
    name: 'Old Integration (Deprecated)',
    key: 'glide_live_sk_xxxxxxxxxxxxxxxxxxxx9012',
    createdAt: '2023-06-01',
    lastUsed: '2023-11-15 14:20:00',
    status: 'revoked',
    permissions: ['*:read'],
  },
];

const STORAGE_KEYS = {
  INTEGRATIONS: 'glide_integrations',
  API_KEYS: 'glide_api_keys',
};

const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (error) {
    console.error(`Failed to load ${key} from localStorage:`, error);
  }
  return defaultValue;
};

const saveToStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save ${key} to localStorage:`, error);
  }
};

const categoryIcons: Record<string, React.ReactNode> = {
  lab: <FlaskConical className="w-5 h-5" />,
  insurance: <Shield className="w-5 h-5" />,
  payment: <CreditCard className="w-5 h-5" />,
  government: <FileText className="w-5 h-5" />,
  other: <Plug className="w-5 h-5" />,
};

const categoryLabels: Record<string, string> = {
  lab: 'Lab Equipment',
  insurance: 'Insurance Portals',
  payment: 'Payment Gateways',
  government: 'Government Portals',
  other: 'Other',
};

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'integrations' | 'apikeys'>('integrations');
  const [showApiKey, setShowApiKey] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load integrations from localStorage
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  useEffect(() => {
    // Simulate loading state for better UX
    const timer = setTimeout(() => {
      setIntegrations(loadFromStorage(STORAGE_KEYS.INTEGRATIONS, defaultIntegrations));
      setApiKeys(loadFromStorage(STORAGE_KEYS.API_KEYS, defaultApiKeys));
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (!isLoading && integrations.length > 0) {
      saveToStorage(STORAGE_KEYS.INTEGRATIONS, integrations);
    }
  }, [integrations, isLoading]);

  useEffect(() => {
    if (!isLoading && apiKeys.length > 0) {
      saveToStorage(STORAGE_KEYS.API_KEYS, apiKeys);
    }
  }, [apiKeys, isLoading]);

  const updateIntegration = useCallback((id: string, updates: Partial<Integration>) => {
    setIntegrations(prev => 
      prev.map(integration => 
        integration.id === id ? { ...integration, ...updates } : integration
      )
    );
  }, []);

  const removeIntegration = useCallback((id: string) => {
    setIntegrations(prev => prev.filter(integration => integration.id !== id));
  }, []);

  const updateApiKey = useCallback((id: string, updates: Partial<ApiKey>) => {
    setApiKeys(prev => 
      prev.map(key => 
        key.id === id ? { ...key, ...updates } : key
      )
    );
  }, []);

  const filteredIntegrations = useMemo(() => {
    return integrations.filter((integration) => {
      const matchesSearch =
        integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        integration.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || integration.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, categoryFilter, integrations]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-gray-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <RefreshCw className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'disconnected':
        return 'bg-gray-100 text-gray-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'revoked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleShowKey = (id: string) => {
    const newSet = new Set(showApiKey);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setShowApiKey(newSet);
  };

  const stats = useMemo(() => {
    return {
      total: integrations.length,
      connected: integrations.filter((i) => i.status === 'connected').length,
      errors: integrations.filter((i) => i.status === 'error').length,
      activeKeys: apiKeys.filter((k) => k.status === 'active').length,
    };
  }, [integrations, apiKeys]);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-500">Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Local Storage Banner */}
      <div className="flex-shrink-0 bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Integration settings are stored locally</h4>
            <p className="text-sm text-blue-700 mt-1">
              Changes to integration configurations are saved in your browser's local storage. 
              Backend API integration will be available in a future update.
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600">Manage third-party integrations and API access</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Add Integration
        </button>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Integrations</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Connected</p>
          <p className="text-2xl font-bold text-green-600">{stats.connected}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Errors</p>
          <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Active API Keys</p>
          <p className="text-2xl font-bold text-gray-900">{stats.activeKeys}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('integrations')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'integrations'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Integrations
          </button>
          <button
            onClick={() => setActiveTab('apikeys')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'apikeys'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            API Keys
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'integrations' && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search integrations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="lab">Lab Equipment</option>
                <option value="insurance">Insurance Portals</option>
                <option value="payment">Payment Gateways</option>
                <option value="government">Government Portals</option>
              </select>
            </div>

            {/* Integration Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredIntegrations.map((integration) => (
                <div
                  key={integration.id}
                  className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                        {categoryIcons[integration.category]}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                        <p className="text-xs text-gray-500">{categoryLabels[integration.category]}</p>
                      </div>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowMenu(showMenu === integration.id ? null : integration.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                      {showMenu === integration.id && (
                        <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <Settings className="w-4 h-4" /> Configure
                          </button>
                          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <TestTube className="w-4 h-4" /> Test Connection
                          </button>
                          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <RefreshCw className="w-4 h-4" /> Sync Now
                          </button>
                          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" /> Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">{integration.description}</p>

                  {integration.apiEndpoint && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 font-mono bg-gray-50 p-2 rounded">
                      <ExternalLink className="w-3 h-3" />
                      <span className="truncate">{integration.apiEndpoint}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(integration.status)}
                      <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${getStatusColor(integration.status)}`}>
                        {integration.status}
                      </span>
                    </div>
                    {integration.lastSync && (
                      <span className="text-xs text-gray-400">
                        Last sync: {integration.lastSync.split(' ')[1]}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'apikeys' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Manage API keys for external system access
              </p>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />
                Generate New Key
              </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      API Key
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Permissions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Last Used
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {apiKeys.map((apiKey) => (
                    <tr key={apiKey.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Key className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{apiKey.name}</p>
                            <p className="text-xs text-gray-500">Created {apiKey.createdAt}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                            {showApiKey.has(apiKey.id)
                              ? apiKey.key
                              : apiKey.key.substring(0, 20) + '••••••••••••'}
                          </code>
                          <button
                            onClick={() => toggleShowKey(apiKey.id)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {showApiKey.has(apiKey.id) ? (
                              <EyeOff className="w-4 h-4 text-gray-400" />
                            ) : (
                              <Eye className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <Copy className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {apiKey.permissions.slice(0, 2).map((perm) => (
                            <span
                              key={perm}
                              className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded"
                            >
                              {perm}
                            </span>
                          ))}
                          {apiKey.permissions.length > 2 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              +{apiKey.permissions.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {apiKey.lastUsed}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusColor(apiKey.status)}`}>
                          {apiKey.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <Edit2 className="w-4 h-4 text-gray-400" />
                          </button>
                          {apiKey.status === 'active' && (
                            <button className="p-1 hover:bg-red-100 rounded">
                              <XCircle className="w-4 h-4 text-red-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">API Key Security</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Keep your API keys secure. Never share them publicly or commit them to version control.
                    Rotate keys regularly and revoke any that may have been compromised.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
