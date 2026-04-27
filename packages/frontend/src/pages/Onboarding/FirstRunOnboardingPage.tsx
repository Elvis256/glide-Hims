import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FirstRunOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [adminData, setAdminData] = useState({
    email: '',
    password: '',
    name: '',
  });
  const [hospitalData, setHospitalData] = useState({
    name: '',
    slug: '',
    subdomain: '',
  });

  const handleAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdminData({ ...adminData, [e.target.name]: e.target.value });
  };

  const handleHospitalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHospitalData({ ...hospitalData, [e.target.name]: e.target.value });
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleFinish = async () => {
    try {
      const response = await fetch('/api/v1/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: hospitalData.name,
          slug: hospitalData.slug,
          subdomain: hospitalData.subdomain,
          billing_plan: 'free',
        }),
      });

      if (response.ok) {
        window.location.href = `https://admin.${window.location.hostname}/login`;
      }
    } catch (error) {
      console.error('Setup error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-2">Glide HIMS</h1>
        <p className="text-center text-gray-600 mb-8">Healthcare Management System Setup</p>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Step 1: Create Admin Account</h2>
            <input
              type="text"
              placeholder="Full Name"
              name="name"
              value={adminData.name}
              onChange={handleAdminChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <input
              type="email"
              placeholder="Email"
              name="email"
              value={adminData.email}
              onChange={handleAdminChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <input
              type="password"
              placeholder="Password"
              name="password"
              value={adminData.password}
              onChange={handleAdminChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleNext}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Next Step
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Step 2: Create First Hospital</h2>
            <input
              type="text"
              placeholder="Hospital Name"
              name="name"
              value={hospitalData.name}
              onChange={handleHospitalChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Hospital Slug (e.g., mnh-kampala)"
              name="slug"
              value={hospitalData.slug}
              onChange={handleHospitalChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Subdomain (e.g., mnh-kampala)"
              name="subdomain"
              value={hospitalData.subdomain}
              onChange={handleHospitalChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-semibold"
              >
                Review
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Step 3: Review Setup</h2>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
              <p><strong>Admin Email:</strong> {adminData.email}</p>
              <p><strong>Hospital:</strong> {hospitalData.name}</p>
              <p><strong>Subdomain:</strong> {hospitalData.subdomain}.hmisdemo.itsolutionsuganda.com</p>
            </div>
            <p className="text-gray-600 text-sm">
              Click "Finish" to complete setup. You'll be redirected to the admin dashboard.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-semibold"
              >
                Finish Setup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FirstRunOnboardingPage;
