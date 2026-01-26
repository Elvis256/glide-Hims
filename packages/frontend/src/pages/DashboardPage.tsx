import {
  Activity,
} from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="h-[calc(100vh-120px)] flex items-center justify-center">
      <div className="text-center text-gray-400">
        <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg">Select a module from the navigation above</p>
        <p className="text-sm mt-1">Choose Registration, Queue, OPD, or other modules to get started</p>
      </div>
    </div>
  );
}
