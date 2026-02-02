import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Search, PlaySquare, Image as ImageIcon, Video, Globe, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Slide {
    id: number;
    name: string;
    type: string;
    content: string;
    thumbnail_url?: string;
    ocr_content?: string;
}

const PublicPlaylistView: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const { t } = useTranslation();
    const [playlist, setPlaylist] = useState<any>(null);
    const [slides, setSlides] = useState<Slide[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchPlaylist();
    }, [slug]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim()) {
                searchSlides();
            } else if (playlist) {
                setSlides(playlist.slides.map((ps: any) => ps.slide));
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, playlist]);

    const fetchPlaylist = async () => {
        try {
            const res = await axios.get(`/api/public/playlist/${slug}`);
            setPlaylist(res.data);
            setSlides(res.data.slides.map((ps: any) => ps.slide));
        } catch (err) {
            setError(t('public_view.no_results'));
        } finally {
            setLoading(false);
        }
    };

    const searchSlides = async () => {
        try {
            const res = await axios.get(`/api/public/playlist/${slug}/search`, { params: { q: searchQuery } });
            setSlides(res.data);
        } catch (err) { }
    };

    if (loading) return (
        <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    if (error || !playlist) return (
        <div className="min-h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center p-6 text-center">
            <PlaySquare size={64} className="text-slate-800 mb-6" />
            <h1 className="text-2xl font-bold text-[var(--text-main)] mb-2">{t('public_view.no_results')}</h1>
            <p className="text-slate-500">{t('public_view.share_hint')}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-300">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[var(--bg-main)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)] px-6 py-4">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                            <PlaySquare size={24} />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-[var(--text-main)] leading-tight uppercase tracking-tight">
                                {playlist.name}
                            </h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                {t('public_view.viewing_playlist')}
                            </p>
                        </div>
                    </div>

                    <div className="relative w-full md:w-80">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder={t('public_view.search_placeholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl py-2.5 pl-10 pr-4 text-sm text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-all font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="max-w-7xl mx-auto p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {slides.map((slide, idx) => {
                        let content: any = {};
                        try {
                            content = typeof slide.content === 'string' ? JSON.parse(slide.content) : slide.content;
                        } catch (e) { }

                        const imageUrl = slide.thumbnail_url || (slide.type === 'image' ? content.url : null);

                        return (
                            <div key={`${slide.id}-${idx}`} className="glass-card overflow-hidden group hover:border-indigo-500/50 transition-all flex flex-col" style={{ backgroundColor: 'var(--bg-card)' }}>
                                <div className="aspect-video bg-[var(--bg-main)] flex items-center justify-center relative bg-center bg-cover"
                                    style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : {}}>

                                    {!imageUrl && (
                                        <div className="text-slate-700">
                                            {slide.type === 'video' ? <Video size={48} /> :
                                                slide.type === 'webpage' ? <Globe size={48} /> :
                                                    <ImageIcon size={48} />}
                                        </div>
                                    )}

                                    <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] font-bold uppercase tracking-widest text-white/70 flex items-center gap-2">
                                        {slide.type === 'image' && <ImageIcon size={12} />}
                                        {slide.type === 'video' && <Video size={12} />}
                                        {slide.type === 'webpage' && <Globe size={12} />}
                                        {slide.type}
                                    </div>
                                </div>
                                <div className="p-4 flex flex-col flex-1 border-t border-[var(--border-subtle)]">
                                    <h3 className="font-bold text-[var(--text-main)] truncate mb-1">
                                        {slide.name || (slide.type === 'webpage' ? content.url : `Item #${slide.id}`)}
                                    </h3>
                                    {slide.ocr_content && (
                                        <p className="text-[10px] text-slate-500 line-clamp-2 italic font-medium leading-relaxed">
                                            "{slide.ocr_content}"
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {slides.length === 0 && (
                    <div className="py-24 text-center">
                        <Search size={48} className="text-slate-800 mx-auto mb-4" />
                        <p className="text-slate-500 italic">{t('public_view.no_results')}</p>
                    </div>
                )}
            </div>

            {/* Back to Top */}
            <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="fixed bottom-8 right-8 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-indigo-500 hover:scale-110 transition-all z-40"
            >
                <ChevronUp size={24} />
            </button>
        </div>
    );
};

export default PublicPlaylistView;
