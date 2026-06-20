import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import api from '../../services/api';
import ConfirmDialog from '../../components/ConfirmDialog';
import SystemPagination from '../../components/SystemPagination';
import {
  Plus,
  Search,
  Loader2,
  Shield,
  MoreVertical,
  UserCheck,
  UserX,
  Pencil,
  Trash2,
  X,
  Eye,
  EyeOff,
  KeyRound,
  Copy,
  Check,
} from 'lucide-react';

interface SystemUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  status: string;
  isSystemAdmin: boolean;
  createdAt: string;
}

interface UserFormData {
  username: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must contain a lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain a number';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain a special character';
  return null;
}

export default function SystemUsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [resetPasswordModal, setResetPasswordModal] = useState<SystemUser | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/users/system-admins', {
        params: { search: debouncedSearch || undefined, page, limit: pageSize },
      });
      const data = res.data;
      if (Array.isArray(data)) {
        setUsers(data);
        setTotal(data.length);
      } else {
        setUsers(data?.data || []);
        setTotal(data?.total ?? data?.data?.length ?? 0);
      }
    } catch (err) {
      toast.error('Failed to load system users');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, pageSize]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleActivate = async (userId: string) => {
    try {
      await api.post(`/users/${userId}/activate`);
      toast.success('User activated');
      loadUsers();
    } catch {
      toast.error('Failed to activate user');
    }
    setActionMenuId(null);
  };

  const handleDeactivate = async (userId: string) => {
    try {
      await api.post(`/users/${userId}/deactivate`);
      toast.success('User deactivated');
      loadUsers();
    } catch {
      toast.error('Failed to deactivate user');
    }
    setActionMenuId(null);
  };

  const handleDeleteConfirmed = async (userId: string) => {
    try {
      await api.delete(`/users/${userId}`);
      toast.success('User deleted');
      loadUsers();
    } catch {
      toast.error('Failed to delete user');
    }
    setActionMenuId(null);
  };

  const handleDelete = (userId: string) => {
    setConfirmState({
      open: true,
      title: 'Delete User?',
      message: 'Are you sure you want to delete this system admin user? This action cannot be undone.',
      variant: 'danger',
      onConfirm: () => {
        setConfirmState((s) => ({ ...s, open: false }));
        handleDeleteConfirmed(userId);
      },
    });
    setActionMenuId(null);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Users</h1>
          <p className="text-gray-500 mt-1">Manage platform administrator accounts</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add System Admin
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, username, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No system admin users found</p>
            <p className="text-gray-400 text-sm mt-1">Create a system admin to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Username
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-sm font-bold text-slate-600 uppercase">
                        {user.fullName?.[0] || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{user.fullName}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 font-mono">{user.username}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right relative">
                    <button
                      onClick={() => setActionMenuId(actionMenuId === user.id ? null : user.id)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-500" />
                    </button>
                    {actionMenuId === user.id && (
                      <div className="absolute right-6 top-12 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 min-w-[160px]">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setActionMenuId(null);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setResetPasswordModal(user);
                            setActionMenuId(null);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                        >
                          <KeyRound className="w-4 h-4" />
                          Reset Password
                        </button>
                        {user.status === 'active' ? (
                          <button
                            onClick={() => handleDeactivate(user.id)}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-amber-600 hover:bg-amber-50"
                          >
                            <UserX className="w-4 h-4" />
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(user.id)}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                          >
                            <UserCheck className="w-4 h-4" />
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <SystemPagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />

      {/* Create/Edit Modal */}
      {(showCreateModal || editingUser) && (
        <UserModal
          user={editingUser}
          onClose={() => {
            setShowCreateModal(false);
            setEditingUser(null);
          }}
          onSaved={() => {
            setShowCreateModal(false);
            setEditingUser(null);
            loadUsers();
          }}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordModal && (
        <ResetPasswordModal
          user={resetPasswordModal}
          onClose={() => setResetPasswordModal(null)}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        {...confirmState}
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
        confirmLabel="Delete"
      />
    </div>
  );
}

function UserModal({
  user,
  onClose,
  onSaved,
}: {
  user: SystemUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!user;
  const [formData, setFormData] = useState<UserFormData>({
    username: user?.username || '',
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isEditing) {
        const updatePayload: Record<string, string> = {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
        };
        if (formData.password) {
          const pwError = validatePassword(formData.password);
          if (pwError) {
            setError(pwError);
            setSaving(false);
            return;
          }
          updatePayload.password = formData.password;
        }
        await api.patch(`/users/${user!.id}`, updatePayload);
        toast.success('User updated successfully');
      } else {
        if (!formData.password) {
          setError('Password is required');
          setSaving(false);
          return;
        }
        const pwError = validatePassword(formData.password);
        if (pwError) {
          setError(pwError);
          setSaving(false);
          return;
        }
        await api.post('/users', {
          ...formData,
          isSystemAdmin: true,
        });
        toast.success('System admin created successfully');
      }
      onSaved();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Operation failed';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit System Admin' : 'New System Admin'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
              <input
                type="text"
                required
                disabled={isEditing}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="jdoe"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="jdoe@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+256700000000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password {isEditing ? '(leave blank to keep current)' : '*'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required={!isEditing}
                minLength={8}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={isEditing ? '••••••••' : 'Min 8 characters'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <Shield className="w-4 h-4 text-slate-600" />
            <span className="text-sm text-slate-600">This user will have full system administrator privileges</span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-xl hover:bg-slate-900 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: SystemUser;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<{ temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetting(true);
    try {
      const res = await api.post(`/users/system-reset-password/${user.id}`, {
        newPassword: newPassword || undefined,
      });
      const data = res.data?.data || res.data;
      setResult(data);
      toast.success('Password reset successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const copyPassword = () => {
    if (result?.temporaryPassword) {
      navigator.clipboard.writeText(result.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-sm font-bold text-slate-600 uppercase">
              {user.fullName?.[0] || '?'}
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{user.fullName}</p>
              <p className="text-xs text-gray-500">@{user.username}</p>
            </div>
          </div>

          {result ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 font-medium mb-2">Password reset successfully!</p>
                <p className="text-xs text-green-700 mb-3">The user will be required to change this password on next login.</p>
                <div className="flex items-center gap-2 bg-white rounded-lg p-3 border border-green-200">
                  <code className="flex-1 text-sm font-mono text-gray-900">{result.temporaryPassword}</code>
                  <button onClick={copyPassword} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button onClick={onClose} className="w-full py-2.5 text-sm font-medium bg-slate-800 text-white rounded-xl hover:bg-slate-900">
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password <span className="text-gray-400 text-xs">(leave blank to auto-generate)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Auto-generate if blank"
                    minLength={newPassword ? 8 : 0}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <KeyRound className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">User will be forced to change password on next login.</p>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {resetting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Reset Password
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
