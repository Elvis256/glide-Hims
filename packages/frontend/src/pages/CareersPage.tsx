import { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from 'sonner';

interface JobPosting {
  id: string;
  title: string;
  department?: string;
  location?: string;
  employmentType?: string;
  description?: string;
  requirements?: string;
  closingDate?: string;
}

export default function CareersPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<JobPosting | null>(null);
  const [applyForm, setApplyForm] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<JobPosting[]>('/careers/jobs');
      setJobs(res.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const apply = async () => {
    if (!selected) return;
    if (!applyForm.firstName || !applyForm.lastName || !applyForm.email) {
      toast.error('First name, last name and email are required');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/careers/jobs/${selected.id}/apply`, applyForm);
      toast.success('Application submitted! We will be in touch.');
      setSelected(null);
      setApplyForm({});
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-6 py-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Careers at our Hospital</h1>
          <a href="/login" className="text-sm text-blue-600 hover:underline">
            Staff Login →
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-gray-700 mb-6">
          Join our team. Browse open positions below and submit an application.
        </p>

        {loading ? (
          <p>Loading positions...</p>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded shadow p-8 text-center text-gray-500">
            No open positions at this time. Please check back soon.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((j) => (
              <div key={j.id} className="bg-white rounded shadow p-5 hover:shadow-md transition">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold">{j.title}</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {[j.department, j.location, j.employmentType].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelected(j)}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
                  >
                    Apply
                  </button>
                </div>
                {j.description && (
                  <p className="text-sm text-gray-700 mt-3 line-clamp-3">{j.description}</p>
                )}
                {j.closingDate && (
                  <p className="text-xs text-red-600 mt-2">
                    Closing: {new Date(j.closingDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <h2 className="text-xl font-bold mb-1">Apply: {selected.title}</h2>
            <p className="text-sm text-gray-600 mb-4">All fields marked * are required.</p>
            <div className="space-y-3">
              <input
                className="w-full border rounded p-2"
                placeholder="First name *"
                value={applyForm.firstName || ''}
                onChange={(e) => setApplyForm({ ...applyForm, firstName: e.target.value })}
              />
              <input
                className="w-full border rounded p-2"
                placeholder="Last name *"
                value={applyForm.lastName || ''}
                onChange={(e) => setApplyForm({ ...applyForm, lastName: e.target.value })}
              />
              <input
                className="w-full border rounded p-2"
                type="email"
                placeholder="Email *"
                value={applyForm.email || ''}
                onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })}
              />
              <input
                className="w-full border rounded p-2"
                placeholder="Phone"
                value={applyForm.phone || ''}
                onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })}
              />
              <input
                className="w-full border rounded p-2"
                placeholder="CV / Resume URL"
                value={applyForm.resumeUrl || ''}
                onChange={(e) => setApplyForm({ ...applyForm, resumeUrl: e.target.value })}
              />
              <textarea
                className="w-full border rounded p-2"
                rows={5}
                placeholder="Cover letter"
                value={applyForm.coverLetter || ''}
                onChange={(e) => setApplyForm({ ...applyForm, coverLetter: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setSelected(null);
                  setApplyForm({});
                }}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={apply}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
