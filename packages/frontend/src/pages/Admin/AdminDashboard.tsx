import React, { useEffect, useState } from 'react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  status: string;
  user_count: number;
  deployment_count: number;
  created_at: string;
}

const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const metricsRes = await fetch('/api/v1/admin/metrics/system');
        const metricsData = await metricsRes.json();
        setMetrics(metricsData.data);

        const tenantsRes = await fetch('/api/v1/admin/tenants?limit=10');
        const tenantsData = await tenantsRes.json();
        setTenants(tenantsData.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Total Hospitals</p>
          <p className="text-3xl font-bold">{metrics?.total_tenants || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Active Hospitals</p>
          <p className="text-3xl font-bold text-green-600">{metrics?.active_tenants || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Total Users</p>
          <p className="text-3xl font-bold">{metrics?.total_users || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Total Deployments</p>
          <p className="text-3xl font-bold">{metrics?.total_deployments || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold">Hospitals</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Subdomain</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Users</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-4">{tenant.name}</td>
                <td className="px-6 py-4">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">{tenant.subdomain}</code>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    tenant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {tenant.status}
                  </span>
                </td>
                <td className="px-6 py-4">{tenant.user_count}</td>
                <td className="px-6 py-4">
                  <button className="text-blue-600 hover:text-blue-800 text-sm font-semibold">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
