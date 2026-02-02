import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
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
import TemplateManager from './views/TemplateManager';
import APIKeyManager from './views/APIKeyManager';
import ContributorShare from './views/ContributorShare';
import PublicPlaylistView from './views/PublicPlaylistView';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

const App: React.FC = () => {
    return (
        <ThemeProvider>
            <AuthProvider>
                <HashRouter>
                    <AppContent />
                </HashRouter>
            </AuthProvider>
        </ThemeProvider>
    );
};

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { t } = useTranslation();
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
        if (!path) return t('common.dashboard');
        // Check if we have a translation for this common key
        const translation = t(`common.${path}`, { defaultValue: path.charAt(0).toUpperCase() + path.slice(1) });
        return translation;
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
        <div className="flex h-screen bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden transition-colors duration-300">
            <Sidebar />

            <main className="flex-1 overflow-auto p-8">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--text-main)] tracking-tight capitalize">{getTitle()}</h2>
                        <p className="text-slate-500 text-sm font-medium">{t('dashboard.subtitle')}</p>
                    </div>

                    <div className="flex gap-4">
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {[
                        { label: t('dashboard.stats.total_displays'), value: stats.total_displays, color: 'indigo' },
                        { label: t('dashboard.stats.active_playlists'), value: stats.active_playlists, color: 'emerald' },
                        { label: t('dashboard.stats.total_slides'), value: stats.total_slides, color: 'sky' },
                        { label: t('dashboard.stats.reports_today'), value: stats.reports_today, color: 'amber' },
                    ].map((stat, i) => (
                        <div key={i} className="glass-card p-6 border-l-4 border-indigo-500/50" style={{ backgroundColor: 'var(--bg-card)' }}>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{stat.label}</p>
                            <p className="text-3xl font-black mt-1 text-[var(--text-main)]">{stat.value}</p>
                        </div>
                    ))}
                </div>

                <section className="glass-card p-8 min-h-[500px] border border-[var(--border-subtle)]" style={{ backgroundColor: 'var(--bg-card)' }}>
                    {children}
                </section>
            </main>
        </div>
    );
};

const AppContent: React.FC = () => {
    const { t } = useTranslation();
    const { isAuthenticated } = useAuth();

    return (
        <Routes>
            <Route path="/player" element={<Player />} />
            <Route path="/share" element={<ContributorShare />} />
            <Route path="/public/:slug" element={<PublicPlaylistView />} />
            <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />

            <Route path="/" element={<DashboardLayout>
                <div className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-[var(--border-subtle)] rounded-3xl text-center bg-[var(--sidebar-hover)]">
                    <p className="font-bold text-lg text-[var(--text-main)] opacity-80">{t('dashboard.welcome')}</p>
                    <p className="text-sm text-slate-500">{t('dashboard.select_module')}</p>
                </div>
            </DashboardLayout>} />

            <Route path="/displays" element={<DashboardLayout><DisplayList /></DashboardLayout>} />
            <Route path="/slides" element={<DashboardLayout><SlideManager /></DashboardLayout>} />
            <Route path="/playlists" element={<DashboardLayout><PlaylistManager /></DashboardLayout>} />
            <Route path="/groups" element={<DashboardLayout><GroupManager /></DashboardLayout>} />
            <Route path="/schedules" element={<DashboardLayout><ScheduleManager /></DashboardLayout>} />
            <Route path="/storage" element={<DashboardLayout><StorageManager /></DashboardLayout>} />
            <Route path="/templates" element={<DashboardLayout><TemplateManager /></DashboardLayout>} />
            <Route path="/apikeys" element={<DashboardLayout><APIKeyManager /></DashboardLayout>} />
            <Route path="/users" element={<DashboardLayout><UserManager /></DashboardLayout>} />
            <Route path="/settings" element={<DashboardLayout><SettingsManager /></DashboardLayout>} />
            <Route path="/logs" element={<DashboardLayout><SystemLogs /></DashboardLayout>} />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default App;
