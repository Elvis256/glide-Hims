import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const PublicLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [registrationAllowed, setRegistrationAllowed] = useState(false);

  useEffect(() => {
    api
      .get('/setup/registration-allowed')
      .then((r) => setRegistrationAllowed(!!(r.data?.data?.allowed ?? r.data?.allowed)))
      .catch(() => setRegistrationAllowed(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <nav className="flex justify-between items-center px-8 py-4 bg-white shadow-sm">
        <h1 className="text-2xl font-bold text-blue-600">Glide HIMS</h1>
        <div className="space-x-4">
          <a href="#features" className="text-gray-700 hover:text-blue-600">Features</a>
          <a href="#pricing" className="text-gray-700 hover:text-blue-600">Pricing</a>
          <button onClick={() => navigate('/system/login')} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            Admin Login
          </button>
        </div>
      </nav>

      <section className="px-8 py-20 text-center">
        <h2 className="text-5xl font-bold mb-4">Healthcare Management System</h2>
        <p className="text-xl text-gray-600 mb-8">Complete HIMS solution for hospitals and clinics across Africa</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {registrationAllowed && (
            <button
              onClick={() => navigate('/register')}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 text-lg font-semibold"
            >
              Get Started Free
            </button>
          )}
          <button
            onClick={() => navigate('/system/login')}
            className="bg-white text-blue-600 border-2 border-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 text-lg font-semibold"
          >
            Admin Portal
          </button>
        </div>
      </section>

      <section id="features" className="px-8 py-20 bg-white">
        <h3 className="text-3xl font-bold text-center mb-12">Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="p-6 border border-gray-200 rounded-lg">
            <h4 className="text-xl font-semibold mb-2">Patient Management</h4>
            <p className="text-gray-600">Complete patient records, appointments, and medical history</p>
          </div>
          <div className="p-6 border border-gray-200 rounded-lg">
            <h4 className="text-xl font-semibold mb-2">Lab Management</h4>
            <p className="text-gray-600">Lab orders, sample tracking, and results management</p>
          </div>
          <div className="p-6 border border-gray-200 rounded-lg">
            <h4 className="text-xl font-semibold mb-2">Pharmacy</h4>
            <p className="text-gray-600">Inventory, prescriptions, and drug dispensing</p>
          </div>
        </div>
      </section>

      <section id="pricing" className="px-8 py-20 bg-gray-50">
        <h3 className="text-3xl font-bold text-center mb-12">Pricing Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow text-center">
            <h4 className="text-xl font-semibold mb-2">Free</h4>
            <p className="text-3xl font-bold mb-4">$0</p>
            <p className="text-gray-600">Perfect for small clinics</p>
          </div>
          <div className="bg-blue-600 text-white p-6 rounded-lg shadow text-center">
            <h4 className="text-xl font-semibold mb-2">Pro</h4>
            <p className="text-3xl font-bold mb-4">$99/mo</p>
            <p>Great for hospitals</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow text-center">
            <h4 className="text-xl font-semibold mb-2">Enterprise</h4>
            <p className="text-3xl font-bold mb-4">Custom</p>
            <p className="text-gray-600">Large healthcare networks</p>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 text-white px-8 py-8 text-center text-sm">
        <p>&copy; 2026 Glide HIMS. All rights reserved.</p>
        <p className="mt-2 text-white/70">
          <a href="https://hmis.itsolutionsuganda.com" className="hover:text-white">Marketing site</a>
          {' · '}
          <a href="https://hmis.itsolutionsuganda.com/pricing.html" className="hover:text-white">Pricing</a>
          {' · '}
          <a href="https://hmis.itsolutionsuganda.com/contact.html" className="hover:text-white">Contact sales</a>
          {' · '}
          <a href="https://hmis.itsolutionsuganda.com/docs/" className="hover:text-white">Documentation</a>
        </p>
      </footer>
    </div>
  );
};

export default PublicLandingPage;
