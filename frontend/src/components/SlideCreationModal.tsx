import React, { useState } from 'react';
import axios from 'axios';
import { X, Upload, Globe, Type } from 'lucide-react';

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
    };
}

const PRESET_INTERVALS = [0, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800];
const PRESET_DELAYS = [0, 2, 5, 10, 15, 30, 60];

const formatInterval = (seconds: number) => {
    if (seconds === 0) return 'Manual Only';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
};

const SlideCreationModal: React.FC<SlideCreationModalProps> = ({ isOpen, onClose, onSuccess, editSlide }) => {
    const [type, setType] = useState<'image' | 'video' | 'webpage' | 'table'>(editSlide?.type as any || 'image');
    const [scaleMode, setScaleMode] = useState<'cover' | 'contain'>(editSlide?.scale_mode as any || 'contain');
    const [name, setName] = useState(editSlide?.name || '');
    const [content, setContent] = useState(() => {
        if (editSlide?.type === 'webpage' || editSlide?.type === 'table') {
            try {
                const data = JSON.parse(editSlide.content);
                return data.url || data.data || editSlide.content;
            } catch (e) {
                return editSlide.content;
            }
        }
        return '';
    });
    const [file, setFile] = useState<File | null>(null);
    const [renderWebpage, setRenderWebpage] = useState(editSlide?.render_webpage || false);
    const [renderInterval, setRenderInterval] = useState(editSlide?.render_interval || 0);
    const [renderDelay, setRenderDelay] = useState(editSlide?.render_delay || 0);
    const [webScript, setWebScript] = useState(editSlide?.web_script || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    React.useEffect(() => {
        if (editSlide && isOpen) {
            setType(editSlide.type as any);
            setScaleMode(editSlide.scale_mode as any || 'contain');
            setName(editSlide.name || '');
            try {
                const data = JSON.parse(editSlide.content);
                setContent(data.url || data.data || editSlide.content);
            } catch (e) {
                setContent(editSlide.content);
            }
            setFile(null);
            setRenderWebpage(editSlide?.render_webpage || false);
            setRenderInterval(editSlide?.render_interval || 0);
            setRenderDelay(editSlide?.render_delay || 0);
            setWebScript(editSlide?.web_script || '');
        } else if (!editSlide && isOpen) {
            setType('image');
            setScaleMode('contain');
            setName('');
            setContent('');
            setFile(null);
            setRenderWebpage(false);
            setRenderInterval(0);
            setRenderDelay(0);
            setWebScript('');
        }
    }, [editSlide, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('type', type);
        formData.append('name', name);
        formData.append('scale_mode', scaleMode);

        if (type === 'image' || type === 'video') {
            if (!file && !editSlide) {
                setError('Please select a file');
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
            }
        }

        try {
            if (editSlide) {
                await axios.put(`/api/slides/${editSlide.id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                await axios.post('/api/slides', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create slide');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="modal-card w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-900/50">
                    <div>
                        <h3 className="text-xl font-bold text-white">{editSlide ? 'Edit Slide' : 'Create New Slide'}</h3>
                        <p className="text-xs text-slate-400 mt-1">Configure your signage content and playback settings</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[85vh] overflow-y-auto custom-scrollbar bg-slate-800/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Section 1: Basic Info */}
                        <div className="space-y-6">
                            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400">
                                <Type size={14} /> Basic Information
                            </h4>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-300">Friendly Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full input-field font-bold text-lg"
                                    placeholder="e.g. Lobby Promotion"
                                    required
                                />
                            </div>

                            {!editSlide && (
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-300">Content Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'image', icon: Upload, label: 'Image' },
                                            { id: 'video', icon: Upload, label: 'Video' },
                                            { id: 'webpage', icon: Globe, label: 'Web' },
                                            { id: 'table', icon: Type, label: 'Table' },
                                        ].map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setType(item.id as any)}
                                                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${type === item.id
                                                    ? 'border-indigo-500 bg-indigo-500/20 text-white'
                                                    : 'border-white/5 bg-slate-900/50 text-slate-400 hover:border-white/10'
                                                    }`}
                                            >
                                                <item.icon size={18} />
                                                <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(type === 'image' || type === 'video') && (
                                <div className="space-y-2 pt-2">
                                    <label className="text-sm font-semibold text-slate-300">Viewport Scaling</label>
                                    <div className="flex gap-2 p-1 bg-slate-900 rounded-xl border border-white/5">
                                        <button
                                            type="button"
                                            onClick={() => setScaleMode('cover')}
                                            className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all ${scaleMode === 'cover' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            UP-SCALE (FILL)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setScaleMode('contain')}
                                            className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all ${scaleMode === 'contain' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            UNIFORM (FIT)
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Section 2: Content & Advanced */}
                        <div className="space-y-6">
                            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400">
                                <Globe size={14} /> Content Source
                            </h4>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                                    <X size={16} /> {error}
                                </div>
                            )}

                            {(type === 'image' || type === 'video') ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-300">
                                        {editSlide ? 'Replace Asset (Optional)' : 'File Upload'}
                                    </label>
                                    <div className="relative group">
                                        <div className={`h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${file ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/10 bg-slate-900/50 group-hover:bg-slate-900 group-hover:border-white/20'}`}>
                                            <input
                                                type="file"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                                accept={type === 'image' ? 'image/*' : 'video/*'}
                                            />
                                            <div className={`p-3 rounded-full mb-3 ${file ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                <Upload size={24} />
                                            </div>
                                            <span className="text-sm text-slate-300 font-bold px-4 text-center">
                                                {file ? file.name : (editSlide ? "Keep existing file" : `Drop ${type} here or click`)}
                                            </span>
                                            {!file && <span className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">MAX SIZE 50MB</span>}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-300">{type === 'webpage' ? 'URL Address' : 'Table JSON'}</label>
                                        <input
                                            type="text"
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            className="w-full input-field"
                                            placeholder={type === 'webpage' ? 'https://example.com' : 'Valid JSON structure...'}
                                        />
                                    </div>

                                    {type === 'webpage' && (
                                        <div className="pt-2 space-y-6">
                                            <div className="flex items-center justify-between p-4 bg-slate-900/80 rounded-2xl border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                                        <Globe size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white leading-none">Server-Side Render</p>
                                                        <p className="text-[10px] text-slate-500 mt-1">Bypass CSP & complex web security</p>
                                                    </div>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={renderWebpage}
                                                        onChange={(e) => setRenderWebpage(e.target.checked)}
                                                    />
                                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                </label>
                                            </div>

                                            {renderWebpage && (
                                                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center px-1">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Refresh Cycle</label>
                                                            <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                                                                {formatInterval(renderInterval)}
                                                            </span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max={PRESET_INTERVALS.length - 1}
                                                            step="1"
                                                            value={PRESET_INTERVALS.indexOf(PRESET_INTERVALS.includes(renderInterval) ? renderInterval : 0)}
                                                            onChange={(e) => setRenderInterval(PRESET_INTERVALS[parseInt(e.target.value)])}
                                                            className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                        />
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center px-1">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Interaction Delay</label>
                                                            <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                                                                {renderDelay === 0 ? 'Default (2s)' : `${renderDelay}s`}
                                                            </span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max={PRESET_DELAYS.length - 1}
                                                            step="1"
                                                            value={PRESET_DELAYS.indexOf(PRESET_DELAYS.includes(renderDelay) ? renderDelay : 0)}
                                                            onChange={(e) => setRenderDelay(PRESET_DELAYS[parseInt(e.target.value)])}
                                                            className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Burp Automation Script</label>
                                                        <textarea
                                                            value={webScript}
                                                            onChange={(e) => setWebScript(e.target.value)}
                                                            className="w-full input-field font-mono text-[10px] min-h-[100px] leading-relaxed border-indigo-500/20"
                                                            placeholder='[{"eventType": "click", "xPath": "..."}]'
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

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
                            className={`flex-[1.5] py-4 rounded-xl btn-primary shadow-xl shadow-indigo-500/20 font-black text-sm uppercase tracking-widest disabled:opacity-50 transition-all ${loading ? 'cursor-not-allowed' : 'hover:scale-[1.02]'}`}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    <span>Syncing...</span>
                                </div>
                            ) : (
                                <span>{editSlide ? 'Update Slide' : 'Commit Changes'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SlideCreationModal;
