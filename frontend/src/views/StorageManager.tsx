import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { HardDrive, Trash2, ShieldCheck, AlertCircle, RefreshCw, Layers } from 'lucide-react';

interface FileInfo {
    name: string;
    size: number;
    is_used: boolean;
    url: string;
}

const StorageManager: React.FC = () => {
    const [files, setFiles] = useState<FileInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [cleaning, setCleaning] = useState(false);

    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/storage');
            setFiles(res.data);
        } catch (err) {
            console.error("Failed to fetch storage info", err);
        } finally {
            setLoading(false);
        }
    };

    const deleteFile = async (name: string) => {
        if (!confirm(`Are you sure you want to permanently delete ${name}?`)) return;
        try {
            await axios.delete(`/api/storage/${name}`);
            fetchFiles();
        } catch (err) {
            alert("Failed to delete file");
        }
    };

    const runCleanup = async () => {
        if (!confirm("This will delete all files NOT currently used by any slide or screenshot. Continue?")) return;
        setCleaning(true);
        try {
            const res = await axios.post('/api/storage/cleanup');
            alert(`Cleanup complete! Deleted ${res.data.deleted_count} orphaned files.`);
            fetchFiles();
        } catch (err) {
            alert("Cleanup failed");
        } finally {
            setCleaning(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    const unusedFiles = files.filter(f => !f.is_used);
    const unusedSize = unusedFiles.reduce((acc, f) => acc + f.size, 0);

    if (loading && files.length === 0) return <div className="text-slate-400">Loading storage statistics...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Storage Management</h3>
                    <p className="text-slate-400 text-sm italic">Monitor and clean up media assets on the server</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchFiles}
                        className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-all"
                        title="Refresh list"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={runCleanup}
                        disabled={cleaning || unusedFiles.length === 0}
                        className="btn-primary bg-amber-500 hover:bg-amber-600 flex items-center gap-2"
                    >
                        <Layers size={18} />
                        Clean All Unused ({unusedFiles.length})
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 border-l-4 border-indigo-500">
                    <div className="flex items-center gap-4 text-slate-500 mb-2">
                        <HardDrive size={20} />
                        <span className="text-xs font-bold uppercase tracking-widest">Total Usage</span>
                    </div>
                    <div className="text-3xl font-black text-white">{formatSize(totalSize)}</div>
                    <p className="text-[10px] text-slate-500 mt-2">{files.length} files tracked</p>
                </div>
                <div className="glass-card p-6 border-l-4 border-emerald-500">
                    <div className="flex items-center gap-4 text-slate-500 mb-2">
                        <ShieldCheck size={20} />
                        <span className="text-xs font-bold uppercase tracking-widest">Active Assets</span>
                    </div>
                    <div className="text-3xl font-black text-white">{formatSize(totalSize - unusedSize)}</div>
                    <p className="text-[10px] text-slate-500 mt-2">{files.length - unusedFiles.length} files in use</p>
                </div>
                <div className="glass-card p-6 border-l-4 border-amber-500">
                    <div className="flex items-center gap-4 text-slate-500 mb-2">
                        <AlertCircle size={20} />
                        <span className="text-xs font-bold uppercase tracking-widest">Orphaned Files</span>
                    </div>
                    <div className="text-3xl font-black text-white">{formatSize(unusedSize)}</div>
                    <p className="text-[10px] text-slate-500 mt-2">Can be safely purged</p>
                </div>
            </div>

            {/* File List */}
            <div className="glass-card overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Filename</th>
                            <th className="px-6 py-4">Size</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {files.map((file) => (
                            <tr key={file.name} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4">
                                    {file.is_used ? (
                                        <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-bold uppercase">
                                            <ShieldCheck size={14} />
                                            Used
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-amber-500 text-[10px] font-bold uppercase">
                                            <AlertCircle size={14} />
                                            Orphan
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-white font-medium text-sm truncate max-w-xs" title={file.name}>
                                            {file.name}
                                        </span>
                                        <a href={file.url} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-400 hover:underline">
                                            Preview Link
                                        </a>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-400 text-sm font-mono">
                                    {formatSize(file.size)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => deleteFile(file.name)}
                                        className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                        title="Delete Permanently"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {files.length === 0 && (
                    <div className="text-center py-20 text-slate-600 italic">No files found in storage</div>
                )}
            </div>
        </div>
    );
};

export default StorageManager;
