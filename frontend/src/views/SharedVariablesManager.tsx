import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Database, Plus, Trash2, Edit2, RotateCw, Check, AlertTriangle, ExternalLink, X, Code, Globe, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SharedVariablesManager: React.FC = () => {
    const { t } = useTranslation();
    const [variables, setVariables] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        value: '',
        source_type: 'manual', // manual, api, webpage
        source_url: '',
        extraction_method: 'text', // text, json
        extraction_config: '',
        refresh_interval: 60
    });
    const [refreshingId, setRefreshingId] = useState<number | null>(null);

    useEffect(() => {
        fetchVariables();
    }, []);

    const fetchVariables = async () => {
        try {
            const res = await axios.get('/api/shared-variables');
            setVariables(res.data);
        } catch (err) { console.error(err); }
    };

    const handleSave = async () => {
        try {
            if (editingId) {
                await axios.put(`/api/shared-variables/${editingId}`, formData);
            } else {
                await axios.post('/api/shared-variables', formData);
            }
            setIsModalOpen(false);
            fetchVariables();
            resetForm();
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('common.confirm_delete'))) return;
        try {
            await axios.delete(`/api/shared-variables/${id}`);
            fetchVariables();
        } catch (err) { console.error(err); }
    };

    const handleRefresh = async (id: number) => {
        setRefreshingId(id);
        try {
            await axios.post(`/api/shared-variables/${id}/refresh`);
            fetchVariables();
        } catch (err) { console.error(err); }
        setRefreshingId(null);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            value: '',
            source_type: 'manual',
            source_url: '',
            extraction_method: 'text',
            extraction_config: '',
            refresh_interval: 60
        });
        setEditingId(null);
    };

    const openEdit = (v: any) => {
        setFormData({
            name: v.name,
            value: v.value,
            source_type: v.source_type,
            source_url: v.source_url,
            extraction_method: v.extraction_method,
            extraction_config: v.extraction_config,
            refresh_interval: v.refresh_interval
        });
        setEditingId(v.id);
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h3 className="text-2xl font-bold text-white mb-1 text-premium-glow">{t('shared_variables.title')}</h3>
                    <p className="text-slate-400">{t('shared_variables.subtitle')}</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="btn-primary flex items-center gap-2 px-6"
                >
                    <Plus size={20} />
                    {t('shared_variables.new_variable')}
                </button>
            </div>

            <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <th className="px-6 py-4">{t('shared_variables.table.name')}</th>
                            <th className="px-6 py-4">{t('shared_variables.table.value')}</th>
                            <th className="px-6 py-4">{t('shared_variables.table.source')}</th>
                            <th className="px-6 py-4">{t('shared_variables.table.last_refreshed')}</th>
                            <th className="px-6 py-4 text-right">{t('shared_variables.table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {variables.map(v => (
                            <tr key={v.id} className="group hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                            <Database size={14} />
                                        </div>
                                        <div>
                                            <span className="font-bold text-white text-sm block">{v.name}</span>
                                            <code className="text-[10px] text-slate-500">{`{{SHARED:${v.name}}}`}</code>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="max-w-xs truncate text-sm text-slate-300 font-mono" title={v.value}>
                                        {v.value}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {v.source_type === 'manual' && <Type size={14} className="text-slate-500" />}
                                        {v.source_type === 'webpage' && <Globe size={14} className="text-blue-400" />}
                                        {v.source_type === 'api' && <Code size={14} className="text-purple-400" />}
                                        <span className="text-xs text-slate-400 capitalize">{v.source_type}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-400">
                                    {v.source_type === 'manual' ? '-' : (
                                        v.last_refreshed ? new Date(v.last_refreshed).toLocaleString() : t('shared_variables.table.never')
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {v.source_type !== 'manual' && (
                                            <button
                                                onClick={() => handleRefresh(v.id)}
                                                disabled={refreshingId === v.id}
                                                className={`p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-all ${refreshingId === v.id ? 'animate-spin text-indigo-400' : ''}`}
                                                title={t('shared_variables.refresh_now')}
                                            >
                                                <RotateCw size={18} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => openEdit(v)}
                                            className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(v.id)}
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                    <div className="modal-card w-full max-w-xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50 text-white">
                            <h4 className="text-xl font-bold">{editingId ? t('shared_variables.modal.edit_title') : t('shared_variables.modal.new_title')}</h4>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-400 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6 bg-slate-800/20 max-h-[80vh] overflow-y-auto">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">{t('shared_variables.modal.name_label')}</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-all"
                                    placeholder="e.g. CurrentUserCount"
                                />
                                <p className="text-xs text-slate-500 ml-1">{t('shared_variables.modal.usage_hint', { code: `{{SHARED:${formData.name || 'Name'}}}` })}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">{t('shared_variables.modal.source_type')}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['manual', 'webpage', 'api'] as const).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setFormData({ ...formData, source_type: type })}
                                            className={`px-4 py-3 rounded-xl border border-white/5 text-sm font-bold capitalize transition-all ${formData.source_type === type ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {formData.source_type === 'manual' ? (
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">{t('shared_variables.modal.value_label')}</label>
                                    <textarea
                                        value={formData.value}
                                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-all min-h-[100px]"
                                        placeholder={t('shared_variables.modal.value_placeholder')}
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">{t('shared_variables.modal.source_url')}</label>
                                        <input
                                            type="text"
                                            value={formData.source_url}
                                            onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-all"
                                            placeholder="https://example.com/api/data"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">{t('shared_variables.modal.extraction_method')}</label>
                                            <select
                                                value={formData.extraction_method}
                                                onChange={(e) => setFormData({ ...formData, extraction_method: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-all appearance-none"
                                            >
                                                <option value="text">Text (Selector)</option>
                                                <option value="json">JSON (Path)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">{t('shared_variables.modal.refresh_interval')}</label>
                                            <input
                                                type="number"
                                                value={formData.refresh_interval}
                                                onChange={(e) => setFormData({ ...formData, refresh_interval: parseInt(e.target.value) || 60 })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">
                                            {formData.extraction_method === 'json' ? t('shared_variables.modal.json_path') : t('shared_variables.modal.css_selector')}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.extraction_config}
                                            onChange={(e) => setFormData({ ...formData, extraction_config: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-all"
                                            placeholder={formData.extraction_method === 'json' ? 'e.g. data.items.0.name' : 'e.g. #content > h1'}
                                        />
                                    </div>
                                </>
                            )}

                            <button
                                onClick={handleSave}
                                disabled={!formData.name}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all mt-4"
                            >
                                {editingId ? t('shared_variables.modal.save_changes') : t('shared_variables.modal.create_variable')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SharedVariablesManager;
