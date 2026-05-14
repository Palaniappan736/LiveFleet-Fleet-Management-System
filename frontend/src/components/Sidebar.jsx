// Sidebar navigation component
import React from 'react';
import { Link } from 'react-router-dom';

export default function Sidebar({ mobileOpen, onMobileClose }) {
  return (
    <aside className={`${mobileOpen ? 'block' : 'hidden'} lg:block lg:w-64 bg-slate-900 text-white min-h-screen fixed lg:static z-40`}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-8">LiveFleet</h1>
        <nav className="space-y-2">
          <Link to="/dashboard" className="block p-3 rounded-lg hover:bg-slate-800">Dashboard</Link>
          <Link to="/vehicles" className="block p-3 rounded-lg hover:bg-slate-800">Vehicles</Link>
          <Link to="/alerts" className="block p-3 rounded-lg hover:bg-slate-800">Alerts</Link>
          <Link to="/reports" className="block p-3 rounded-lg hover:bg-slate-800">Reports</Link>
          <Link to="/settings" className="block p-3 rounded-lg hover:bg-slate-800">Settings</Link>
        </nav>
      </div>
      {mobileOpen && <button onClick={onMobileClose} className="fixed inset-0 bg-black/50"></button>}
    </aside>
  );
}
