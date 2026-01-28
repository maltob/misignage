import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DisplayList from './views/DisplayList';
import SlideManager from './views/SlideManager';
import PlaylistManager from './views/PlaylistManager';
import GroupManager from './views/GroupManager';
import ScheduleManager from './views/ScheduleManager';
import Login from './views/Login';
import Player from './views/Player';
import StorageManager from './views/StorageManager';
import UserManager from './views/UserManager';
import SettingsManager from './views/SettingsManager';
import SystemLogs from './views/SystemLogs';
import { AuthProvider, useAuth } from './context/AuthContext';

const App: React.FC = () => {
    return (
        <AuthProvider>
            <HashRouter>
                <AppContent />
            </HashRouter>
        </AuthProvider>
    );
};

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const location = useLocation();
    const [stats, setStats] = useState({
        total_displays: 0,
        active_playlists: 0,
        total_slides: 0,
        reports_today: 0
    });

    const getTitle = () => {
        const path = location.pathname.split('/')[1];
        if (!path) return 'Dashboard';
        return path.charAt(0).toUpperCase() + path.slice(1);
    };

    useEffect(() => {
        if (isAuthenticated) {
            axios.get('/api/dashboard/stats')
                .then(res => setStats(res.data))
                .catch(err => console.error("Failed to fetch stats", err));
        }
    }, [isAuthenticated, location.pathname]);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex h-screen bg-[#0f172a] text-slate-200 overflow-hidden">
            <Sidebar />

            <main className="flex-1 overflow-auto p-8">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight capitalize">{getTitle()}</h2>
                        <p className="text-slate-400 text-sm">Manage your digital signage network</p>
                    </div>

                    <div className="flex gap-4">
                        <button className="btn-primary px-6 h-10 text-xs font-bold uppercase tracking-widest">
                            Quick Action
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {[
                        { label: 'Total Displays', value: stats.total_displays, color: 'indigo' },
                        { label: 'Active Playlists', value: stats.active_playlists, color: 'emerald' },
                        { label: 'Total Slides', value: stats.total_slides, color: 'sky' },
                        { label: 'Reports Today', value: stats.reports_today, color: 'amber' },
                    ].map((stat, i) => (
                        <div key={i} className="glass-card p-6 border-l-4 border-indigo-500/50">
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{stat.label}</p>
                            <p className="text-3xl font-black mt-1 text-white">{stat.value}</p>
                        </div>
                    ))}
                </div>

                <section className="glass-card p-8 min-h-[500px] border border-white/5">
                    {children}
                </section>
            </main>
        </div>
    );
};

const AppContent: React.FC = () => {
    const { isAuthenticated } = useAuth();

    return (
        <Routes>
            <Route path="/player" element={<Player />} />
            <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />

            <Route path="/" element={<DashboardLayout>
                <div className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-white/5 rounded-3xl text-center bg-white/[0.02]">
                    <p className="font-bold text-lg text-slate-300">Welcome to miSignage</p>
                    <p className="text-sm">Select a module from the sidebar to begin managing your fleet.</p>
                </div>
            </DashboardLayout>} />

            <Route path="/displays" element={<DashboardLayout><DisplayList /></DashboardLayout>} />
            <Route path="/slides" element={<DashboardLayout><SlideManager /></DashboardLayout>} />
            <Route path="/playlists" element={<DashboardLayout><PlaylistManager /></DashboardLayout>} />
            <Route path="/groups" element={<DashboardLayout><GroupManager /></DashboardLayout>} />
            <Route path="/schedules" element={<DashboardLayout><ScheduleManager /></DashboardLayout>} />
            <Route path="/storage" element={<DashboardLayout><StorageManager /></DashboardLayout>} />
            <Route path="/users" element={<DashboardLayout><UserManager /></DashboardLayout>} />
            <Route path="/settings" element={<DashboardLayout><SettingsManager /></DashboardLayout>} />
            <Route path="/logs" element={<DashboardLayout><SystemLogs /></DashboardLayout>} />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default App;
