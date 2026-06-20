import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Shield, Users, Stethoscope, ArrowRight, Check } from 'lucide-react';
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
    <div className="min-h-screen bg-[#f5f5f7] font-sans antialiased text-[#1d1d1f]">
      {/* ── Apple-style Dark Navbar ── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-8 border-b border-white/[0.08]"
        style={{
          height: '44px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        }}
      >
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center animate-pulse">
              <Activity size={12} className="text-white" />
            </div>
            <span className="font-semibold text-[14px] text-white tracking-tight">Glide HIMS</span>
          </div>
          <div className="flex items-center gap-6 text-[12px] text-[#d2d2d7] font-normal">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <button
              onClick={() => navigate('/system/login')}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-[11px] font-medium transition-all"
            >
              Admin Login
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden bg-[#1d1d1f] text-white py-24 md:py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            The Operating System for <br className="hidden sm:block" /> Modern Healthcare
          </h2>
          <p className="text-lg md:text-xl text-[#86868b] max-w-2xl mx-auto mb-10 leading-relaxed">
            A comprehensive, offline-first Healthcare Information Management System built specifically for clinics, hospitals, and medical centers in Uganda and East Africa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {registrationAllowed && (
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white text-base font-medium rounded-full hover:bg-blue-500 active:scale-[0.98] transition-all"
              >
                Register Your Facility
                <ArrowRight size={18} />
              </button>
            )}
            <button
              onClick={() => navigate('/system/login')}
              className="inline-flex items-center justify-center px-8 py-3.5 bg-transparent text-[#0071e3] text-base font-medium rounded-full border border-[#0071e3] hover:bg-[#0071e3] hover:text-white active:scale-[0.98] transition-all"
            >
              Access Admin Portal
            </button>
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className="py-20 md:py-28 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-3xl font-bold text-center tracking-tight mb-4">Enterprise Healthcare Modules</h3>
          <p className="text-center text-[#86868b] max-w-xl mx-auto mb-16">
            Digitize your medical facility workflow, improve clinical efficiency, and secure patient data.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#f5f5f7] p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-6">
                <Stethoscope className="text-blue-600" size={24} />
              </div>
              <h4 className="text-xl font-semibold mb-3">Clinical Workflow</h4>
              <p className="text-sm text-[#86868b] leading-relaxed">
                Complete OPD/IPD workflow, triage logs, doctor notes, treatment plans, and digital prescriptions.
              </p>
            </div>
            <div className="bg-[#f5f5f7] p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mb-6">
                <Activity className="text-purple-600" size={24} />
              </div>
              <h4 className="text-xl font-semibold mb-3">Laboratory &amp; Pharmacy</h4>
              <p className="text-sm text-[#86868b] leading-relaxed">
                Send orders directly to lab and pharmacy. Track test sample diagnostics and coordinate inventory.
              </p>
            </div>
            <div className="bg-[#f5f5f7] p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-6">
                <Shield className="text-emerald-600" size={24} />
              </div>
              <h4 className="text-xl font-semibold mb-3">Billing &amp; Insurance</h4>
              <p className="text-sm text-[#86868b] leading-relaxed">
                Automated invoicing, cashier queues, and integrated claims processing for 12+ regional insurance schemes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing Plans ── */}
      <section id="pricing" className="py-20 md:py-28 px-6 bg-[#f5f5f7]">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-3xl font-bold text-center tracking-tight mb-4">Pricing Plans</h3>
          <p className="text-center text-[#86868b] max-w-xl mx-auto mb-16">
            Pick the plan that fits your facility size. All billing is processed locally in Ugandan Shillings.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <div className="bg-white p-8 rounded-2xl border border-gray-200 flex flex-col justify-between shadow-sm">
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Starter</h4>
                <p className="text-xs text-[#86868b] mb-6">For small clinics and health centers</p>
                <div className="mb-6">
                  <span className="text-3xl font-extrabold">UGX 500,000</span>
                  <span className="text-xs text-[#86868b] ml-1">/ month</span>
                </div>
                <ul className="space-y-3 text-xs text-gray-600 mb-8 border-t border-gray-100 pt-6">
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> Patient Registration &amp; Records</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> OPD Management</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> Pharmacy Module</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> Basic Billing</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> Up to 5 users</li>
                </ul>
              </div>
              <button
                onClick={() => navigate('/register')}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-full text-xs transition-colors"
              >
                Get Started
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-white p-8 rounded-2xl border-2 border-blue-500 relative flex flex-col justify-between shadow-md">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full">
                Most Popular
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Professional</h4>
                <p className="text-xs text-[#86868b] mb-6">For hospitals with full departments</p>
                <div className="mb-6">
                  <span className="text-3xl font-extrabold">UGX 1,500,000</span>
                  <span className="text-xs text-[#86868b] ml-1">/ month</span>
                </div>
                <ul className="space-y-3 text-xs text-gray-600 mb-8 border-t border-gray-100 pt-6">
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> IPD &amp; Emergency Triage</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> Laboratory &amp; Radiology</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> Surgery &amp; Theater</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> Maternity &amp; Antenatal Care</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> Insurance Claims (12 providers)</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> Up to 50 users</li>
                </ul>
              </div>
              <button
                onClick={() => navigate('/register')}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-full text-xs transition-colors shadow-sm"
              >
                Start Free Trial
              </button>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white p-8 rounded-2xl border border-gray-200 flex flex-col justify-between shadow-sm">
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Enterprise</h4>
                <p className="text-xs text-[#86868b] mb-6">For networks and government sites</p>
                <div className="mb-6">
                  <span className="text-3xl font-extrabold">Custom</span>
                  <span className="text-xs text-[#86868b] ml-1">Pricing</span>
                </div>
                <ul className="space-y-3 text-xs text-gray-600 mb-8 border-t border-gray-100 pt-6">
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> Multi-facility management</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> Executive dashboards</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> Offline-first server architecture</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> Unlimited users &amp; custom config</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-blue-600" /> Dedicated account manager</li>
                </ul>
              </div>
              <a
                href="https://itsolutionsuganda.com/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-full text-xs block"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#1d1d1f] text-[#86868b] px-8 py-12 text-center text-xs">
        <p className="mb-4">&copy; 2026 Glide HIMS. All rights reserved.</p>
        <p className="space-x-3 text-white/60">
          <a href="https://itsolutionsuganda.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Marketing Site</a>
          <span>·</span>
          <a href="https://itsolutionsuganda.com/pricing" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Pricing</a>
          <span>·</span>
          <a href="https://itsolutionsuganda.com/contact" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Contact Sales</a>
        </p>
      </footer>
    </div>
  );
};

export default PublicLandingPage;

