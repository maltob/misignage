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
    Terminal
} from 'lucide-react';

const Sidebar: React.FC = () => {
    const menuItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { id: 'displays', icon: Monitor, label: 'Displays', path: '/displays' },
        { id: 'slides', icon: Layers, label: 'Slides', path: '/slides' },
        { id: 'playlists', icon: PlaySquare, label: 'Playlists', path: '/playlists' },
        { id: 'schedules', icon: Calendar, label: 'Schedules', path: '/schedules' },
        { id: 'storage', icon: HardDrive, label: 'Storage', path: '/storage' },
        { id: 'users', icon: Users, label: 'Users', path: '/users' },
        { id: 'settings', icon: Settings, label: 'Settings', path: '/settings' },
        { id: 'logs', icon: Terminal, label: 'Logs', path: '/logs' },
    ];

    return (
        <aside className="w-64 h-screen glass-card m-4 mr-0 p-4 flex flex-col">
            <div className="flex items-center gap-3 px-2 mb-8">
                <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold">M</div>
                <h1 className="text-xl font-bold tracking-tight">miSignage</h1>
            </div>

            <nav className="flex-1 space-y-1">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.id}
                        to={item.path}
                        className={({ isActive }) =>
                            `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive
                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            }`
                        }
                    >
                        <item.icon size={20} />
                        <span className="font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="mt-auto border-t border-white/5 pt-4">
                <button
                    onClick={() => {
                        localStorage.removeItem('token');
                        window.location.href = '/login';
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all font-bold uppercase tracking-widest text-[10px]"
                >
                    <LogOut size={16} />
                    <span>Logout System</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
