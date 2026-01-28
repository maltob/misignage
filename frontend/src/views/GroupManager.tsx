import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, Plus, Trash2, FolderPlus } from 'lucide-react';

const GroupManager: React.FC = () => {
    const [groups, setGroups] = useState<any[]>([]);
    const [newGroupName, setNewGroupName] = useState('');

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const res = await axios.get('/api/groups');
            setGroups(res.data);
        } catch (err) { }
    };

    const createGroup = async () => {
        if (!newGroupName) return;
        try {
            await axios.post('/api/groups', { name: newGroupName });
            setNewGroupName('');
            fetchGroups();
        } catch (err) { }
    };

    const deleteGroup = async (id: number) => {
        if (!confirm("Delete this group?")) return;
        try {
            await axios.delete(`/api/groups/${id}`);
            fetchGroups();
        } catch (err) { }
    };

    return (
        <div className="space-y-12">
            <div>
                <h3 className="text-2xl font-bold text-white mb-1 text-premium-glow">Display Groups</h3>
                <p className="text-slate-400">Organize your screens and content by location or department</p>
            </div>

            <div className="flex gap-4">
                <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="E.g. Lobby Screens, Staff Room..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-500 transition-all"
                />
                <button
                    onClick={createGroup}
                    className="btn-primary flex items-center gap-2 px-8"
                >
                    <Plus size={20} />
                    Create Group
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map(group => (
                    <div key={group.id} className="glass-card p-6 group hover:border-indigo-500/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                                    <Users size={20} />
                                </div>
                                <h4 className="font-bold text-white text-lg">{group.name}</h4>
                            </div>
                            <button
                                onClick={() => deleteGroup(group.id)}
                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                        <div className="text-sm text-slate-500 font-medium">
                            {group.displays?.length || 0} Displays • {group.playlists?.length || 0} Playlists
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GroupManager;
