import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, Plus, Trash2, Monitor, PlaySquare, ChevronRight, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const GroupManager: React.FC = () => {
    const { t } = useTranslation();
    const [groups, setGroups] = useState<any[]>([]);
    const [displays, setDisplays] = useState<any[]>([]);
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);

    useEffect(() => {
        fetchGroups();
        fetchDisplays();
        fetchPlaylists();
    }, []);

    // Keep selectedGroup in sync with groups list to reflect association changes immediately
    useEffect(() => {
        if (isManageModalOpen && selectedGroup) {
            const updated = groups.find(g => g.id === selectedGroup.id);
            if (updated) setSelectedGroup(updated);
        }
    }, [groups]);

    const fetchGroups = async () => {
        try {
            const res = await axios.get('/api/groups');
            setGroups(res.data);
        } catch (err) { }
    };

    const fetchDisplays = async () => {
        try {
            const res = await axios.get('/api/displays');
            setDisplays(res.data);
        } catch (err) { }
    };

    const fetchPlaylists = async () => {
        try {
            const res = await axios.get('/api/playlists');
            setPlaylists(res.data);
        } catch (err) { }
    };

    const createGroup = async () => {
        if (!newGroupName) return;
        try {
            await axios.post('/api/groups', { name: newGroupName });
            setNewGroupName('');
            fetchGroups();
        } catch (err) {
            console.error("Failed to create group", err);
            alert("Failed to create group");
        }
    };

    const deleteGroup = async (id: number) => {
        if (!confirm(t('groups.confirm_delete'))) return;
        try {
            await axios.delete(`/api/groups/${id}`);
            fetchGroups();
        } catch (err) { }
    };

    const toggleAssociation = async (groupId: number, type: string, id: number, isAssociated: boolean) => {
        try {
            if (isAssociated) {
                await axios.post(`/api/groups/${groupId}/remove`, { type, id });
            } else {
                await axios.post(`/api/groups/${groupId}/add`, { type, id });
            }
            fetchGroups();
        } catch (err) {
            console.error("Failed to toggle association", err);
        }
    };

    return (
        <div className="space-y-12">
            <div>
                <h3 className="text-2xl font-bold text-[var(--text-main)] mb-1 text-premium-glow">{t('groups.title')}</h3>
                <p className="text-slate-400">{t('groups.subtitle')}</p>
            </div>

            <div className="flex gap-4">
                <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder={t('groups.placeholder')}
                    className="flex-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl px-6 py-4 text-[var(--text-main)] outline-none focus:border-indigo-500 transition-all font-bold"
                />
                <button
                    onClick={createGroup}
                    className="btn-primary flex items-center gap-2 px-8"
                >
                    <Plus size={20} />
                    {t('groups.create')}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map(group => (
                    <div key={group.id} className="glass-card p-6 group hover:border-indigo-500/30 transition-all cursor-pointer" style={{ backgroundColor: 'var(--bg-card)' }} onClick={() => { setSelectedGroup(group); setIsManageModalOpen(true); }}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                                    <Users size={20} />
                                </div>
                                <h4 className="font-bold text-[var(--text-main)] text-lg">{group.name}</h4>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteGroup(group.id); }}
                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                        <div className="flex justify-between items-end">
                            <div className="text-sm text-slate-500 font-medium">
                                {group.displays?.length || 0} {t('common.displays')} â€¢ {group.playlists?.length || 0} {t('common.playlists')}
                            </div>
                            <div className="p-2 bg-white/5 rounded-lg text-slate-500 group-hover:text-indigo-400 transition-colors">
                                <ChevronRight size={18} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Manage Associations Modal */}
            {isManageModalOpen && selectedGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                    <div className="modal-card w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--bg-card)]">
                            <div>
                                <h4 className="text-xl font-bold text-[var(--text-main)]">{selectedGroup.name}</h4>
                                <p className="text-xs text-slate-400 mt-1">{t('groups.manage_subtitle')}</p>
                            </div>
                            <button onClick={() => setIsManageModalOpen(false)} className="p-2 hover:bg-[var(--sidebar-hover)] rounded-full text-slate-400 hover:text-[var(--text-main)] transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            {/* Displays Section */}
                            <div className="space-y-4">
                                <h5 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400">
                                    <Monitor size={14} /> {t('groups.link_displays')}
                                </h5>
                                <div className="grid grid-cols-2 gap-3">
                                    {displays.map(display => {
                                        const isAssociated = selectedGroup.displays?.some((d: any) => d.id === display.id);
                                        return (
                                            <div
                                                key={display.id}
                                                onClick={() => toggleAssociation(selectedGroup.id, 'display', display.id, isAssociated)}
                                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer group/item ${isAssociated ? 'bg-indigo-500/10 border-indigo-500/30 text-[var(--text-main)]' : 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-slate-500 hover:border-indigo-500/30'}`}
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isAssociated ? 'bg-indigo-500 text-white font-bold' : 'bg-[var(--sidebar-hover)] text-slate-600 group-hover/item:bg-[var(--border-subtle)]'}`}>
                                                    <Monitor size={18} />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[10px] font-black uppercase tracking-widest truncate">{display.name || t('groups.unnamed_screen')}</span>
                                                    <span className="text-[10px] opacity-60 font-mono truncate">{display.ip_address || t('groups.no_ip')}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Playlists Section */}
                            <div className="space-y-4">
                                <h5 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-400">
                                    <PlaySquare size={14} /> {t('groups.link_playlists')}
                                </h5>
                                <div className="grid grid-cols-2 gap-3">
                                    {playlists.map(playlist => {
                                        const isAssociated = selectedGroup.playlists?.some((p: any) => p.id === playlist.id);
                                        return (
                                            <div
                                                key={playlist.id}
                                                onClick={() => toggleAssociation(selectedGroup.id, 'playlist', playlist.id, isAssociated)}
                                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer group/item ${isAssociated ? 'bg-emerald-500/10 border-emerald-500/30 text-[var(--text-main)]' : 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-slate-500 hover:border-emerald-500/30'}`}
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isAssociated ? 'bg-emerald-500 text-white font-bold' : 'bg-[var(--sidebar-hover)] text-slate-600 group-hover/item:bg-[var(--border-subtle)]'}`}>
                                                    <PlaySquare size={18} />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[10px] font-black uppercase tracking-widest truncate">{playlist.name}</span>
                                                    <span className="text-[10px] opacity-60 font-bold tracking-tighter uppercase">{playlist.slides?.length || 0} {t('common.slides')}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-card)]">
                            <button onClick={() => setIsManageModalOpen(false)} className="w-full py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-400 hover:text-[var(--text-main)] hover:bg-[var(--sidebar-hover)] rounded-2xl transition-all border border-[var(--border-subtle)]">
                                {t('groups.close_management')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupManager;
