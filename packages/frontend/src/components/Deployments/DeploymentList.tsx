import React, { useEffect, useState } from 'react';
import { deploymentApi, Deployment } from '../../services/deploymentApi';

export const DeploymentList: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeployments = async () => {
      try {
        const response = await deploymentApi.listDeployments(tenantId);
        setDeployments(response.data);
      } catch (error) {
        console.error('Failed to fetch deployments', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeployments();
  }, [tenantId]);

  if (loading) return <div>Loading deployments...</div>;

  return (
    <div className="deployment-list">
      <h2>Deployments</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Version</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {deployments.map((d) => (
            <tr key={d.id}>
              <td>{d.name}</td>
              <td>{d.type}</td>
              <td>
                <span className={`status-${d.status.toLowerCase()}`}>
                  {d.status}
                </span>
              </td>
              <td>{d.currentVersion}</td>
              <td>
                <button>View</button>
                <button>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
