import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '../../../services/api';
import {
  Building2,
  Users,
  Workflow,
  CalendarClock,
  Plus,
  Trash2,
  Save,
  Loader2,
  ChevronDown,
  Eye,
} from 'lucide-react';

import { Link } from 'react-router-dom';

type Tab = 'policies' | 'groups' | 'delegations';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'policies', label: 'Approval Policies', icon: Workflow },
  { id: 'groups', label: 'Approver Groups', icon: Users },
  { id: 'delegations', label: 'Delegations', icon: CalendarClock },
];

export default function OrgApprovalAdminPage() {
  const [tab, setTab] = useState<Tab>('policies');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Procurement Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">
          Define how procurement requests are routed for approval. Reporting lines, departments
          and positions are managed under HR.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          Departments, Positions and Employee reporting lines have moved to{' '}
          <Link
            to="/admin/hr/organisation"
            className="font-medium underline hover:text-blue-900"
          >
            HR &rsaquo; Organisation
          </Link>
          . Approval policies on this page reference those records.
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
                tab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'policies' && <PoliciesTab />}
      {tab === 'groups' && <GroupsTab />}
      {tab === 'delegations' && <DelegationsTab />}
    </div>
  );
}

// ----------- helpers -----------
function useUsers() {
  return useQuery({
    queryKey: ['org-admin-users'],
    queryFn: async () => {
      const res = await api.get('/users', { params: { limit: 500 } });
      return (res.data?.users || res.data?.data || res.data || []) as any[];
    },
  });
}

function userLabel(u: any) {
  if (!u) return '—';
  return (
    [u.firstName, u.lastName].filter(Boolean).join(' ') ||
    u.fullName ||
    u.name ||
    u.email ||
    u.id
  );
}

// ============== STRUCTURE TAB ==============
export function StructureTab() {
  const qc = useQueryClient();
  const usersQ = useUsers();
  const deptsQ = useQuery({
    queryKey: ['org-admin-departments'],
    queryFn: async () => (await api.get('/org-admin/departments')).data as any[],
  });
  const empsQ = useQuery({
    queryKey: ['org-admin-employees'],
    queryFn: async () => (await api.get('/org-admin/employees')).data as any[],
  });
  const positionsQ = useQuery({
    queryKey: ['org-admin-positions'],
    queryFn: async () => (await api.get('/org-admin/positions')).data as any[],
  });

  const setHead = useMutation({
    mutationFn: ({ id, headUserId }: any) =>
      api.put(`/org-admin/departments/${id}/head`, { headUserId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-admin-departments'] }),
  });
  const setParent = useMutation({
    mutationFn: ({ id, parentId }: any) =>
      api.put(`/org-admin/departments/${id}/parent`, { parentId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-admin-departments'] }),
  });
  const setMgr = useMutation({
    mutationFn: ({ id, managerId }: any) =>
      api.put(`/org-admin/employees/${id}/manager`, { managerId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-admin-employees'] }),
  });
  const setPos = useMutation({
    mutationFn: ({ id, positionId }: any) =>
      api.put(`/org-admin/employees/${id}/position`, { positionId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-admin-employees'] }),
  });
  const createPos = useMutation({
    mutationFn: (data: any) => api.post('/org-admin/positions', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-admin-positions'] }),
  });
  const deletePos = useMutation({
    mutationFn: (id: string) => api.delete(`/org-admin/positions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-admin-positions'] }),
  });

  const [newPos, setNewPos] = useState({ name: '', code: '', rank: 0 });
  const [inlineCreate, setInlineCreate] = useState<{ empId: string; name: string } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const users = usersQ.data || [];
  const depts = deptsQ.data || [];
  const emps = empsQ.data || [];
  const positions = positionsQ.data || [];

  const userById = useMemo(() => Object.fromEntries(users.map((u: any) => [u.id, u])), [users]);

  const importJobTitlesAsPositions = async () => {
    const existing = new Set(
      positions.map((p: any) => String(p.name || '').trim().toLowerCase()),
    );
    const titleToEmps = new Map<string, any[]>();
    for (const e of emps) {
      const t = String(e.jobTitle || '').trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (existing.has(key)) continue;
      const arr = titleToEmps.get(t) || [];
      arr.push(e);
      titleToEmps.set(t, arr);
    }
    if (titleToEmps.size === 0) return;
    setBulkBusy(true);
    try {
      let rank = (positions.reduce((m: number, p: any) => Math.max(m, p.rank || 0), 0) || 0) + 1;
      for (const [name, list] of titleToEmps) {
        try {
          const created: any = await createPos.mutateAsync({ name, rank: rank++ } as any);
          const newId = created?.data?.id || created?.id;
          if (!newId) continue;
          for (const e of list) {
            if (!e.positionId) {
              await setPos.mutateAsync({ id: e.id, positionId: newId });
            }
          }
        } catch (err) {
          console.error('Failed to create position', name, getApiErrorMessage(err));
        }
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['org-admin-positions'] }),
        qc.invalidateQueries({ queryKey: ['org-admin-employees'] }),
      ]);
    } finally {
      setBulkBusy(false);
    }
  };

  const distinctMissingTitles = useMemo(() => {
    const existing = new Set(
      positions.map((p: any) => String(p.name || '').trim().toLowerCase()),
    );
    const set = new Set<string>();
    for (const e of emps) {
      const t = String(e.jobTitle || '').trim();
      if (t && !existing.has(t.toLowerCase())) set.add(t);
    }
    return Array.from(set);
  }, [emps, positions]);

  const submitInlineCreate = async () => {
    if (!inlineCreate) return;
    const name = inlineCreate.name.trim();
    if (!name) return;
    const rank = (positions.reduce((m: number, p: any) => Math.max(m, p.rank || 0), 0) || 0) + 1;
    try {
      const created: any = await createPos.mutateAsync({ name, rank } as any);
      const newId = created?.data?.id || created?.id;
      if (newId) {
        await setPos.mutateAsync({ id: inlineCreate.empId, positionId: newId });
      }
      setInlineCreate(null);
    } catch (err) {
      alert(getApiErrorMessage(err) || 'Failed to create position');
    }
  };

  return (
    <div className="space-y-8">
      {/* Departments */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Departments</h2>
          <span className="text-xs text-gray-500">{depts.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Parent Department</th>
                <th className="text-left px-4 py-2">Department Head</th>
              </tr>
            </thead>
            <tbody>
              {deptsQ.isLoading && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {depts.map((d: any) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{d.name}</td>
                  <td className="px-4 py-2">
                    <select
                      className="border rounded px-2 py-1 text-sm w-full max-w-xs"
                      value={d.parentId || ''}
                      onChange={(e) =>
                        setParent.mutate({ id: d.id, parentId: e.target.value || null })
                      }
                    >
                      <option value="">— None —</option>
                      {depts
                        .filter((x: any) => x.id !== d.id)
                        .map((x: any) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className="border rounded px-2 py-1 text-sm w-full max-w-xs"
                      value={d.headUserId || ''}
                      onChange={(e) =>
                        setHead.mutate({ id: d.id, headUserId: e.target.value || null })
                      }
                    >
                      <option value="">— None —</option>
                      {users.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {userLabel(u)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {!deptsQ.isLoading && depts.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                    No departments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Positions */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-gray-900">Positions / Job Titles</h2>
          <div className="flex items-center gap-3">
            {distinctMissingTitles.length > 0 && positions.length > 0 && (
              <button
                onClick={importJobTitlesAsPositions}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded px-2 py-1"
                title={distinctMissingTitles.join(', ')}
              >
                {bulkBusy ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                Import {distinctMissingTitles.length} from job titles
              </button>
            )}
            <span className="text-xs text-gray-500">Higher rank = more senior</span>
          </div>
        </div>
        <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-4 gap-2 border-b">
          <input
            placeholder="Name (e.g. Director)"
            value={newPos.name}
            onChange={(e) => setNewPos({ ...newPos, name: e.target.value })}
            className="border rounded px-2 py-1 text-sm"
          />
          <input
            placeholder="Code"
            value={newPos.code}
            onChange={(e) => setNewPos({ ...newPos, code: e.target.value })}
            className="border rounded px-2 py-1 text-sm"
          />
          <input
            type="number"
            placeholder="Rank"
            value={newPos.rank}
            onChange={(e) => setNewPos({ ...newPos, rank: Number(e.target.value) })}
            className="border rounded px-2 py-1 text-sm"
          />
          <button
            onClick={() => {
              const name = newPos.name.trim();
              if (!name) return;
              const payload: any = { name, rank: Number(newPos.rank) || 0 };
              const code = String(newPos.code || '').trim();
              if (code) payload.code = code;
              createPos.mutate(payload, {
                onSuccess: () => setNewPos({ name: '', code: '', rank: 0 }),
                onError: (err: any) =>
                  alert(getApiErrorMessage(err) || 'Failed to create position'),
              });
            }}
            className="bg-blue-600 text-white rounded text-sm px-3 py-1 inline-flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Code</th>
              <th className="text-left px-4 py-2">Rank</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{p.name}</td>
                <td className="px-4 py-2">{p.code || '—'}</td>
                <td className="px-4 py-2">{p.rank}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => deletePos.mutate(p.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!positionsQ.isLoading && positions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  <div>No positions defined.</div>
                  {distinctMissingTitles.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={importJobTitlesAsPositions}
                        disabled={bulkBusy}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm rounded px-3 py-1.5"
                      >
                        {bulkBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        Create {distinctMissingTitles.length} position
                        {distinctMissingTitles.length === 1 ? '' : 's'} from existing job titles
                      </button>
                      <div className="mt-1 text-xs text-gray-400">
                        {distinctMissingTitles.slice(0, 6).join(', ')}
                        {distinctMissingTitles.length > 6 ? '…' : ''}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Employees */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Employees · Reporting</h2>
          <span className="text-xs text-gray-500">{emps.length} employees</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Employee</th>
                <th className="text-left px-4 py-2">Job Title</th>
                <th className="text-left px-4 py-2">Reports to (Manager)</th>
                <th className="text-left px-4 py-2">Position</th>
              </tr>
            </thead>
            <tbody>
              {empsQ.isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {emps.map((e: any) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-2 font-medium">
                    {[e.firstName, e.lastName].filter(Boolean).join(' ')}
                    {e.userId && (
                      <div className="text-xs text-gray-400">{userLabel(userById[e.userId])}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">{e.jobTitle || '—'}</td>
                  <td className="px-4 py-2">
                    <select
                      className="border rounded px-2 py-1 text-sm w-full max-w-xs"
                      value={e.managerId || ''}
                      onChange={(ev) =>
                        setMgr.mutate({ id: e.id, managerId: ev.target.value || null })
                      }
                    >
                      <option value="">— None —</option>
                      {emps
                        .filter((m: any) => m.id !== e.id)
                        .map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {[m.firstName, m.lastName].filter(Boolean).join(' ')}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className="border rounded px-2 py-1 text-sm w-full max-w-xs"
                      value={e.positionId || ''}
                      onChange={(ev) => {
                        const v = ev.target.value;
                        if (v === '__create__') {
                          setInlineCreate({ empId: e.id, name: e.jobTitle || '' });
                          return;
                        }
                        setPos.mutate({ id: e.id, positionId: v || null });
                      }}
                    >
                      <option value="">— None —</option>
                      {positions.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                      <option value="__create__">➕ Create new position…</option>
                    </select>
                    {inlineCreate?.empId === e.id && (
                      <div className="mt-2 flex items-center gap-1">
                        <input
                          autoFocus
                          value={inlineCreate.name}
                          onChange={(ev) =>
                            setInlineCreate({ ...inlineCreate, name: ev.target.value })
                          }
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter') submitInlineCreate();
                            if (ev.key === 'Escape') setInlineCreate(null);
                          }}
                          placeholder="Position name"
                          className="border rounded px-2 py-1 text-sm flex-1 min-w-0"
                        />
                        <button
                          onClick={submitInlineCreate}
                          disabled={!inlineCreate.name.trim() || createPos.isPending}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs rounded px-2 py-1"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setInlineCreate(null)}
                          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!empsQ.isLoading && emps.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    No employees yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ============== POLICIES TAB ==============
const STEP_TYPES = [
  { value: 'direct_manager', label: "Requester's direct manager" },
  { value: 'department_head', label: 'Department head' },
  { value: 'parent_department_head', label: 'Parent department head' },
  { value: 'role', label: 'Anyone with role' },
  { value: 'position', label: 'Specific position' },
  { value: 'specific_user', label: 'Specific user' },
  { value: 'group', label: 'Approver group' },
];

function PoliciesTab() {
  const qc = useQueryClient();
  const policiesQ = useQuery({
    queryKey: ['org-admin-policies'],
    queryFn: async () => (await api.get('/org-admin/policies')).data as any[],
  });
  const groupsQ = useQuery({
    queryKey: ['org-admin-groups'],
    queryFn: async () => (await api.get('/org-admin/groups')).data as any[],
  });
  const positionsQ = useQuery({
    queryKey: ['org-admin-positions'],
    queryFn: async () => (await api.get('/org-admin/positions')).data as any[],
  });
  const usersQ = useUsers();

  const [editing, setEditing] = useState<any | null>(null);

  const open = async (id?: string) => {
    if (id) {
      const fresh = await api.get(`/org-admin/policies/${id}`);
      setEditing(fresh.data);
    } else {
      setEditing({
        name: '',
        description: '',
        documentType: 'PR',
        amountMin: null,
        amountMax: null,
        priority: 0,
        isActive: true,
        steps: [],
      });
    }
  };

  const save = useMutation({
    mutationFn: async (p: any) => {
      if (p.id) return api.put(`/org-admin/policies/${p.id}`, p);
      return api.post('/org-admin/policies', p);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-admin-policies'] });
      setEditing(null);
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/org-admin/policies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-admin-policies'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Policies match by document type, department, and amount. Highest <b>priority</b> wins on
          overlap. If no policy matches, the system routes to the requester's direct manager →
          department head.
        </p>
        <button
          onClick={() => open()}
          className="bg-blue-600 text-white rounded text-sm px-3 py-2 inline-flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> New Policy
        </button>
      </div>

      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Doc Type</th>
              <th className="text-left px-4 py-2">Amount</th>
              <th className="text-left px-4 py-2">Priority</th>
              <th className="text-left px-4 py-2">Active</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(policiesQ.data || []).map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2 font-medium">{p.name}</td>
                <td className="px-4 py-2">{p.documentType}</td>
                <td className="px-4 py-2">
                  {p.amountMin ? Number(p.amountMin).toLocaleString() : '0'} -{' '}
                  {p.amountMax ? Number(p.amountMax).toLocaleString() : '∞'}
                </td>
                <td className="px-4 py-2">{p.priority}</td>
                <td className="px-4 py-2">
                  {p.isActive ? (
                    <span className="text-green-600">●</span>
                  ) : (
                    <span className="text-gray-400">●</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right space-x-3">
                  <button onClick={() => open(p.id)} className="text-blue-600">Edit</button>
                  <button onClick={() => del.mutate(p.id)} className="text-red-600">Delete</button>
                </td>
              </tr>
            ))}
            {policiesQ.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No policies yet — create one or rely on default direct-manager routing.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <PolicyEditor
          policy={editing}
          groups={groupsQ.data || []}
          positions={positionsQ.data || []}
          users={usersQ.data || []}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={() => save.mutate(editing)}
          saving={save.isPending}
        />
      )}
    </div>
  );
}

function PolicyEditor({
  policy,
  groups,
  positions,
  users,
  onChange,
  onClose,
  onSave,
  saving,
}: any) {
  const update = (patch: any) => onChange({ ...policy, ...patch });
  const addStep = () =>
    update({
      steps: [
        ...(policy.steps || []),
        { approverType: 'direct_manager', stepOrder: (policy.steps?.length || 0) + 1 },
      ],
    });
  const updateStep = (idx: number, patch: any) => {
    const steps = [...policy.steps];
    steps[idx] = { ...steps[idx], ...patch };
    update({ steps });
  };
  const removeStep = (idx: number) => {
    const steps = policy.steps.filter((_: any, i: number) => i !== idx);
    update({ steps });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">{policy.id ? 'Edit Policy' : 'New Policy'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name">
              <input
                className="border rounded px-2 py-1 w-full"
                value={policy.name || ''}
                onChange={(e) => update({ name: e.target.value })}
              />
            </Field>
            <Field label="Document Type">
              <select
                className="border rounded px-2 py-1 w-full"
                value={policy.documentType}
                onChange={(e) => update({ documentType: e.target.value })}
              >
                <option value="PR">Purchase Requisition</option>
                <option value="PO">Purchase Order</option>
                <option value="RFQ">RFQ</option>
                <option value="ANY">Any</option>
              </select>
            </Field>
            <Field label="Min Amount">
              <input
                type="number"
                className="border rounded px-2 py-1 w-full"
                value={policy.amountMin ?? ''}
                onChange={(e) => update({ amountMin: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Max Amount">
              <input
                type="number"
                className="border rounded px-2 py-1 w-full"
                value={policy.amountMax ?? ''}
                onChange={(e) => update({ amountMax: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Priority (higher wins)">
              <input
                type="number"
                className="border rounded px-2 py-1 w-full"
                value={policy.priority ?? 0}
                onChange={(e) => update({ priority: Number(e.target.value) })}
              />
            </Field>
            <Field label="Active">
              <select
                className="border rounded px-2 py-1 w-full"
                value={policy.isActive ? '1' : '0'}
                onChange={(e) => update({ isActive: e.target.value === '1' })}
              >
                <option value="1">Active</option>
                <option value="0">Disabled</option>
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea
              className="border rounded px-2 py-1 w-full"
              rows={2}
              value={policy.description || ''}
              onChange={(e) => update({ description: e.target.value })}
            />
          </Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">Approval Steps</h4>
              <button
                onClick={addStep}
                className="text-sm bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded inline-flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Step
              </button>
            </div>
            <div className="space-y-2">
              {(policy.steps || []).map((s: any, idx: number) => (
                <div key={idx} className="border rounded p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500 w-6">#{idx + 1}</span>
                    <select
                      className="border rounded px-2 py-1 text-sm flex-1"
                      value={s.approverType}
                      onChange={(e) => updateStep(idx, { approverType: e.target.value })}
                    >
                      {STEP_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeStep(idx)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {s.approverType === 'role' && (
                      <input
                        placeholder="Role name (e.g. manager)"
                        className="border rounded px-2 py-1"
                        value={s.roleName || ''}
                        onChange={(e) => updateStep(idx, { roleName: e.target.value })}
                      />
                    )}
                    {s.approverType === 'position' && (
                      <select
                        className="border rounded px-2 py-1"
                        value={s.positionId || ''}
                        onChange={(e) => updateStep(idx, { positionId: e.target.value || null })}
                      >
                        <option value="">— pick position —</option>
                        {positions.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {s.approverType === 'specific_user' && (
                      <select
                        className="border rounded px-2 py-1"
                        value={s.userId || ''}
                        onChange={(e) => updateStep(idx, { userId: e.target.value || null })}
                      >
                        <option value="">— pick user —</option>
                        {users.map((u: any) => (
                          <option key={u.id} value={u.id}>
                            {userLabel(u)}
                          </option>
                        ))}
                      </select>
                    )}
                    {s.approverType === 'group' && (
                      <select
                        className="border rounded px-2 py-1"
                        value={s.groupId || ''}
                        onChange={(e) => updateStep(idx, { groupId: e.target.value || null })}
                      >
                        <option value="">— pick group —</option>
                        {groups.map((g: any) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {s.approverType === 'direct_manager' && (
                      <input
                        type="number"
                        min={1}
                        placeholder="Levels up (default 1)"
                        className="border rounded px-2 py-1"
                        value={s.levelsUp || 1}
                        onChange={(e) => updateStep(idx, { levelsUp: Number(e.target.value) })}
                      />
                    )}
                    {(s.approverType === 'department_head' ||
                      s.approverType === 'parent_department_head') && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!s.escalateToParent}
                          onChange={(e) => updateStep(idx, { escalateToParent: e.target.checked })}
                        />
                        Escalate to parent dept if missing
                      </label>
                    )}
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!s.isOptional}
                        onChange={(e) => updateStep(idx, { isOptional: e.target.checked })}
                      />
                      Optional (skip if no approver found)
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={s.skipIfSelf !== false}
                        onChange={(e) => updateStep(idx, { skipIfSelf: e.target.checked })}
                      />
                      Skip if approver is requester
                    </label>
                  </div>
                </div>
              ))}
              {(!policy.steps || policy.steps.length === 0) && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No steps yet — add one to define the approval chain.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !policy.name}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-1 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Policy
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

// ============== GROUPS TAB ==============
function GroupsTab() {
  const qc = useQueryClient();
  const usersQ = useUsers();
  const groupsQ = useQuery({
    queryKey: ['org-admin-groups'],
    queryFn: async () => (await api.get('/org-admin/groups')).data as any[],
  });
  const [editing, setEditing] = useState<any | null>(null);

  const open = async (id?: string) => {
    if (id) {
      const r = await api.get(`/org-admin/groups/${id}`);
      const data = r.data as any;
      setEditing({ ...data, memberUserIds: (data.members || []).map((m: any) => m.userId) });
    } else {
      setEditing({ name: '', description: '', quorumType: 'any', quorumCount: null, memberUserIds: [] });
    }
  };
  const save = useMutation({
    mutationFn: async (g: any) => {
      if (g.id) return api.put(`/org-admin/groups/${g.id}`, g);
      return api.post('/org-admin/groups', g);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-admin-groups'] });
      setEditing(null);
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/org-admin/groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-admin-groups'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Groups (committees) allow multiple users to approve together with a quorum rule.
        </p>
        <button
          onClick={() => open()}
          className="bg-blue-600 text-white rounded text-sm px-3 py-2 inline-flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> New Group
        </button>
      </div>

      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Quorum</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(groupsQ.data || []).map((g: any) => (
              <tr key={g.id} className="border-t">
                <td className="px-4 py-2 font-medium">{g.name}</td>
                <td className="px-4 py-2">
                  {g.quorumType}
                  {g.quorumType === 'm_of_n' && g.quorumCount ? ` (${g.quorumCount})` : ''}
                </td>
                <td className="px-4 py-2 text-right space-x-3">
                  <button onClick={() => open(g.id)} className="text-blue-600">Edit</button>
                  <button onClick={() => del.mutate(g.id)} className="text-red-600">Delete</button>
                </td>
              </tr>
            ))}
            {groupsQ.data?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  No groups yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-xl w-full">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">{editing.id ? 'Edit Group' : 'New Group'}</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="Name">
                <input
                  className="border rounded px-2 py-1 w-full"
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quorum Type">
                  <select
                    className="border rounded px-2 py-1 w-full"
                    value={editing.quorumType}
                    onChange={(e) => setEditing({ ...editing, quorumType: e.target.value })}
                  >
                    <option value="any">Any one member</option>
                    <option value="all">All members</option>
                    <option value="majority">Majority</option>
                    <option value="m_of_n">M of N</option>
                  </select>
                </Field>
                {editing.quorumType === 'm_of_n' && (
                  <Field label="Quorum Count (M)">
                    <input
                      type="number"
                      min={1}
                      className="border rounded px-2 py-1 w-full"
                      value={editing.quorumCount || ''}
                      onChange={(e) =>
                        setEditing({ ...editing, quorumCount: Number(e.target.value) })
                      }
                    />
                  </Field>
                )}
              </div>
              <Field label="Members">
                <div className="border rounded p-2 max-h-64 overflow-y-auto">
                  {(usersQ.data || []).map((u: any) => (
                    <label key={u.id} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={(editing.memberUserIds || []).includes(u.id)}
                        onChange={(e) => {
                          const set = new Set(editing.memberUserIds || []);
                          if (e.target.checked) set.add(u.id);
                          else set.delete(u.id);
                          setEditing({ ...editing, memberUserIds: Array.from(set) });
                        }}
                      />
                      {userLabel(u)}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2 bg-gray-50">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm border rounded">
                Cancel
              </button>
              <button
                onClick={() => save.mutate(editing)}
                disabled={save.isPending || !editing.name}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-1 disabled:opacity-50"
              >
                {save.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== DELEGATIONS TAB ==============
function DelegationsTab() {
  const qc = useQueryClient();
  const usersQ = useUsers();
  const delegationsQ = useQuery({
    queryKey: ['org-admin-delegations'],
    queryFn: async () => (await api.get('/org-admin/delegations')).data as any[],
  });
  const [editing, setEditing] = useState<any | null>(null);

  const save = useMutation({
    mutationFn: (d: any) =>
      d.id ? api.put(`/org-admin/delegations/${d.id}`, d) : api.post('/org-admin/delegations', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-admin-delegations'] });
      setEditing(null);
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/org-admin/delegations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-admin-delegations'] }),
  });

  const userById = useMemo(
    () => Object.fromEntries((usersQ.data || []).map((u: any) => [u.id, u])),
    [usersQ.data],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          When a user is unavailable (out of office, leave, etc.), delegate their pending approvals
          to another user for a defined period.
        </p>
        <button
          onClick={() =>
            setEditing({
              fromUserId: '',
              toUserId: '',
              documentTypes: ['ANY'],
              validFrom: new Date().toISOString().slice(0, 10),
              validTo: '',
              reason: '',
              isActive: true,
            })
          }
          className="bg-blue-600 text-white rounded text-sm px-3 py-2 inline-flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> New Delegation
        </button>
      </div>

      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-4 py-2">From</th>
              <th className="text-left px-4 py-2">To</th>
              <th className="text-left px-4 py-2">Doc Types</th>
              <th className="text-left px-4 py-2">Valid</th>
              <th className="text-left px-4 py-2">Active</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(delegationsQ.data || []).map((d: any) => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-2">{userLabel(userById[d.fromUserId])}</td>
                <td className="px-4 py-2">{userLabel(userById[d.toUserId])}</td>
                <td className="px-4 py-2">{(d.documentTypes || []).join(', ')}</td>
                <td className="px-4 py-2">
                  {new Date(d.validFrom).toLocaleDateString()} →{' '}
                  {d.validTo ? new Date(d.validTo).toLocaleDateString() : '∞'}
                </td>
                <td className="px-4 py-2">{d.isActive ? '✓' : '—'}</td>
                <td className="px-4 py-2 text-right space-x-3">
                  <button onClick={() => setEditing(d)} className="text-blue-600">Edit</button>
                  <button onClick={() => del.mutate(d.id)} className="text-red-600">Delete</button>
                </td>
              </tr>
            ))}
            {delegationsQ.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No delegations.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-xl w-full">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">
                {editing.id ? 'Edit Delegation' : 'New Delegation'}
              </h3>
              <button onClick={() => setEditing(null)} className="text-gray-400">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="From User">
                  <select
                    className="border rounded px-2 py-1 w-full"
                    value={editing.fromUserId || ''}
                    onChange={(e) => setEditing({ ...editing, fromUserId: e.target.value })}
                  >
                    <option value="">— pick user —</option>
                    {(usersQ.data || []).map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {userLabel(u)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="To User">
                  <select
                    className="border rounded px-2 py-1 w-full"
                    value={editing.toUserId || ''}
                    onChange={(e) => setEditing({ ...editing, toUserId: e.target.value })}
                  >
                    <option value="">— pick user —</option>
                    {(usersQ.data || []).map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {userLabel(u)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Document Types">
                <div className="flex gap-3 text-sm">
                  {['ANY', 'PR', 'PO', 'RFQ'].map((t) => (
                    <label key={t} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={(editing.documentTypes || []).includes(t)}
                        onChange={(e) => {
                          const set = new Set(editing.documentTypes || []);
                          if (e.target.checked) set.add(t);
                          else set.delete(t);
                          setEditing({ ...editing, documentTypes: Array.from(set) });
                        }}
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valid From">
                  <input
                    type="date"
                    className="border rounded px-2 py-1 w-full"
                    value={editing.validFrom?.slice(0, 10) || ''}
                    onChange={(e) => setEditing({ ...editing, validFrom: e.target.value })}
                  />
                </Field>
                <Field label="Valid To (optional)">
                  <input
                    type="date"
                    className="border rounded px-2 py-1 w-full"
                    value={editing.validTo?.slice(0, 10) || ''}
                    onChange={(e) =>
                      setEditing({ ...editing, validTo: e.target.value || null })
                    }
                  />
                </Field>
              </div>
              <Field label="Reason">
                <input
                  className="border rounded px-2 py-1 w-full"
                  value={editing.reason || ''}
                  onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!editing.isActive}
                  onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                />
                Active
              </label>
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2 bg-gray-50">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm border rounded">
                Cancel
              </button>
              <button
                onClick={() => save.mutate(editing)}
                disabled={save.isPending || !editing.fromUserId || !editing.toUserId}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-1 disabled:opacity-50"
              >
                {save.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
