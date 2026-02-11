import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { X, Upload, Globe, Type, Users, Code, Settings2, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SlideCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editSlide?: {
        id: number;
        name: string;
        type: string;
        content: string;
        scale_mode?: string;
        render_webpage?: boolean;
        render_interval?: number;
        render_delay?: number;
        web_script?: string;
        groups?: any[];
    };
}

const PRESET_INTERVALS = [0, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800];
const PRESET_DELAYS = [0, 2, 5, 10, 15, 30, 60];

const SlideCreationModal: React.FC<SlideCreationModalProps> = ({ isOpen, onClose, onSuccess, editSlide }) => {
    const { t } = useTranslation();
    const [type, setType] = useState<'image' | 'video' | 'webpage' | 'table' | 'html' | 'screenshare'>(editSlide?.type as any || 'image');
    const [scaleMode, setScaleMode] = useState<'cover' | 'contain'>(editSlide?.scale_mode as any || 'contain');
    const [name, setName] = useState(editSlide?.name || '');
    const [content, setContent] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [renderWebpage, setRenderWebpage] = useState(editSlide?.render_webpage || false);
    const [renderInterval, setRenderInterval] = useState(editSlide?.render_interval || 0);
    const [renderDelay, setRenderDelay] = useState(editSlide?.render_delay || 0);
    const [webScript, setWebScript] = useState(editSlide?.web_script || '');
    const [groups, setGroups] = useState<any[]>([]);
    const [targetGroupIds, setTargetGroupIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [templates, setTemplates] = useState<any[]>([]);
    const [htmlData, setHtmlData] = useState({
        html: '',
        css: '',
        js: '',
        variables: {} as any
    });
    const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js'>('html');

    const formatInterval = (seconds: number) => {
        if (seconds === 0) return t('modals.slide_creation.manual_only');
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        return `${Math.floor(seconds / 3600)}h`;
    };

    useEffect(() => {
        if (isOpen) {
            fetchGroups();
            fetchTemplates();
            if (editSlide) {
                setType(editSlide.type as any);
                setScaleMode(editSlide.scale_mode as any || 'contain');
                setName(editSlide.name || '');
                setRenderWebpage(editSlide.render_webpage || false);
                setRenderInterval(editSlide.render_interval || 0);
                setRenderDelay(editSlide.render_delay || 0);
                setWebScript(editSlide.web_script || '');
                setTargetGroupIds(editSlide.groups?.map(g => g.id) || []);

                if (editSlide.type === 'html') {
                    try {
                        const data = JSON.parse(editSlide.content);
                        setHtmlData({
                            html: data.html || '',
                            css: data.css || '',
                            js: data.js || '',
                            variables: data.variables || {}
                        });
                    } catch (e) { }
                } else if (editSlide.type === 'webpage' || editSlide.type === 'table') {
                    try {
                        const data = JSON.parse(editSlide.content);
                        setContent(data.url || editSlide.content);
                    } catch (e) {
                        setContent(editSlide.content);
                    }
                }
            } else {
                setType('image');
                setName('');
                setContent('');
                setFile(null);
                setHtmlData({ html: '', css: '', js: '', variables: {} });
                setTargetGroupIds([]);
            }
        }
    }, [isOpen, editSlide, t]);

    const fetchGroups = async () => {
        try {
            const res = await axios.get('/api/groups');
            setGroups(res.data);
        } catch (err) { }
    };

    const fetchTemplates = async () => {
        try {
            const res = await axios.get('/api/templates');
            setTemplates(res.data);
        } catch (err) { }
    };

    const handleTemplateSelect = (templateId: string) => {
        const template = templates.find(t => t.id.toString() === templateId);
        if (template) {
            const vars: any = {};
            try {
                const schema = JSON.parse(template.variables || '[]');
                schema.forEach((v: any) => {
                    vars[v.name] = v.default || '';
                });
            } catch (e) { }

            setHtmlData({
                html: template.html,
                css: template.css,
                js: template.js,
                variables: vars
            });
        }
    };

    const previewDoc = useMemo(() => {
        let finalHtml = htmlData.html;
        Object.keys(htmlData.variables || {}).forEach(key => {
            finalHtml = finalHtml.replaceAll(`{{${key}}}`, htmlData.variables[key]);
        });

        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body, html { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background: transparent; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; }
                        ${htmlData.css}
                    </style>
                </head>
                <body>
                    ${finalHtml}
                    <script>
                        (function() {
                            try {
                                const CONFIG = ${JSON.stringify(htmlData.variables || {})};
                                ${htmlData.js}
                            } catch (e) {
                                console.error("JS Error:", e);
                            }
                        })();
                    </script>
                </body>
            </html>
        `;
    }, [htmlData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('type', type);
        formData.append('name', name);
        formData.append('scale_mode', scaleMode);

        if (targetGroupIds.length > 0) {
            targetGroupIds.forEach(id => formData.append('group_ids[]', id.toString()));
        } else if (editSlide) {
            formData.append('group_ids_cleared', 'true');
        }

        if (type === 'html') {
            formData.append('content', JSON.stringify(htmlData));
        } else if (type === 'image' || type === 'video') {
            if (!file && !editSlide) {
                setError(t('modals.slide_creation.choose_file'));
                setLoading(false);
                return;
            }
            if (file) formData.append('file', file);
        } else {
            formData.append('content', content);
            if (type === 'webpage') {
                formData.append('render_webpage', String(renderWebpage));
                formData.append('render_interval', String(renderInterval));
                formData.append('render_delay', String(renderDelay));
                formData.append('web_script', webScript);
                formData.append('web_script', webScript);
            }
        }

        try {
            if (editSlide) {
                await axios.put(`/api/slides/${editSlide.id}`, formData);
            } else {
                await axios.post('/api/slides', formData);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || t('modals.slide_creation.op_failed'));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="modal-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200" style={{ backgroundColor: 'var(--bg-modal)' }}>
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)] bg-[var(--sidebar-hover)]">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--text-main)]">{editSlide ? t('modals.slide_creation.edit_title') : t('modals.slide_creation.create_title')}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--border-subtle)] text-slate-500 hover:text-[var(--text-main)] transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-transparent">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                            <X size={16} /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400"><Type size={14} /> {t('modals.slide_creation.basic_info')}</h4>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[var(--text-muted)]">{t('modals.slide_creation.name_label')}</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full input-field font-bold text-lg bg-[var(--input-bg)] border-2 border-[var(--border-subtle)] text-[var(--text-main)]" required />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[var(--text-muted)]">{t('modals.slide_creation.asset_type')}</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'image', icon: Upload, label: t('slides.types.image') },
                                        { id: 'video', icon: Upload, label: t('slides.types.video') },
                                        { id: 'webpage', icon: Globe, label: t('slides.types.webpage') },
                                        { id: 'html', icon: Code, label: 'HTML' },
                                        { id: 'screenshare', icon: Monitor, label: t('slides.types.screenshare') }
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setType(item.id as any)}
                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${type === item.id ? 'border-indigo-500 bg-indigo-500/20 text-[var(--text-main)]' : 'border-[var(--border-subtle)] bg-[var(--sidebar-hover)] text-slate-400 hover:border-indigo-500/30'}`}
                                        >
                                            <item.icon size={18} />
                                            <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400"><Globe size={14} /> {t('modals.slide_creation.content_config')}</h4>

                            {type === 'html' ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-[var(--text-muted)]">{t('modals.slide_creation.start_template')}</label>
                                        <select
                                            onChange={(e) => handleTemplateSelect(e.target.value)}
                                            className="w-full input-field bg-[var(--input-bg)] border-2 border-[var(--border-subtle)] text-[var(--text-main)]"
                                            defaultValue=""
                                        >
                                            <option value="" disabled className="bg-[var(--bg-card)]">{t('modals.slide_creation.template_placeholder')}</option>
                                            {templates.map(t => <option key={t.id} value={t.id} className="bg-[var(--bg-card)]">{t.name}</option>)}
                                        </select>
                                    </div>

                                    {/* Dynamic Variable Form */}
                                    <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">{t('modals.slide_creation.template_vars')}</label>
                                        {Object.keys(htmlData.variables).length === 0 && <p className="text-xs text-slate-600 italic">{t('modals.slide_creation.no_vars')}</p>}
                                        {Object.keys(htmlData.variables).map(key => (
                                            <div key={key} className="space-y-1">
                                                <label className="text-xs font-bold text-slate-400">{key}</label>
                                                <input
                                                    type="text"
                                                    value={htmlData.variables[key]}
                                                    onChange={(e) => setHtmlData({
                                                        ...htmlData,
                                                        variables: { ...htmlData.variables, [key]: e.target.value }
                                                    })}
                                                    className="w-full input-field py-2 text-sm"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-2 pt-4 border-t border-[var(--border-subtle)]">
                                        <button
                                            type="button"
                                            onClick={() => setIsCodeEditorOpen(true)}
                                            className="w-full py-3 bg-[var(--bg-main)] hover:bg-[var(--sidebar-hover)] border border-[var(--border-subtle)] rounded-xl text-xs font-black uppercase tracking-widest text-indigo-400 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Code size={14} />
                                            {t('modals.slide_creation.advanced_editor_btn')}
                                        </button>
                                    </div>
                                </div>
                            ) : (type === 'image' || type === 'video') ? (
                                <div className="relative h-40 border-2 border-dashed border-[var(--border-subtle)] rounded-2xl flex flex-col items-center justify-center bg-[var(--sidebar-hover)] overflow-hidden">
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                                    <Upload size={24} className="text-slate-500 mb-2" />
                                    <span className="text-sm text-slate-400 font-bold">{file ? file.name : t('modals.slide_creation.choose_file')}</span>
                                </div>
                            ) : type === 'screenshare' ? (
                                <div className="space-y-4">
                                    <div className="p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex flex-col items-center gap-4 text-center">
                                        <Monitor size={48} className="text-indigo-400" />
                                        <div>
                                            <p className="text-sm font-bold text-[var(--text-main)]">{t('modals.slide_creation.screenshare_title')}</p>
                                            <p className="text-xs text-slate-500 mt-1">{t('modals.slide_creation.screenshare_desc')}</p>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-[var(--sidebar-hover)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-[var(--text-main)]">{t('modals.slide_creation.oidc_label')}</span>
                                            <span className="text-[10px] text-slate-500 uppercase tracking-tighter">{t('modals.slide_creation.oidc_desc')}</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 accent-indigo-500"
                                        // We could add an oidc_required field to the Slide model if needed
                                        />
                                    </div>
                                </div>
                            ) : type === 'webpage' ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-[var(--text-muted)]">{t('slides.url_label')}</label>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-[var(--sidebar-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-slate-500">
                                                <Globe size={18} />
                                            </div>
                                            <input
                                                type="url"
                                                value={content}
                                                onChange={(e) => setContent(e.target.value)}
                                                className="flex-1 input-field font-mono text-sm"
                                                placeholder="https://example.com"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="p-4 bg-[var(--sidebar-hover)] rounded-xl border border-[var(--border-subtle)] space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-[var(--text-main)]">{t('slides.render_options.use_proxy')}</span>
                                                <span className="text-[10px] text-slate-500 uppercase tracking-tighter">{t('slides.render_options.proxy_desc')}</span>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={renderWebpage} onChange={(e) => setRenderWebpage(e.target.checked)} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                            </label>
                                        </div>

                                        {renderWebpage && (
                                            <>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('slides.render_options.interval')}</label>
                                                        <select
                                                            value={renderInterval}
                                                            onChange={(e) => setRenderInterval(Number(e.target.value))}
                                                            className="w-full input-field text-sm"
                                                        >
                                                            {PRESET_INTERVALS.map(sec => (
                                                                <option key={sec} value={sec}>{formatInterval(sec)}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('slides.render_options.delay')}</label>
                                                        <select
                                                            value={renderDelay}
                                                            onChange={(e) => setRenderDelay(Number(e.target.value))}
                                                            className="w-full input-field text-sm"
                                                        >
                                                            {PRESET_DELAYS.map(sec => (
                                                                <option key={sec} value={sec}>{sec}s</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>



                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('slides.render_options.script')}</label>
                                                    <textarea
                                                        value={webScript}
                                                        onChange={(e) => setWebScript(e.target.value)}
                                                        className="w-full input-field font-mono text-xs min-h-[80px]"
                                                        placeholder="// JavaScript to run on page load..."
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-[var(--text-muted)]">{t('modals.slide_creation.content_label')}</label>
                                    <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full input-field font-mono text-sm min-h-[150px]" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-[var(--border-subtle)]">
                        <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400"><Users size={14} /> {t('modals.slide_creation.assigned_groups')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                            {groups.map(g => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => setTargetGroupIds(targetGroupIds.includes(g.id) ? targetGroupIds.filter(id => id !== g.id) : [...targetGroupIds, g.id])}
                                    className={`p-3 rounded-xl border transition-all text-xs font-bold uppercase tracking-wider ${targetGroupIds.includes(g.id) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[var(--sidebar-hover)] border-[var(--border-subtle)] text-slate-500 hover:border-indigo-500/30'}`}
                                >
                                    {g.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </form>

                <div className="p-6 border-t border-[var(--border-subtle)] bg-[var(--sidebar-hover)] flex gap-4">
                    <button type="button" onClick={onClose} className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-[var(--text-main)] transition-all">{t('common.cancel')}</button>
                    <button onClick={handleSubmit} disabled={loading} className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all">
                        {loading ? t('modals.slide_creation.processing') : (editSlide ? t('modals.slide_creation.edit_title') : t('modals.slide_creation.create_title'))}
                    </button>
                </div>
            </div>

            {isCodeEditorOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 bg-black/95 backdrop-blur-xl">
                    <div className="modal-card w-full max-w-[99vw] h-full max-h-full flex flex-col overflow-hidden animate-in zoom-in duration-200 border border-[var(--border-subtle)]" style={{ backgroundColor: 'var(--bg-modal)' }}>
                        <div className="p-4 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--sidebar-hover)] text-[var(--text-main)]">
                            <div className="flex items-center gap-3">
                                <Code size={20} className="text-indigo-400" />
                                <h4 className="text-xl font-bold">{t('modals.slide_creation.advanced_title')}</h4>
                                <span className="px-3 py-1 bg-[var(--bg-tag)] rounded-lg text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] border border-[var(--border-subtle)]">{t('modals.slide_creation.preview_mode')}</span>
                            </div>
                            <button onClick={() => setIsCodeEditorOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Editor Side */}
                            <div className="w-1/2 flex flex-col border-r border-[var(--border-subtle)]">
                                <div className="flex border-b border-[var(--border-subtle)] bg-[var(--sidebar-hover)]">
                                    {(['html', 'css', 'js'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            type="button"
                                            onClick={() => setActiveTab(tab)}
                                            className={`px-8 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? 'text-indigo-400 bg-indigo-500/5' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                                        >
                                            {tab.toUpperCase()}
                                            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500"></div>}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex-1 relative bg-slate-950/20">
                                    <textarea
                                        value={(htmlData as any)[activeTab]}
                                        onChange={(e) => setHtmlData({ ...htmlData, [activeTab]: e.target.value })}
                                        className="w-full h-full bg-transparent p-6 outline-none font-mono text-base resize-none text-[var(--text-main)] leading-relaxed scrollbar-none"
                                        spellCheck={false}
                                        placeholder={t('templates.modal.editor_placeholder', { type: activeTab.toUpperCase() })}
                                    />
                                </div>
                            </div>

                            {/* Preview Side */}
                            <div className="w-1/2 bg-black flex flex-col">
                                <div className="p-3 bg-[var(--sidebar-hover)] border-b border-[var(--border-subtle)] flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        <Monitor size={12} className="text-emerald-500" />
                                        {t('modals.slide_creation.live_render')}
                                    </div>
                                    <div className="text-[10px] text-slate-600 font-bold">{t('modals.slide_creation.vars_injected')}</div>
                                </div>
                                <div className="flex-1 relative">
                                    <iframe
                                        title="Slide Preview"
                                        srcDoc={previewDoc}
                                        className="w-full h-full border-0 absolute inset-0"
                                        sandbox="allow-scripts"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-[var(--sidebar-hover)] border-t border-[var(--border-subtle)] flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsCodeEditorOpen(false)}
                                className="px-10 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all"
                            >
                                {t('modals.slide_creation.done_apply')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SlideCreationModal;
