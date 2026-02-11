import React, { useState } from 'react';
import axios from 'axios';
import { X, PlaySquare, Plus, Trash2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PlaylistCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const PlaylistCreationModal: React.FC<PlaylistCreationModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [groups, setGroups] = useState<any[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    React.useEffect(() => {
        if (isOpen) {
            fetchGroups();
        }
    }, [isOpen]);

    const fetchGroups = async () => {
        try {
            const res = await axios.get('/api/groups');
            setGroups(res.data);
        } catch (err) {
            console.error("Failed to fetch groups", err);
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('name', name);
            if (selectedGroups.length > 0) {
                selectedGroups.forEach(id => formData.append('group_ids[]', id.toString()));
            }

            await axios.post('/api/playlists', formData);
            onSuccess();
            onClose();
            setName('');
            setSelectedGroups([]);
        } catch (err: any) {
            setError(err.response?.data?.error || t('modals.playlist_creation.fail_message'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="modal-card w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200" style={{ backgroundColor: 'var(--bg-modal)' }}>
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)] bg-[var(--sidebar-hover)]">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--text-main)]">{t('modals.playlist_creation.title')}</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{t('modals.playlist_creation.subtitle')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--border-subtle)] text-slate-500 hover:text-[var(--text-main)] transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-transparent">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[var(--text-muted)] ml-1">{t('modals.playlist_creation.identity_label')}</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400 group-focus-within:bg-indigo-500 group-focus-within:text-white transition-all">
                                <PlaySquare size={16} />
                            </div>
                            <input
                                type="text"
                                name="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full input-field py-3.5 pl-16 pr-4 text-lg font-bold border-2"
                                placeholder={t('modals.playlist_creation.identity_placeholder')}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">{t('modals.playlist_creation.assigned_groups')}</label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            {groups.map(g => (
                                <label key={g.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${selectedGroups.includes(g.id) ? 'bg-indigo-500/10 border-indigo-500/30 text-[var(--text-main)]' : 'bg-[var(--sidebar-hover)] border-[var(--border-subtle)] text-slate-500 hover:border-indigo-500/30'}`}>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={selectedGroups.includes(g.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedGroups([...selectedGroups, g.id]);
                                            else setSelectedGroups(selectedGroups.filter(id => id !== g.id));
                                        }}
                                    />
                                    <Users size={14} className={selectedGroups.includes(g.id) ? 'text-indigo-400' : 'text-slate-600'} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider truncate">{g.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-shake">
                            <X size={16} /> {error}
                        </div>
                    )}

                    <div className="flex gap-4 pt-6 border-t border-[var(--border-subtle)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-main)] font-bold hover:bg-[var(--sidebar-hover)] transition-all text-sm uppercase tracking-widest"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex-[1.5] py-3.5 rounded-xl btn-primary shadow-xl shadow-indigo-500/20 font-black text-sm uppercase tracking-widest disabled:opacity-50 transition-all ${loading ? 'cursor-not-allowed' : 'hover:scale-[1.02]'}`}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    <span>{t('modals.playlist_creation.creating_button')}</span>
                                </div>
                            ) : (
                                <span>{t('modals.playlist_creation.init_button')}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PlaylistCreationModal;
