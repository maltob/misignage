import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Key, Plus, Trash2, Copy, Check, ShieldAlert, Clock, ExternalLink, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const APIKeyManager: React.FC = () => {
    const { t } = useTranslation();
    const [keys, setKeys] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchKeys();
    }, []);

    const fetchKeys = async () => {
        try {
            const res = await axios.get('/api/apikeys');
            setKeys(res.data);
        } catch (err) { }
    };

    const handleCreate = async () => {
        try {
            const formData = new FormData();
            formData.append('name', newKeyName);
            const res = await axios.post('/api/apikeys', formData);
            setGeneratedKey(res.data.key);
            fetchKeys();
        } catch (err) { }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('apikeys.confirm_revoke'))) return;
        try {
            await axios.delete(`/api/apikeys/${id}`);
            fetchKeys();
        } catch (err) { }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-end">
                <div>
                    <h3 className="text-2xl font-bold text-white mb-1 text-premium-glow">{t('apikeys.title')}</h3>
                    <p className="text-slate-400">{t('apikeys.subtitle')}</p>
                </div>
                <button
                    onClick={() => {
                        setIsModalOpen(true);
                        setGeneratedKey(null);
                        setNewKeyName('');
                    }}
                    className="btn-primary flex items-center gap-2 px-6"
                >
                    <Plus size={20} />
                    {t('apikeys.generate_new')}
                </button>
            </div>

            <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <th className="px-6 py-4">{t('apikeys.table.name')}</th>
                            <th className="px-6 py-4">{t('apikeys.table.prefix')}</th>
                            <th className="px-6 py-4">{t('apikeys.table.last_used')}</th>
                            <th className="px-6 py-4">{t('apikeys.table.created')}</th>
                            <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {keys.map(key => (
                            <tr key={key.id} className="group hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                            <Key size={14} />
                                        </div>
                                        <span className="font-bold text-white uppercase text-sm">{key.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <code className="bg-slate-900 border border-white/5 px-2 py-1 rounded text-xs text-indigo-300">
                                        {key.prefix}...
                                    </code>
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-400">
                                    {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : t('apikeys.never_used')}
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-400">
                                    {new Date(key.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => handleDelete(key.id)}
                                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {keys.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm italic">
                                    {t('apikeys.no_keys')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                    <div className="modal-card w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50 text-white">
                            <h4 className="text-xl font-bold">{t('apikeys.modal.title')}</h4>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-400 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6 bg-slate-800/20">
                            {!generatedKey ? (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">{t('apikeys.modal.description_label')}</label>
                                        <input
                                            type="text"
                                            value={newKeyName}
                                            onChange={(e) => setNewKeyName(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-500 transition-all font-bold"
                                            placeholder={t('apikeys.modal.placeholder')}
                                            autoFocus
                                        />
                                    </div>
                                    <button
                                        onClick={handleCreate}
                                        disabled={!newKeyName}
                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all"
                                    >
                                        {t('apikeys.modal.generate_button')}
                                    </button>
                                </>
                            ) : (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-4 items-start">
                                        <ShieldAlert className="text-amber-500 shrink-0" size={20} />
                                        <p className="text-xs text-amber-200/80 leading-relaxed font-medium">
                                            {t('apikeys.modal.warning')}
                                        </p>
                                    </div>

                                    <div className="relative group">
                                        <div className="w-full bg-slate-950 border border-white/10 rounded-2xl p-6 font-mono text-sm break-all text-indigo-300 pr-16 select-all">
                                            {generatedKey}
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(generatedKey)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/5 hover:bg-indigo-500 text-slate-400 hover:text-white rounded-xl transition-all border border-white/5"
                                        >
                                            {copied ? <Check size={18} /> : <Copy size={18} />}
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest transition-all"
                                    >
                                        {t('apikeys.modal.copy_done')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default APIKeyManager;
