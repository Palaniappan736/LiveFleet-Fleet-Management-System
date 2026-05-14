import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSystemMode } from '../context/SystemModeContext';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { login, logout } = useAuth();
  const { setMode } = useSystemMode();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await login(email, password);
      const role  = response?.user?.role || 'manager';
      const token = response?.token || '';
      // Auto-detect fleet mode: demo tokens start with 'demo-', real JWTs don't
      setMode(token.startsWith('demo-') ? 'demo' : 'real');
      navigate(role === 'student' ? '/student-dashboard' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[radial-gradient(1200px_600px_at_10%_-10%,#d1fae5_0%,transparent_60%),radial-gradient(1200px_600px_at_90%_-10%,#fde68a_0%,transparent_55%),#f7f4ef]">
      <div className="bg-white/90 backdrop-blur rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">LF</div>
          <h2 className="text-2xl font-bold mt-3">LiveFleet</h2>
          <p className="text-gray-600 mt-2">Smart Fleet Management System</p>
        </div>

        {/* Demo credential quick-fill cards */}
        <div className="mb-6 grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => { setEmail('manager@college.edu'); setPassword('demo123'); }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-left hover:bg-blue-100 transition"
          >
            <p className="font-semibold text-blue-700">Manager Demo</p>
            <p className="text-gray-600">manager@college.edu</p>
            <p className="text-gray-500">Full fleet access</p>
          </button>
          <button
            type="button"
            onClick={() => { setEmail('student@college.edu'); setPassword('demo123'); }}
            className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-left hover:bg-emerald-100 transition"
          >
            <p className="font-semibold text-emerald-700">Student Demo</p>
            <p className="text-gray-600">student@college.edu</p>
            <p className="text-gray-500">Map &amp; ETA only</p>
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
              placeholder="your@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Demo Credentials</p>
          <p className="mt-2 bg-gray-100 p-2 rounded">
            Student: student@college.edu<br/>
            Fleet Manager: manager@college.edu
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

