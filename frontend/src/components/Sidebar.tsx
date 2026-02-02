import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Monitor,
    Layers,
    PlaySquare,
    Calendar,
    Users,
    Settings,
    LogOut,
    HardDrive,
    Terminal,
    UserCheck,
    Code,
    Key,
    FileText,
    Globe,
    Sun,
    Moon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Sidebar: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    const mainItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: t('common.dashboard'), path: '/' },
        { id: 'displays', icon: Monitor, label: t('common.displays'), path: '/displays' },
        { id: 'groups', icon: Users, label: t('common.groups'), path: '/groups' },
        { id: 'slides', icon: Layers, label: t('common.slides'), path: '/slides' },
        { id: 'playlists', icon: PlaySquare, label: t('common.playlists'), path: '/playlists' },
        { id: 'schedules', icon: Calendar, label: t('common.schedules'), path: '/schedules' },
    ];

    const adminItems = [
        { id: 'storage', icon: HardDrive, label: t('common.storage'), path: '/storage' },
        { id: 'templates', icon: Code, label: t('common.templates'), path: '/templates' },
        { id: 'users', icon: UserCheck, label: t('common.users'), path: '/users' },
        { id: 'settings', icon: Settings, label: t('common.settings'), path: '/settings' },
        { id: 'logs', icon: Terminal, label: t('common.logs'), path: '/logs' },
        { id: 'apikeys', icon: Key, label: t('common.apikeys'), path: '/apikeys' },
        { id: 'docs', icon: FileText, label: t('common.docs'), path: 'external', url: '/docs' },
    ];

    const renderItem = (item: any) => (
        item.path === 'external' ? (
            <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-indigo-500"
            >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
            </a>
        ) : (
            <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                        : 'text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-indigo-500'
                    }`
                }
            >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
            </NavLink>
        )
    );

    return (
        <aside className="w-64 h-screen glass-card m-4 mr-0 p-4 flex flex-col transition-all duration-300" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
            <div className="flex items-center justify-between px-2 mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">M</div>
                    <h1 className="text-xl font-black tracking-tight text-[var(--text-main)] uppercase">miSignage</h1>
                </div>
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg bg-[var(--sidebar-hover)] hover:bg-[var(--border-subtle)] text-slate-400 hover:text-indigo-500 transition-all"
                    title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                >
                    {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto pr-2 custom-scrollbar">
                {mainItems.map(renderItem)}
                {user?.role === 'admin' && (
                    <>
                        <div className="px-3 pt-6 pb-2 text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60">
                            {t('common.administration')}
                        </div>
                        {adminItems.map(renderItem)}
                    </>
                )}
            </nav>

            <div className="mt-auto border-t border-[var(--border-subtle)] pt-4 space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 text-slate-400 bg-[var(--sidebar-hover)] rounded-lg border border-[var(--border-subtle)]">
                    <Globe size={14} />
                    <select
                        value={i18n.language}
                        onChange={(e) => changeLanguage(e.target.value)}
                        className="bg-transparent text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer flex-1"
                    >
                        <option value="en" className="bg-[var(--bg-card)] text-[var(--text-main)]">English</option>
                        <option value="it" className="bg-[var(--bg-card)] text-[var(--text-main)]">Italiano</option>
                        <option value="de" className="bg-[var(--bg-card)] text-[var(--text-main)]">Deutsch</option>
                        <option value="es" className="bg-[var(--bg-card)] text-[var(--text-main)]">Español</option>
                        <option value="ru" className="bg-[var(--bg-card)] text-[var(--text-main)]">Русский</option>
                    </select>
                </div>

                <button
                    onClick={() => {
                        localStorage.removeItem('token');
                        window.location.href = '/login';
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all font-bold uppercase tracking-widest text-[10px]"
                >
                    <LogOut size={16} />
                    <span>{t('common.logout')}</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
