import React, { useState } from 'react';
import axios from 'axios';
import { X, PlaySquare, Plus, Trash2 } from 'lucide-react';

interface PlaylistCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const PlaylistCreationModal: React.FC<PlaylistCreationModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/playlists', { name }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            onSuccess();
            onClose();
            setName('');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create playlist');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="modal-card w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-900/50">
                    <div>
                        <h3 className="text-xl font-bold text-white">Create New Playlist</h3>
                        <p className="text-xs text-slate-400 mt-1">A collection of slides played in sequence</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-slate-800/20">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-300 ml-1">Playlist Identity</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400 group-focus-within:bg-indigo-500 group-focus-within:text-white transition-all">
                                <PlaySquare size={16} />
                            </div>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full input-field py-3.5 pl-14 pr-4 text-lg font-bold border-2"
                                placeholder="e.g. Morning Commercials"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-shake">
                            <X size={16} /> {error}
                        </div>
                    )}

                    <div className="flex gap-4 pt-6 border-t border-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3.5 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all text-sm uppercase tracking-widest"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex-[1.5] py-3.5 rounded-xl btn-primary shadow-xl shadow-indigo-500/20 font-black text-sm uppercase tracking-widest disabled:opacity-50 transition-all ${loading ? 'cursor-not-allowed' : 'hover:scale-[1.02]'}`}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    <span>Creating...</span>
                                </div>
                            ) : (
                                <span>Initialize Playlist</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PlaylistCreationModal;
