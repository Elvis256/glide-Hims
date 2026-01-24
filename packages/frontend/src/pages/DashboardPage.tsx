import {
  Users,
  UserCircle,
  Building,
  Activity,
  TrendingUp,
  Calendar,
} from 'lucide-react';

const stats = [
  { name: 'Total Patients', value: '2,847', icon: UserCircle, change: '+12%', bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
  { name: 'Active Users', value: '24', icon: Users, change: '+3', bgColor: 'bg-green-100', iconColor: 'text-green-600' },
  { name: 'Facilities', value: '5', icon: Building, change: '0', bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
  { name: 'Today\'s Visits', value: '156', icon: Activity, change: '+23%', bgColor: 'bg-orange-100', iconColor: 'text-orange-600' },
];

const recentActivity = [
  { action: 'New patient registered', user: 'Dr. Sarah Nambi', time: '5 mins ago' },
  { action: 'Prescription dispensed', user: 'Pharm. James Okello', time: '12 mins ago' },
  { action: 'Lab result uploaded', user: 'Lab Tech. Mary Apio', time: '25 mins ago' },
  { action: 'Patient discharged', user: 'Nurse Grace Atim', time: '1 hour ago' },
  { action: 'New user created', user: 'Admin', time: '2 hours ago' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-sm">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-green-600 font-medium">{stat.change}</span>
              <span className="text-gray-500">from last month</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.action}</p>
                  <p className="text-xs text-gray-500">
                    {activity.user} • {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
              <UserCircle className="w-8 h-8 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">Register Patient</p>
                <p className="text-xs text-gray-500">Add new patient</p>
              </div>
            </button>
            <button className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Calendar className="w-8 h-8 text-green-600" />
              <div>
                <p className="font-medium text-gray-900">New Visit</p>
                <p className="text-xs text-gray-500">Create encounter</p>
              </div>
            </button>
            <button className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Users className="w-8 h-8 text-purple-600" />
              <div>
                <p className="font-medium text-gray-900">Manage Users</p>
                <p className="text-xs text-gray-500">Add or edit staff</p>
              </div>
            </button>
            <button className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Activity className="w-8 h-8 text-orange-600" />
              <div>
                <p className="font-medium text-gray-900">View Reports</p>
                <p className="text-xs text-gray-500">Analytics & stats</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
