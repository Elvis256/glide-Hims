import { Link } from 'react-router-dom';
import { Workflow } from 'lucide-react';
import { StructureTab } from '../procurement/OrgApprovalAdminPage';

export default function HROrganisationPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR · Organisation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage departments, positions/job titles and employee reporting lines. These records
            are the source of truth used by procurement approval routing and other modules.
          </p>
        </div>
        <Link
          to="/admin/procurement/org-approvals"
          className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded px-3 py-1.5"
        >
          <Workflow className="w-4 h-4" />
          Go to Procurement Approvals
        </Link>
      </div>

      <StructureTab />
    </div>
  );
}
