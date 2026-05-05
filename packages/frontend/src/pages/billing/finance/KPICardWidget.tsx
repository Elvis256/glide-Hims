import React from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'red' | 'amber';
  loading?: boolean;
}

export const KPICardWidget: React.FC<KPICardProps> = ({
  title,
  value,
  unit,
  trend,
  icon,
  color,
  loading = false,
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };

  const iconClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <div className={`border rounded-lg p-6 ${colorClasses[color]}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          {loading ? (
            <div className="mt-2 h-8 bg-gray-200 rounded animate-pulse w-24" />
          ) : (
            <p className="text-3xl font-bold mt-2">
              {value}
              {unit && <span className="text-lg ml-1">{unit}</span>}
            </p>
          )}
          {trend !== undefined && (
            <p className={`text-sm mt-2 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% from last period
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${iconClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};
