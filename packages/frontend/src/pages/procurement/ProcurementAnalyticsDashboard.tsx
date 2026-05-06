import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Package, Zap, AlertCircle, RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { api } from '../../services/api';

interface SupplierMetric {
  supplierId: string;
  supplierName: string;
  totalSpend: number;
  orderCount: number;
  avgOrderValue: number;
  onTimeDeliveryRate: number;
  qualityScore: number;
}

interface SpendTrend {
  period: string;
  totalSpend: number;
  orderCount: number;
}

interface CategorySpend {
  category: string;
  totalSpend: number;
  orderCount: number;
  percentOfTotal: number;
}

const ProcurementAnalyticsDashboard: React.FC = () => {
  const [suppliers, setSuppliers] = useState<SupplierMetric[]>([]);
  const [spendTrends, setSpendTrends] = useState<SpendTrend[]>([]);
  const [categorySpend, setCategorySpend] = useState<CategorySpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('spend');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [supplierRes, trendRes, categoryRes] = await Promise.all([
        api.get('/procurement/analytics/suppliers/metrics'),
        api.get('/procurement/analytics/spend/trends'),
        api.get('/procurement/analytics/spend/by-category'),
      ]);

      setSuppliers(supplierRes.data || []);
      setSpendTrends(trendRes.data || []);
      setCategorySpend(categoryRes.data || []);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading analytics...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>Procurement Analytics Dashboard</h1>
        <button
          onClick={fetchAnalytics}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #e0e0e0', marginBottom: '24px' }}>
        {['spend', 'suppliers', 'approvals'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              borderBottom: activeTab === tab ? '3px solid #1890ff' : 'none',
              color: activeTab === tab ? '#1890ff' : '#666',
              marginBottom: '-2px'
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'spend' && (
          <div style={{ display: 'grid', gap: '24px' }}>
            {/* Monthly Spend Trends */}
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <TrendingUp size={20} color="#1890ff" />
                <h2 style={{ margin: 0, fontSize: '18px' }}>Monthly Spend Trends</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={spendTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="totalSpend" stroke="#8884d8" name="Total Spend" />
                  <Line type="monotone" dataKey="orderCount" stroke="#82ca9d" name="Order Count" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Spend by Category */}
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <Package size={20} color="#1890ff" />
                <h2 style={{ margin: 0, fontSize: '18px' }}>Spend by Category</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categorySpend}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percentOfTotal }) => `${category}: ${percentOfTotal.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="totalSpend"
                  >
                    {categorySpend.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'suppliers' && (
          <div style={{ display: 'grid', gap: '24px' }}>
            {/* Top Suppliers */}
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <BarChart3 size={20} color="#1890ff" />
                <h2 style={{ margin: 0, fontSize: '18px' }}>Top Suppliers by Spend</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={suppliers.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="supplierName" type="category" width={150} />
                  <Tooltip />
                  <Bar dataKey="totalSpend" fill="#8884d8" name="Total Spend" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Quality Metrics */}
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <Zap size={20} color="#1890ff" />
                <h2 style={{ margin: 0, fontSize: '18px' }}>Supplier Quality Metrics</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={suppliers.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="supplierName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="qualityScore" fill="#82ca9d" name="Quality Score" />
                  <Bar dataKey="onTimeDeliveryRate" fill="#ffc658" name="On-Time Rate" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'approvals' && (
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <AlertCircle size={24} color="#1890ff" />
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Approval Metrics</h3>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                Approval bottleneck detection and SLA compliance tracking will be displayed here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcurementAnalyticsDashboard;
