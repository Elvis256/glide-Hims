import { useEffect, useMemo, useState } from 'react';
import { hrService } from '../../../services/hr';
import { api } from '../../../services/api';
import toast from 'react-hot-toast';
import { Printer, LayoutGrid, GitBranch, Search, Users } from 'lucide-react';

interface Employee {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  department?: string | { name?: string };
  email?: string;
  status?: string;
}

interface Designation {
  id: string;
  title: string;
  level?: number;
  grade?: string;
  department?: string;
  reportsTo?: string | null;
}

interface TreeNode {
  designation: Designation;
  staff: Employee[];
  children: TreeNode[];
}

const gradeColors: Record<string, string> = {
  E1: 'border-purple-400 bg-purple-50',
  E2: 'border-purple-300 bg-purple-50',
  M1: 'border-blue-400 bg-blue-50',
  M2: 'border-blue-300 bg-blue-50',
  M3: 'border-blue-300 bg-blue-50',
  N1: 'border-green-400 bg-green-50',
  N2: 'border-green-300 bg-green-50',
  N3: 'border-green-300 bg-green-50',
  T1: 'border-orange-300 bg-orange-50',
};

const deptName = (e: Employee) =>
  typeof e.department === 'string' ? e.department : e.department?.name || '';

export default function OrgChartPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'hierarchy' | 'department'>('hierarchy');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [staff, settingsRes] = await Promise.all([
          hrService.employees.list({}),
          api.get<{ value?: { designations?: Designation[] } }>('/settings/designations').catch(() => ({ data: { value: { designations: [] } } } as any)),
        ]);
        setEmployees(
          (staff as any[]).map((e: any) => ({
            ...e,
            fullName:
              e.fullName || `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.employeeNumber,
          })),
        );
        setDesignations(settingsRes.data?.value?.designations || []);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Failed to load org chart');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Build hierarchy tree from designations' reportsTo
  const tree = useMemo<TreeNode[]>(() => {
    const matchSearch = (e: Employee) =>
      !search ||
      e.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      e.jobTitle?.toLowerCase().includes(search.toLowerCase()) ||
      deptName(e).toLowerCase().includes(search.toLowerCase());

    const staffByTitle = new Map<string, Employee[]>();
    for (const e of employees) {
      const t = (e.jobTitle || '').trim();
      if (!t || t === 'Not Assigned') continue;
      if (!staffByTitle.has(t)) staffByTitle.set(t, []);
      staffByTitle.get(t)!.push(e);
    }

    const nodes = new Map<string, TreeNode>();
    for (const d of designations) {
      nodes.set(d.title, {
        designation: d,
        staff: (staffByTitle.get(d.title) || []).filter(matchSearch),
        children: [],
      });
    }

    const roots: TreeNode[] = [];
    for (const node of nodes.values()) {
      const parentTitle = node.designation.reportsTo;
      if (parentTitle && nodes.has(parentTitle)) {
        nodes.get(parentTitle)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortRec = (list: TreeNode[]) => {
      list.sort((a, b) => (a.designation.level || 99) - (b.designation.level || 99) || a.designation.title.localeCompare(b.designation.title));
      list.forEach((n) => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
  }, [employees, designations, search]);

  // Staff with no matching designation (Unassigned)
  const unassignedStaff = useMemo(() => {
    const titles = new Set(designations.map((d) => d.title));
    return employees.filter((e) => {
      const t = (e.jobTitle || '').trim();
      const orphan = !t || t === 'Not Assigned' || !titles.has(t);
      if (!orphan) return false;
      if (!search) return true;
      return (
        e.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        e.jobTitle?.toLowerCase().includes(search.toLowerCase()) ||
        deptName(e).toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [employees, designations, search]);

  // Department-grouped view (filtered)
  const groupedByDept = useMemo(() => {
    const filt = employees.filter(
      (e) =>
        !search ||
        e.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        e.jobTitle?.toLowerCase().includes(search.toLowerCase()) ||
        deptName(e).toLowerCase().includes(search.toLowerCase()),
    );
    const map = new Map<string, Employee[]>();
    for (const e of filt) {
      const key = deptName(e) || '— Unassigned —';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [employees, search]);

  const handlePrint = () => window.print();

  const renderNode = (node: TreeNode) => {
    const grade = node.designation.grade || '';
    const colorCls = gradeColors[grade] || 'border-gray-300 bg-white';
    return (
      <li key={node.designation.id} className="org-node">
        <div className={`org-card border-2 ${colorCls} rounded-lg shadow-sm`}>
          <div className="px-3 py-2 border-b border-gray-200">
            <div className="font-semibold text-sm text-gray-900">{node.designation.title}</div>
            <div className="text-[11px] text-gray-600 flex items-center gap-1.5 mt-0.5">
              {grade && <span className="px-1.5 py-0.5 bg-white/70 rounded font-mono">{grade}</span>}
              {node.designation.department && <span className="truncate">{node.designation.department}</span>}
            </div>
          </div>
          <div className="px-3 py-1.5 text-[11px]">
            {node.staff.length === 0 ? (
              <span className="text-gray-400 italic">vacant</span>
            ) : (
              <ul className="space-y-0.5">
                {node.staff.map((s) => (
                  <li key={s.id} className="flex items-center gap-1 text-gray-700">
                    <Users className="h-3 w-3 text-blue-500 flex-shrink-0" />
                    <span className="truncate" title={s.email}>{s.fullName}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {node.children.length > 0 && (
          <ul>{node.children.map(renderNode)}</ul>
        )}
      </li>
    );
  };

  const totalAssigned = tree.reduce(function count(acc: number, n: TreeNode): number {
    return acc + n.staff.length + n.children.reduce(count, 0);
  }, 0);

  return (
    <div className="p-6 print:p-0">
      {/* Print CSS */}
      <style>{`
        .org-tree, .org-tree ul {
          list-style: none;
          margin: 0;
          padding: 0;
          position: relative;
        }
        .org-tree ul {
          display: flex;
          padding-top: 24px;
          gap: 16px;
          justify-content: center;
        }
        .org-tree li.org-node {
          position: relative;
          padding: 0 8px;
          text-align: center;
        }
        .org-tree li.org-node > ul::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          height: 12px;
          width: 2px;
          background: #cbd5e1;
        }
        .org-tree li.org-node > ul::after {
          content: '';
          position: absolute;
          top: 12px;
          left: 8px;
          right: 8px;
          height: 2px;
          background: #cbd5e1;
        }
        .org-tree li.org-node > ul > li.org-node {
          position: relative;
          padding-top: 18px;
        }
        .org-tree li.org-node > ul > li.org-node::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          width: 2px;
          height: 18px;
          background: #cbd5e1;
        }
        .org-card {
          display: inline-block;
          min-width: 180px;
          max-width: 220px;
          text-align: left;
        }
        @media print {
          @page { size: A3 landscape; margin: 10mm; }
          /* Hide everything by default */
          body * { visibility: hidden !important; }
          /* Show only the print area and its descendants */
          .org-print-area, .org-print-area * { visibility: visible !important; }
          /* Pull the print area out of the layout flow to the page top */
          .org-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          .no-print, .no-print * { display: none !important; visibility: hidden !important; }
          .org-card { box-shadow: none !important; }
        }
      `}</style>

      <div className="flex justify-between items-center mb-4 no-print">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-blue-600" />
            Organisation Chart
          </h1>
          <p className="text-sm text-gray-600">
            {employees.length} staff · {designations.length} designations · {totalAssigned} placed in hierarchy · {unassignedStaff.length} unassigned
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="border rounded-lg pl-9 pr-3 py-2 w-56"
              placeholder="Search staff…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('hierarchy')}
              className={`px-3 py-2 text-sm flex items-center gap-1.5 ${view === 'hierarchy' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
              title="Hierarchy view"
            >
              <GitBranch className="h-4 w-4" />
              Hierarchy
            </button>
            <button
              onClick={() => setView('department')}
              className={`px-3 py-2 text-sm flex items-center gap-1.5 border-l ${view === 'department' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
              title="Department view"
            >
              <LayoutGrid className="h-4 w-4" />
              Department
            </button>
          </div>
          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-gray-800 text-white rounded-lg flex items-center gap-1.5 text-sm hover:bg-gray-900"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </button>
        </div>
      </div>

      <div className="org-print-area">
        {/* Print-only header (hidden on screen) */}
        <div className="hidden print:block mb-4 text-center">
          <h1 className="text-xl font-bold">Organisation Chart</h1>
          <p className="text-sm text-gray-600">
            {employees.length} staff · {designations.length} designations · printed {new Date().toLocaleDateString()}
          </p>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : view === 'hierarchy' ? (
          <>
            {tree.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded p-6 text-center no-print">
                <p className="text-amber-800 font-medium">No designations defined yet.</p>
                <p className="text-sm text-amber-700 mt-1">
                  Go to <a className="underline" href="/hr/designations">HR → Designations</a> and click <b>Load Default HMIS Designations</b> to seed the hierarchy.
                </p>
              </div>
            ) : (
              <div className="bg-white border rounded-lg p-6 overflow-x-auto print:border-0 print:p-0">
                <ul className="org-tree">
                  {tree.map(renderNode)}
                </ul>
              </div>
            )}

            {unassignedStaff.length > 0 && (
              <div className="mt-6 bg-white border rounded-lg p-4 print:break-before-page">
                <h2 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  Unassigned Staff
                  <span className="text-xs text-gray-500 font-normal">({unassignedStaff.length})</span>
                </h2>
                <p className="text-xs text-gray-500 mb-3 no-print">
                  These users have no <b>Job Title</b> matching a defined designation. Assign them via Staff Directory → Edit.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {unassignedStaff.map((s) => (
                    <div key={s.id} className="border rounded p-2 bg-gray-50 text-sm">
                      <div className="font-medium">{s.fullName}</div>
                      <div className="text-xs text-gray-600">{s.jobTitle || '—'}</div>
                      <div className="text-xs text-gray-500">{deptName(s) || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            {groupedByDept.length === 0 ? (
              <div className="bg-white rounded shadow p-8 text-center text-gray-500">No employees match.</div>
            ) : (
              groupedByDept.map(([dept, members]) => (
                <div key={dept} className="bg-white rounded shadow border">
                  <div className="border-b p-4 flex justify-between items-center">
                    <h2 className="font-semibold text-lg">{dept}</h2>
                    <span className="text-sm text-gray-500">{members.length} staff</span>
                  </div>
                  <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {members.map((m) => (
                      <div key={m.id} className="border rounded p-3 hover:shadow transition bg-gray-50" title={m.email || ''}>
                        <div className="font-medium">{m.fullName}</div>
                        <div className="text-xs text-gray-600">{m.jobTitle || '—'}</div>
                        {m.email && <div className="text-xs text-blue-600 truncate mt-1">{m.email}</div>}
                        {m.status && m.status !== 'active' && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">{m.status}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
