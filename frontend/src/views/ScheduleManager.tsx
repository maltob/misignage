import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Calendar, Plus, Clock, Target, Edit2, Trash2 } from 'lucide-react';
import ScheduleCreationModal from '../components/ScheduleCreationModal';

interface Schedule {
    id: number;
    playlist_id: number;
    playlist?: any;
    displays: any[];
    groups: any[];
    start_date?: string;
    end_date?: string;
    start_time: string;
    end_time: string;
    days_of_week: number;
}

const ScheduleManager: React.FC = () => {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSchedules();
    }, []);

    const fetchSchedules = async () => {
        try {
            const res = await axios.get('/api/schedules');
            setSchedules(res.data);
        } catch (err) {
            console.error("Failed to fetch schedules", err);
        } finally {
            setLoading(false);
        }
    };

    const deleteSchedule = async (id: number) => {
        if (!confirm("Delete this schedule?")) return;
        try {
            await axios.delete(`/api/schedules/${id}`);
            fetchSchedules();
        } catch (err) { }
    };

    const openEdit = (schedule: Schedule) => {
        setEditingSchedule(schedule);
        setIsModalOpen(true);
    };

    const handleClose = () => {
        setIsModalOpen(false);
        setEditingSchedule(null);
    };

    const getDays = (mask: number) => {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        return days.filter((_, i) => mask & (1 << i)).join(', ') || 'None';
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Schedules</h3>
                <button
                    onClick={() => { setEditingSchedule(null); setIsModalOpen(true); }}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus size={18} />
                    New Schedule
                </button>
            </div>

            <ScheduleCreationModal
                isOpen={isModalOpen}
                onClose={handleClose}
                onSuccess={fetchSchedules}
                editSchedule={editingSchedule}
            />

            <div className="grid grid-cols-1 gap-4">
                {schedules.length === 0 ? (
                    <div className="text-slate-500 italic py-8 text-center border-2 border-dashed border-white/5 rounded-xl">
                        No active schedules.
                    </div>
                ) : (
                    schedules.map((schedule) => (
                        <div key={schedule.id} className="glass-card p-5 group hover:border-indigo-500/30 transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <Calendar className="text-indigo-400" size={24} />
                                    <div>
                                        <h4 className="font-bold text-white">Broadcast Schedule</h4>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Playlist: <span className="text-white font-bold">{schedule.playlist?.name || 'Unknown'}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openEdit(schedule)}
                                        className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => deleteSchedule(schedule.id)}
                                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/5 rounded-lg text-slate-400">
                                        <Clock size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Time range</p>
                                        <p className="text-sm font-medium text-slate-300">{schedule.start_time} - {schedule.end_time}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/5 rounded-lg text-slate-400">
                                        <Calendar size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Active Days</p>
                                        <p className="text-sm font-medium text-slate-300">{getDays(schedule.days_of_week)}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/5 rounded-lg text-slate-400">
                                        <Target size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Targeting</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {schedule.groups?.map(g => (
                                                <span key={g.id} className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded">Group: {g.name}</span>
                                            ))}
                                            {schedule.displays?.map(d => (
                                                <span key={d.id} className="text-[10px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded">Display: {d.name}</span>
                                            ))}
                                            {(!schedule.groups?.length && !schedule.displays?.length) && (
                                                <span className="text-[10px] bg-slate-500/10 text-slate-400 px-1.5 py-0.5 rounded italic">Global Broadcast</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ScheduleManager;
