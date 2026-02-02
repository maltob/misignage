import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Layout, Plus, Trash2, Code, Settings2, Save, X, Eye, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const TemplateManager: React.FC = () => {
    const { t } = useTranslation();
    const [templates, setTemplates] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        html: '',
        css: '',
        js: '',
        variables: '[]' // JSON array of {name, label, type, default}
    });

    const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js' | 'variables'>('html');

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await axios.get('/api/templates');
            setTemplates(res.data);
        } catch (err) { }
    };

    const handleSave = async () => {
        try {
            if (editingTemplate) {
                await axios.delete(`/api/templates/${editingTemplate.id}`);
            }
            await axios.post('/api/templates', formData);
            setIsModalOpen(false);
            setEditingTemplate(null);
            setFormData({ name: '', html: '', css: '', js: '', variables: '[]' });
            fetchTemplates();
        } catch (err) { }
    };

    const deleteTemplate = async (id: number) => {
        if (!confirm(t('templates.confirm_delete'))) return;
        try {
            await axios.delete(`/api/templates/${id}`);
            fetchTemplates();
        } catch (err) { }
    };

    const previewDoc = useMemo(() => {
        let vars: any = {};
        try {
            const schema = JSON.parse(formData.variables || '[]');
            schema.forEach((v: any) => {
                vars[v.name] = v.default || '';
            });
        } catch (e) { }

        let finalHtml = formData.html;
        Object.keys(vars).forEach(key => {
            finalHtml = finalHtml.replaceAll(`{{${key}}}`, vars[key]);
        });

        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body, html { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background: transparent; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; }
                        ${formData.css}
                    </style>
                </head>
                <body>
                    ${finalHtml}
                    <script>
                        (function() {
                            try {
                                const CONFIG = ${JSON.stringify(vars)};
                                ${formData.js}
                            } catch (e) {
                                console.error("JS Error:", e);
                            }
                        })();
                    </script>
                </body>
            </html>
        `;
    }, [formData]);

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-end">
                <div>
                    <h3 className="text-2xl font-bold text-white mb-1 text-premium-glow">{t('templates.title')}</h3>
                    <p className="text-slate-400">{t('templates.subtitle')}</p>
                </div>
                <button
                    onClick={() => {
                        setEditingTemplate(null);
                        setFormData({ name: '', html: '<h1>{{text}}</h1>', css: 'h1 { color: #6366f1; font-size: 5rem; }', js: '', variables: '[\n  {"name": "text", "label": "Heading Text", "type": "text", "default": "Hello World"}\n]' });
                        setIsModalOpen(true);
                    }}
                    className="btn-primary flex items-center gap-2 px-6"
                >
                    <Plus size={20} />
                    {t('templates.new_button')}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map(template => (
                    <div key={template.id} className="glass-card p-6 group hover:border-indigo-500/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                                    <Code size={20} />
                                </div>
                                <h4 className="font-bold text-white text-lg">{template.name}</h4>
                            </div>
                            <button
                                onClick={() => deleteTemplate(template.id)}
                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setEditingTemplate(template);
                                    setFormData({
                                        name: template.name,
                                        html: template.html,
                                        css: template.css,
                                        js: template.js,
                                        variables: template.variables
                                    });
                                    setIsModalOpen(true);
                                }}
                                className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider border border-white/5 transition-all"
                            >
                                {t('templates.edit_button')}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-slate-900/90 backdrop-blur-md">
                    <div className="modal-card w-full max-w-[95vw] h-full max-h-full flex flex-col overflow-hidden animate-in zoom-in duration-200 border border-white/10 shadow-2xl">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400">
                                    <Code size={18} />
                                </div>
                                <h4 className="text-xl font-bold text-white">
                                    {editingTemplate ? t('templates.modal.edit_title') : t('templates.modal.new_title')}
                                </h4>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="ml-4 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 transition-all font-bold text-sm min-w-[300px]"
                                    placeholder={t('templates.modal.name_placeholder')}
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-500/20 transition-all flex items-center gap-2">
                                    <Save size={16} />
                                    {t('templates.modal.save_button')}
                                </button>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-all">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Editor Pane */}
                            <div className="w-1/2 flex flex-col border-r border-white/5 bg-slate-900/20">
                                <div className="flex border-b border-white/5 bg-slate-900/30">
                                    {(['html', 'css', 'js', 'variables'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            type="button"
                                            onClick={() => setActiveTab(tab)}
                                            className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? 'text-indigo-400 bg-indigo-500/5' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            {tab === 'variables' ? t('templates.modal.tabs.variables') : t(`templates.modal.tabs.${tab}`)}
                                            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500"></div>}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex-1 p-0 relative">
                                    <textarea
                                        value={(formData as any)[activeTab]}
                                        onChange={(e) => setFormData({ ...formData, [activeTab]: e.target.value })}
                                        className="w-full h-full bg-slate-950/30 p-6 text-slate-300 font-mono text-sm border-none outline-none resize-none leading-relaxed"
                                        spellCheck={false}
                                        placeholder={t('templates.modal.editor_placeholder', { type: activeTab.toUpperCase() })}
                                    />
                                </div>
                            </div>

                            {/* Preview Pane */}
                            <div className="w-1/2 bg-[#020617] relative flex flex-col">
                                <div className="p-3 bg-slate-900/50 border-b border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        <Monitor size={12} className="text-indigo-500" />
                                        {t('templates.modal.preview_title')}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-600">{t('templates.modal.preview_scale')}</div>
                                </div>
                                <div className="flex-1 relative overflow-hidden bg-black">
                                    <iframe
                                        title="Template Preview"
                                        srcDoc={previewDoc}
                                        className="w-full h-full border-0 absolute inset-0"
                                        sandbox="allow-scripts"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemplateManager;
