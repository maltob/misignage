import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface SystemLog {
    id: number;
    created_at: string;
    source: string;
    level: string;
    message: string;
    slide_id?: number;
    user_id?: number;
    action?: string;
    entity?: string;
    entity_id?: number;
    ip_address?: string;
}

const SystemLogs: React.FC = () => {
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterSource, setFilterSource] = useState('');
    const [filterLevel, setFilterLevel] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterSource) params.append('source', filterSource);
            if (filterLevel) params.append('level', filterLevel);

            const res = await axios.get(`/api/logs?${params.toString()}`);
            setLogs(res.data);
        } catch (err) {
            console.error("Failed to fetch logs", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 10000); // Auto-refresh every 10s
        return () => clearInterval(interval);
    }, [filterSource, filterLevel]);

    const getLevelColor = (level: string) => {
        switch (level.toLowerCase()) {
            case 'error': return 'text-red-400 bg-red-400/10';
            case 'debug': return 'text-sky-400 bg-sky-400/10';
            case 'info': return 'text-emerald-400 bg-emerald-400/10';
            default: return 'text-slate-400 bg-slate-400/10';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
                <div className="flex gap-4">
                    <select
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value)}
                        className="bg-[#1e293b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All Sources</option>
                        <option value="worker">Worker</option>
                        <option value="burp">Burp</option>
                        <option value="api">API</option>
                        <option value="audit">Audit</option>
                    </select>

                    <select
                        value={filterLevel}
                        onChange={(e) => setFilterLevel(e.target.value)}
                        className="bg-[#1e293b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All Levels</option>
                        <option value="info">Info</option>
                        <option value="debug">Debug</option>
                        <option value="error">Error</option>
                    </select>
                </div>

                <button
                    onClick={fetchLogs}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    title="Refresh Logs"
                >
                    <svg className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-white/5">
                            <th className="px-4 py-3">Timestamp</th>
                            {filterSource === 'audit' && <th className="px-4 py-3">Actor</th>}
                            <th className="px-4 py-3">Source</th>
                            {filterSource === 'audit' ? <th className="px-4 py-3">Action</th> : <th className="px-4 py-3">Level</th>}
                            <th className="px-4 py-3">Message</th>
                            {filterSource !== 'audit' && <th className="px-4 py-3 text-right">Slide</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap font-mono">
                                    {new Date(log.created_at).toLocaleString()}
                                </td>
                                {filterSource === 'audit' && (
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-300">{log.user_id ? `User #${log.user_id}` : 'System'}</span>
                                            <span className="text-[10px] text-slate-500 font-mono">{log.ip_address}</span>
                                        </div>
                                    </td>
                                )}
                                <td className="px-4 py-3">
                                    <span className="text-sm font-medium text-slate-300 capitalize">{log.source}</span>
                                </td>
                                <td className="px-4 py-3">
                                    {filterSource === 'audit' ? (
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-indigo-400">{log.action}</span>
                                            <span className="text-[10px] text-slate-500">{log.entity} #{log.entity_id}</span>
                                        </div>
                                    ) : (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getLevelColor(log.level)}`}>
                                            {log.level}
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="text-sm text-slate-300 max-w-xl truncate group-hover:whitespace-normal group-hover:break-words">
                                        {log.message}
                                    </div>
                                </td>
                                {filterSource !== 'audit' && (
                                    <td className="px-4 py-3 text-right text-xs text-indigo-400">
                                        {log.slide_id ? `#${log.slide_id}` : ''}
                                    </td>
                                )}
                            </tr>
                        ))}
                        {logs.length === 0 && !loading && (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-slate-500 italic">
                                    No logs found for the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SystemLogs;
