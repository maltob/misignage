import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Image as ImageIcon, Video, Globe, Table as TableIcon, Search, Trash2, Share2, FileText, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import Tesseract from 'tesseract.js';
import SlideCreationModal from '../components/SlideCreationModal';
import { useRef } from 'react';

interface Slide {
    id: number;
    name: string;
    type: string;
    content: string;
    scale_mode?: string;
    thumbnail_url?: string;
    duration?: number;
    processing_status?: string;
    ocr_content?: string;
    render_webpage?: boolean;
    render_interval?: number;
    groups?: any[];
}

const SlideManager: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { lastSlideUpdate } = useWebSocket();
    const [slides, setSlides] = useState<Slide[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editSlide, setEditSlide] = useState<Slide | undefined>();
    const [searchQuery, setSearchQuery] = useState('');
    const [ocrLoading, setOcrLoading] = useState<Record<number, boolean>>({});
    const processingRef = useRef<boolean>(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchSlides(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, lastSlideUpdate]);

    // Background OCR Loop
    useEffect(() => {
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) return;
        if (processingRef.current) return;

        const slidesToProcess = slides.filter(s =>
            (s.type === 'image' || s.thumbnail_url) &&
            s.ocr_content === undefined && // Undefined means not yet attempted client-side
            s.processing_status !== 'processing' &&
            !ocrLoading[s.id]
        );

        if (slidesToProcess.length > 0) {
            processNextSequentially(slidesToProcess);
        }
    }, [slides, user]);

    const processNextSequentially = async (pending: Slide[]) => {
        if (processingRef.current || pending.length === 0) return;
        processingRef.current = true;

        for (const slide of pending) {
            await handleProcessOCR(slide, true);
        }

        processingRef.current = false;
    };

    const fetchSlides = async (q?: string) => {
        try {
            const res = await axios.get('/api/slides', { params: { q } });
            setSlides(res.data);
        } catch (err) {
            console.error("Failed to fetch slides", err);
        }
    };

    const handleDeleteSlide = async (e: React.MouseEvent, slideId: number) => {
        e.stopPropagation();
        if (!window.confirm(t('slides.confirm_delete'))) return;

        try {
            await axios.delete(`/api/slides/${slideId}`);
            fetchSlides(searchQuery);
        } catch (err) {
            console.error("Failed to delete slide", err);
            alert(t('slides.delete_failed'));
        }
    };

    const handleProcessOCR = async (slide: Slide, quiet = false) => {
        let imageUrl = '';
        if (slide.type === 'image') {
            try {
                const content = JSON.parse(slide.content);
                imageUrl = content.url;
            } catch (e) { }
        } else if (slide.thumbnail_url) {
            imageUrl = slide.thumbnail_url;
        }

        if (!imageUrl) return;

        setOcrLoading(prev => ({ ...prev, [slide.id]: true }));

        try {
            // Recognize text
            const { data: { text } } = await Tesseract.recognize(imageUrl, 'eng');
            const resultText = text.trim() || " "; // Use space to indicate "scanned but empty"

            // Save to backend
            const params = new URLSearchParams();
            params.append('ocr_content', resultText);

            await axios.put(`/api/slides/${slide.id}`, params);

            // Update local state without full refresh if possible, but for simplicity:
            if (!quiet) fetchSlides(searchQuery);
            else {
                // Update local slide so the effect doesn't pick it up again
                setSlides(prev => prev.map(s => s.id === slide.id ? { ...s, ocr_content: resultText } : s));
            }
        } catch (err) {
            console.error("OCR failed", err);
            if (!quiet) alert(t('slides.ocr_fail'));
        } finally {
            setOcrLoading(prev => ({ ...prev, [slide.id]: false }));
        }
    };

    const slideTypeIcons: Record<string, any> = {
        image: ImageIcon,
        video: Video,
        webpage: Globe,
        table: TableIcon,
        screenshare: Share2,
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-[var(--text-main)]">{t('slides.library')}</h3>
                    <p className="text-xs text-slate-500 font-medium">{t('slides.subtitle')}</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder={t('slides.search_placeholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl py-2 pl-10 pr-4 text-sm text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-all font-medium"
                        />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="btn-primary flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus size={18} />
                        {t('slides.create')}
                    </button>
                </div>
            </div>

            <SlideCreationModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditSlide(undefined);
                }}
                editSlide={editSlide}
                onSuccess={fetchSlides}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {slides.map((slide) => {
                    const Icon = slideTypeIcons[slide.type] || ImageIcon;
                    let content: any = {};
                    try {
                        content = JSON.parse(slide.content);
                    } catch (e) {
                        content = { error: "Invalid content format" };
                    }

                    return (
                        <div key={slide.id} className="glass-card overflow-hidden group hover:border-indigo-500/50 transition-all flex flex-col" style={{ backgroundColor: 'var(--bg-card)' }}>
                            <div className="aspect-video bg-slate-800 flex items-center justify-center relative bg-center bg-cover bg-no-repeat"
                                style={
                                    slide.thumbnail_url
                                        ? { backgroundImage: `url(${slide.thumbnail_url})` }
                                        : (slide.type === 'image' && content.url ? { backgroundImage: `url(${content.url})` } : {})
                                }>

                                {(!slide.thumbnail_url && !(slide.type === 'image' && content.url)) && (
                                    <Icon size={48} className="text-slate-600" />
                                )}

                                {slide.processing_status === 'processing' && (
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-[10px] font-bold text-indigo-400 tracking-widest">{t('slides.processing')}</span>
                                    </div>
                                )}

                                <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] font-bold uppercase tracking-widest text-white/70 flex items-center gap-2">
                                    <Icon size={12} />
                                    {t(`slides.types.${slide.type}`)}
                                </div>

                                {slide.duration !== undefined && slide.duration > 0 && (
                                    <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-500/80 backdrop-blur-md rounded text-[10px] font-black text-white">
                                        {Math.ceil(slide.duration)}s
                                    </div>
                                )}

                                {slide.ocr_content ? (
                                    <div className="absolute bottom-3 left-3 px-1.5 py-0.5 bg-indigo-500/80 backdrop-blur-md rounded text-[8px] font-bold uppercase tracking-widest text-white flex items-center gap-1 shadow-lg">
                                        <FileText size={10} />
                                        OCR
                                    </div>
                                ) : (
                                    (slide.type === 'image' || slide.thumbnail_url) && (
                                        <div className="absolute bottom-3 left-3 px-1.5 py-0.5 bg-amber-500/80 backdrop-blur-md rounded text-[8px] font-bold uppercase tracking-widest text-white flex items-center gap-1 shadow-lg">
                                            <AlertCircle size={10} />
                                            {t('slides.missing_ocr')}
                                        </div>
                                    )
                                )}

                                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/20 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                    <button
                                        onClick={() => {
                                            setEditSlide(slide);
                                            setIsModalOpen(true);
                                        }}
                                        className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-black text-sm shadow-xl hover:scale-110 transition-all"
                                    >
                                        {t('slides.edit')}
                                    </button>
                                    <button
                                        onClick={(e) => handleDeleteSlide(e, slide.id)}
                                        className="bg-red-500 text-white p-2 rounded-lg shadow-xl hover:bg-red-600 hover:scale-110 transition-all"
                                        title={t('common.delete')}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    {(user?.role === 'admin' || user?.role === 'manager') && (slide.type === 'image' || slide.thumbnail_url) && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleProcessOCR(slide);
                                            }}
                                            disabled={ocrLoading[slide.id]}
                                            className={`p-2 rounded-lg shadow-xl transition-all disabled:opacity-50 ${slide.ocr_content ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-emerald-500 hover:bg-emerald-600'
                                                } hover:scale-110`}
                                            title={slide.ocr_content ? t('slides.ocr_rescan') : t('slides.ocr_process')}
                                        >
                                            {ocrLoading[slide.id] ? <Loader2 size={18} className="animate-spin text-white" /> : <FileText size={18} className="text-white" />}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 flex-1">
                                <h4 className="font-bold text-white truncate">
                                    {slide.name || (slide.type === 'webpage' ? content.url : `Slide #${slide.id}`)}
                                </h4>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-sm text-slate-400">
                                        {slide.type === 'table' ? t('slides.data_table') : (slide.scale_mode === 'contain' ? t('slides.fit_all') : t('slides.fill_screen'))}
                                    </p>
                                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tight">ID: {slide.id}</span>
                                </div>
                                {((slide as any).groups?.length ?? 0) > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {(slide as any).groups?.map((g: any) => (
                                            <span key={g.id} className="text-[8px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-bold uppercase tracking-widest leading-none">
                                                {g.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="aspect-video glass-card border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 transition-all"
                >
                    <Plus size={32} />
                    <span className="font-bold">{t('slides.add_slide')}</span>
                </button>
            </div>
        </div>
    );
};

export default SlideManager;
