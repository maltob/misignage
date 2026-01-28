import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Calendar, Clock, Target, PlaySquare } from 'lucide-react';

interface ScheduleCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editSchedule?: any;
}

const ScheduleCreationModal: React.FC<ScheduleCreationModalProps> = ({ isOpen, onClose, onSuccess, editSchedule }) => {
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [displays, setDisplays] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [selection, setSelection] = useState({
        playlist_id: '',
        display_ids: [] as number[],
        group_ids: [] as number[],
        start_time: '00:00',
        end_time: '23:59',
        days_mask: 127,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchOptions();
            if (editSchedule) {
                setSelection({
                    playlist_id: editSchedule.playlist_id.toString(),
                    display_ids: editSchedule.displays?.map((d: any) => d.id) || [],
                    group_ids: editSchedule.groups?.map((g: any) => g.id) || [],
                    start_time: editSchedule.start_time,
                    end_time: editSchedule.end_time,
                    days_mask: editSchedule.days_of_week,
                });
            } else {
                setSelection({
                    playlist_id: '',
                    display_ids: [],
                    group_ids: [],
                    start_time: '00:00',
                    end_time: '23:59',
                    days_mask: 127,
                });
            }
        }
    }, [isOpen, editSchedule]);

    const fetchOptions = async () => {
        try {
            const [plist, dlist, glist] = await Promise.all([
                axios.get('/api/playlists'),
                axios.get('/api/displays'),
                axios.get('/api/groups')
            ]);
            setPlaylists(plist.data);
            setDisplays(dlist.data);
            setGroups(glist.data);
        } catch (err) {
            console.error("Failed to fetch options", err);
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const data = {
                playlist_id: parseInt(selection.playlist_id),
                display_ids: selection.display_ids,
                group_ids: selection.group_ids,
                start_time: selection.start_time,
                end_time: selection.end_time,
                days_of_week: selection.days_mask,
            };

            if (editSchedule) {
                await axios.put(`/api/schedules/${editSchedule.id}`, data);
            } else {
                await axios.post('/api/schedules', data);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create schedule');
        } finally {
            setLoading(false);
        }
    };

    const toggleDay = (dayIndex: number) => {
        setSelection(prev => ({
            ...prev,
            days_mask: prev.days_mask ^ (1 << dayIndex)
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="modal-card w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-900/50">
                    <div>
                        <h3 className="text-xl font-bold text-white">
                            {editSchedule ? 'Edit Schedule Strategy' : 'Program New Schedule'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">Assign playlists to displays and groups with precise timing</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8 bg-slate-800/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {/* Column 1: Playlist & Timing */}
                        <div className="space-y-8">
                            <div className="space-y-6">
                                <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400 border-b border-white/5 pb-2">
                                    <PlaySquare size={14} /> Content & Cycle
                                </h4>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-300 ml-1">Assigned Playlist</label>
                                    <select
                                        value={selection.playlist_id}
                                        onChange={(e) => setSelection({ ...selection, playlist_id: e.target.value })}
                                        className="w-full input-field font-bold bg-slate-900 border-2"
                                        required
                                    >
                                        <option value="" className="bg-slate-900">Choose a playlist...</option>
                                        {playlists.map(p => (
                                            <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Starts At</label>
                                        <div className="relative">
                                            <input
                                                type="time"
                                                value={selection.start_time}
                                                onChange={(e) => setSelection({ ...selection, start_time: e.target.value })}
                                                className="w-full input-field font-bold text-center"
                                                required
                                            />
                                            <Clock size={14} className="absolute right-3 top-3.5 text-slate-500 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ends At</label>
                                        <div className="relative">
                                            <input
                                                type="time"
                                                value={selection.end_time}
                                                onChange={(e) => setSelection({ ...selection, end_time: e.target.value })}
                                                className="w-full input-field font-bold text-center"
                                                required
                                            />
                                            <Clock size={14} className="absolute right-3 top-3.5 text-slate-500 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Active Weekdays</label>
                                <div className="flex gap-2">
                                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => toggleDay(i)}
                                            className={`flex-1 h-12 rounded-xl font-black transition-all border-2 ${selection.days_mask & (1 << i)
                                                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                                                : 'bg-slate-900 border-white/5 text-slate-500 hover:border-white/10'
                                                }`}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[9px] text-slate-500 italic text-center">Highlight days when this schedule should be active</p>
                            </div>
                        </div>

                        {/* Column 2: Target Selection */}
                        <div className="space-y-6">
                            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400 border-b border-white/5 pb-2">
                                <Target size={14} /> Target Audience
                            </h4>

                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end mb-1">
                                        <label className="text-sm font-semibold text-slate-300 ml-1">Target Groups</label>
                                        <span className="text-[10px] text-slate-500 uppercase font-bold">{selection.group_ids.length} Selected</span>
                                    </div>
                                    <select
                                        multiple
                                        value={selection.group_ids.map(String)}
                                        onChange={(e) => setSelection({
                                            ...selection,
                                            group_ids: Array.from(e.target.selectedOptions, option => parseInt(option.value))
                                        })}
                                        className="w-full input-field font-semibold h-44 bg-slate-900 custom-scrollbar border-2"
                                    >
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id} className="p-3 my-1 rounded-lg checked:bg-indigo-600 cursor-pointer">{g.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-end mb-1">
                                        <label className="text-sm font-semibold text-slate-300 ml-1">Individual Displays</label>
                                        <span className="text-[10px] text-slate-500 uppercase font-bold">{selection.display_ids.length} Included</span>
                                    </div>
                                    <select
                                        multiple
                                        value={selection.display_ids.map(String)}
                                        onChange={(e) => setSelection({
                                            ...selection,
                                            display_ids: Array.from(e.target.selectedOptions, option => parseInt(option.value))
                                        })}
                                        className="w-full input-field font-semibold h-44 bg-slate-900 custom-scrollbar border-2"
                                    >
                                        {displays.map(d => (
                                            <option key={d.id} value={d.id} className="p-3 my-1 rounded-lg checked:bg-indigo-600 cursor-pointer">{d.name || `Unit #${d.id}`}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-500 italic">Optional overrides for specific hardware units</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                            <X size={16} /> {error}
                        </div>
                    )}

                    <div className="flex gap-4 pt-10 border-t border-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-8 py-4 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all text-sm uppercase tracking-widest"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex-[1.5] py-4 rounded-xl btn-primary shadow-xl shadow-indigo-500/20 font-black text-sm uppercase tracking-widest disabled:opacity-50 transition-all ${loading ? 'cursor-not-allowed opacity-70' : 'hover:scale-[1.02]'}`}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    <span>Syncing Strategy...</span>
                                </div>
                            ) : (
                                <span>{editSchedule ? 'Save Changes' : 'Propagate Schedule'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ScheduleCreationModal;
