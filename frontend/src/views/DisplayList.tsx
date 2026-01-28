import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Monitor, CheckCircle, XCircle, Clock, Camera, RefreshCw, Trash2 } from 'lucide-react';

interface Display {
    id: number;
    name: string;
    size: string;
    status: string;
    approved: boolean;
    registration_code: string;
    last_seen: string;
    ip_address?: string;
    last_screenshot?: string;
    Organization?: {
        screenshot_interval?: number;
    };
}

const DisplayList: React.FC = () => {
    const [displays, setDisplays] = useState<Display[]>([]);
    const [pendingDisplays, setPendingDisplays] = useState<Display[]>([]);
    const [loading, setLoading] = useState(true);
    const [registrationCode, setRegistrationCode] = useState("");
    const [claiming, setClaiming] = useState(false);
    const [sendingCommand, setSendingCommand] = useState<number | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const [editingDisplay, setEditingDisplay] = useState<Display | null>(null);
    const [newName, setNewName] = useState("");
    const [deletingId, setDeletingId] = useState<number | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [displaysRes, pendingRes] = await Promise.all([
                axios.get('/api/displays'),
                axios.get('/api/displays/pending').catch(() => ({ data: [] }))
            ]);
            setDisplays(displaysRes.data);
            setPendingDisplays(pendingRes.data);
        } catch (err) {
            console.error("Failed to fetch displays", err);
        } finally {
            setLoading(false);
        }
    };

    const claimDisplay = async (e: React.FormEvent) => {
        e.preventDefault();
        setClaiming(true);
        try {
            await axios.post('/api/displays/claim', { code: registrationCode });
            setRegistrationCode("");
            fetchData();
        } catch (err) {
            alert("Invalid registration code or display already claimed.");
        } finally {
            setClaiming(false);
        }
    };

    const sendCommand = async (id: number, command: string) => {
        setSendingCommand(id);
        try {
            await axios.post(`/api/displays/${id}/command`, { command });
        } catch (err) {
            console.error("Failed to send command", err);
        } finally {
            setSendingCommand(null);
        }
    };

    const approveDisplay = async (id: number) => {
        try {
            await axios.post(`/api/displays/${id}/approve`);
            fetchData();
        } catch (err) {
            console.error("Failed to approve display", err);
        }
    };

    const startEditing = (display: Display) => {
        setEditingDisplay(display);
        setNewName(display.name);
    };

    const saveEdit = async () => {
        if (!editingDisplay) return;
        try {
            await axios.put(`/api/displays/${editingDisplay.id}`, { name: newName });
            setEditingDisplay(null);
            fetchData();
        } catch (err) {
            console.error("Failed to update display", err);
            alert("Failed to update display");
        }
    };

    const startDeleting = (id: number) => {
        if (confirm("Are you sure you want to delete this display? This action cannot be undone.")) {
            deleteDisplay(id);
        }
    };

    const deleteDisplay = async (id: number) => {
        setDeletingId(id);
        try {
            await axios.delete(`/api/displays/${id}`);
            fetchData();
        } catch (err) {
            console.error("Failed to delete display", err);
            alert("Failed to delete display");
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) return <div className="text-slate-400">Loading network data...</div>;

    return (
        <div className="space-y-12">
            {/* Header and Linking Form */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Display Network</h3>
                    <p className="text-slate-400">Manage and monitor your screen fleet</p>
                </div>

                <form onSubmit={claimDisplay} className="flex gap-2 w-full md:w-auto">
                    <input
                        type="text"
                        value={registrationCode}
                        onChange={(e) => setRegistrationCode(e.target.value)}
                        placeholder="Enter 6-Digit Code"
                        maxLength={6}
                        className="bg-white/5 border border-white/10 text-white px-4 py-2 rounded-xl focus:outline-none focus:border-indigo-500 transition-all font-mono"
                        required
                    />
                    <button
                        disabled={claiming}
                        className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20"
                    >
                        {claiming ? 'Linking...' : 'Link Display'}
                    </button>
                </form>
            </div>

            {/* Pending / Unclaimed Displays */}
            {pendingDisplays.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-4 text-amber-500">
                        <Monitor size={18} />
                        <h4 className="font-bold uppercase tracking-wider text-sm">Unclaimed Displays Detected</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        {pendingDisplays.map(d => (
                            <div key={d.id} className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                                        <Monitor size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white">{d.name || 'New Device'}</span>
                                            <span className="text-xs bg-white/10 text-slate-400 px-2 py-0.5 rounded-md">ID: {d.id}</span>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                            <span>IP: {d.ip_address || 'Unknown'}</span>
                                            <span>•</span>
                                            <span className="text-amber-500/80 font-mono font-bold tracking-widest">Code: {d.registration_code}</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => approveDisplay(d.id)}
                                    className="bg-amber-500 hover:bg-amber-600 text-black px-4 py-1.5 rounded-lg text-sm font-bold transition-all shadow-lg shadow-amber-500/10"
                                >
                                    Claim & Approve
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Active Displays List */}
            <section>
                <div className="flex items-center gap-2 mb-4 text-slate-400">
                    <Monitor size={18} />
                    <h4 className="font-bold uppercase tracking-wider text-sm">Active Network</h4>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {displays.length === 0 ? (
                        <div className="text-slate-500 italic py-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
                            No active displays in this organization.
                        </div>
                    ) : (
                        displays.map((display) => (
                            <div key={display.id} className="glass-card p-5 flex items-center justify-between group hover:border-indigo-500/50 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${display.status === 'online' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                                        <Monitor size={24} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            {editingDisplay?.id === display.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        value={newName}
                                                        onChange={(e) => setNewName(e.target.value)}
                                                        className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white font-bold"
                                                        autoFocus
                                                    />
                                                    <button onClick={saveEdit} className="text-emerald-500 hover:text-emerald-400"><CheckCircle size={18} /></button>
                                                    <button onClick={() => setEditingDisplay(null)} className="text-red-500 hover:text-red-400"><XCircle size={18} /></button>
                                                </div>
                                            ) : (
                                                <h4 className="font-bold text-white text-lg cursor-pointer hover:text-indigo-400" onClick={() => startEditing(display)}>
                                                    {display.name || 'Unnamed Display'}
                                                    <span className="text-xs text-slate-500 ml-2 opacity-0 group-hover:opacity-100">(Edit)</span>
                                                </h4>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                                            <span className="flex items-center gap-1">
                                                <Clock size={14} />
                                                {display.last_seen ? new Date(display.last_seen).toLocaleString() : 'Never seen'}
                                            </span>
                                            <span>•</span>
                                            <span>{display.size || 'Unknown Size'}</span>
                                            <span>•</span>
                                            <span className="font-mono text-xs opacity-50">{display.ip_address}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    {!display.approved ? (
                                        <button
                                            onClick={() => approveDisplay(display.id)}
                                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold transition-all"
                                        >
                                            Approve
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            {display.last_screenshot && (
                                                <div
                                                    className="w-16 h-10 bg-black/40 rounded-lg overflow-hidden border border-white/10 group-hover:w-32 transition-all cursor-zoom-in relative"
                                                    onClick={() => setSelectedImage(display.last_screenshot || null)}
                                                >
                                                    <img src={display.last_screenshot} className="w-full h-full object-cover" alt="Latest" />
                                                    <div className="absolute inset-0 bg-indigo-500/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                                        <Camera size={14} className="text-white" />
                                                    </div>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => sendCommand(display.id, 'SCREENSHOT')}
                                                disabled={sendingCommand === display.id}
                                                className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                                title="Capture Screenshot"
                                            >
                                                <Camera size={18} />
                                            </button>
                                            <button
                                                onClick={() => sendCommand(display.id, 'REFRESH')}
                                                disabled={sendingCommand === display.id}
                                                className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                                title="Refresh Player"
                                            >
                                                <RefreshCw size={18} />
                                            </button>
                                            <button
                                                onClick={() => sendCommand(display.id, 'RESYNC')}
                                                disabled={sendingCommand === display.id}
                                                className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-bold transition-all"
                                            >
                                                {sendingCommand === display.id ? '...' : 'RE-SYNC'}
                                            </button>
                                            <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full text-sm font-bold">
                                                <CheckCircle size={16} />
                                                Live
                                            </div>

                                            <div className="h-6 w-px bg-white/10 mx-2"></div>

                                            <button
                                                onClick={() => startDeleting(display.id)}
                                                disabled={deletingId === display.id}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                title="Delete Display"
                                            >
                                                {deletingId === display.id ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <Trash2 size={18} />}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* Fullscreen Image Overlay */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in duration-300"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
                        <img
                            src={selectedImage}
                            className="max-w-full max-h-full rounded-2xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-500"
                            alt="Screenshot Full"
                        />
                        <button
                            className="absolute top-0 right-0 p-4 text-white/50 hover:text-white transition-all"
                            onClick={() => setSelectedImage(null)}
                        >
                            <XCircle size={32} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DisplayList;
