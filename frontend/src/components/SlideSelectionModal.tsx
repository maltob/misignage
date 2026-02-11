import React, { useState } from 'react';
import { X, Search, Image as ImageIcon, Video, Globe, PlaySquare, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Slide {
    id: number;
    name: string;
    type: string;
    content: string;
    thumbnail_url?: string;
    processing_status?: string;
}

interface SlideSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    slides: Slide[];
    onSelect: (slideId: number) => void;
}

const SlideSelectionModal: React.FC<SlideSelectionModalProps> = ({ isOpen, onClose, slides, onSelect }) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');

    if (!isOpen) return null;

    const filteredSlides = slides.filter(s =>
        (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
        s.type.toLowerCase().includes(search.toLowerCase()) ||
        s.id.toString().includes(search)
    );

    const getIcon = (type: string) => {
        switch (type) {
            case 'image': return <ImageIcon size={20} />;
            case 'video': return <Video size={20} />;
            case 'webpage': return <Globe size={20} />;
            default: return <PlaySquare size={20} />;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="modal-card w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" style={{ backgroundColor: 'var(--bg-modal)' }}>
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)] bg-[var(--sidebar-hover)]">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--text-main)]">{t('modals.slide_selection.title')}</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{t('modals.slide_selection.subtitle', { count: slides.length })}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--border-subtle)] text-slate-500 hover:text-[var(--text-main)] transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 bg-[var(--bg-modal)] border-b border-[var(--border-subtle)]">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder={t('modals.slide_selection.search_placeholder')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full input-field py-3.5 pl-14 pr-4 text-[var(--text-main)] font-bold border-2 border-[var(--border-subtle)] bg-[var(--input-bg)]"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar bg-transparent">
                    {filteredSlides.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500 opacity-50">
                            <Search size={48} className="mb-4" />
                            <p className="text-lg font-bold">{t('modals.slide_selection.no_assets')}</p>
                            <p className="text-sm">{t('modals.slide_selection.search_hint')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {filteredSlides.map(slide => {
                                let content: any = {};
                                try {
                                    content = typeof slide.content === 'string' ? JSON.parse(slide.content) : slide.content;
                                } catch (e) { }

                                return (
                                    <button
                                        key={slide.id}
                                        onClick={() => {
                                            onSelect(slide.id);
                                            onClose();
                                        }}
                                        className="flex items-center gap-5 p-4 rounded-2xl bg-[var(--bg-main)] hover:bg-[var(--sidebar-hover)] border-2 border-[var(--border-subtle)] hover:border-indigo-500/50 transition-all text-left group shadow-sm hover:shadow-indigo-500/10"
                                    >
                                        <div className="w-24 h-14 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-[var(--border-subtle)] relative shadow-inner">
                                            {slide.thumbnail_url ? (
                                                <img src={slide.thumbnail_url} className="w-full h-full object-cover" alt="" />
                                            ) : slide.type === 'image' && content.url ? (
                                                <img src={content.url} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <div className="text-slate-700 group-hover:text-indigo-500 transition-colors">
                                                    {getIcon(slide.type)}
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="font-black text-[var(--text-main)] group-hover:text-indigo-400 transition-colors truncate">
                                                {slide.name || `${t('modals.slide_selection.asset_prefix')}${slide.id}`}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] font-black text-[var(--text-main)] uppercase tracking-widest bg-[var(--bg-tag)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                                                    {t(`slides.types.${slide.type}`)}
                                                </span>
                                                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                                                    {t('modals.slide_selection.ref_prefix')} {slide.id.toString().padStart(4, '0')}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center gap-1 scale-90 group-hover:scale-100 opacity-0 group-hover:opacity-100 transition-all">
                                            <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-500/40">
                                                <Plus size={18} />
                                            </div>
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">{t('modals.slide_selection.insert_button')}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--sidebar-hover)] flex items-center justify-between">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                        {t('modals.slide_selection.filtering_index')} {filteredSlides.length} / {slides.length}
                    </p>
                    <button
                        onClick={onClose}
                        className="text-[10px] font-black text-slate-400 hover:text-[var(--text-main)] uppercase tracking-widest transition-colors bg-[var(--bg-main)] hover:bg-[var(--border-subtle)] px-4 py-2 rounded-lg"
                    >
                        {t('modals.slide_selection.dismiss_button')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SlideSelectionModal;
