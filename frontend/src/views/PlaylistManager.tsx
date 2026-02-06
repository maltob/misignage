import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, PlaySquare, Trash2, Clock, ChevronUp, ChevronDown, Video, Globe, Share2, ExternalLink, Check, Copy, Pencil, X, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PlaylistCreationModal from '../components/PlaylistCreationModal';
import SlideSelectionModal from '../components/SlideSelectionModal';

interface Playlist {
    id: number;
    name: string;
    is_public: boolean;
    public_slug: string;
    slides: any[];
    groups: any[];
}

const PlaylistManager: React.FC = () => {
    const { t } = useTranslation();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [slides, setSlides] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectionModalOpen, setSelectionModalOpen] = useState(false);
    const [targetPlaylist, setTargetPlaylist] = useState<Playlist | null>(null);

    // Edit Name State
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");

    useEffect(() => {
        fetchPlaylists();
        fetchSlides();
    }, []);

    const fetchPlaylists = async () => {
        try {
            const res = await axios.get('/api/playlists');
            setPlaylists(res.data);
        } catch (err) {
            console.error("Failed to fetch playlists", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSlides = async () => {
        try {
            const res = await axios.get('/api/slides');
            setSlides(res.data);
        } catch (err) { }
    };

    const deletePlaylist = async (id: number) => {
        if (!confirm(t('playlists.confirm_delete'))) return;
        try {
            await axios.delete(`/api/playlists/${id}`);
            fetchPlaylists();
        } catch (err) {
            alert(t('playlists.delete_failed'));
        }
    };

    const updateSlides = async (playlistID: number, updatedSlides: any[]) => {
        try {
            await axios.put(`/api/playlists/${playlistID}/slides`, updatedSlides.map((s, i) => ({
                id: s.id || 0,
                slide_id: s.slide_id || s.id,
                order: i,
                duration: s.duration || 10
            })));
            fetchPlaylists();
        } catch (err) {
            alert(t('playlists.update_failed'));
        }
    };

    const addSlideToPlaylist = (playlist: Playlist, slideID: number) => {
        const slide = slides.find(s => s.id === slideID);
        const duration = (slide && slide.type === 'video' && slide.duration) ? Math.ceil(slide.duration) : 10;
        const newSlides = [...(playlist.slides || []), { slide_id: slideID, duration }];
        updateSlides(playlist.id, newSlides);
    };

    const removeSlideFromPlaylist = (playlist: Playlist, index: number) => {
        const newSlides = [...playlist.slides];
        newSlides.splice(index, 1);
        updateSlides(playlist.id, newSlides);
    };

    const updateSlideDuration = (playlist: Playlist, index: number, duration: number) => {
        const newSlides = [...playlist.slides];
        newSlides[index].duration = duration;
        updateSlides(playlist.id, newSlides);
    };

    const moveSlide = (playlist: Playlist, index: number, direction: 'up' | 'down') => {
        const newSlides = [...playlist.slides];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newSlides.length) return;

        const temp = newSlides[index];
        newSlides[index] = newSlides[targetIndex];
        newSlides[targetIndex] = temp;

        updateSlides(playlist.id, newSlides);
    };

    const [copiedId, setCopiedId] = useState<number | null>(null);

    const togglePublicAccess = async (playlist: Playlist) => {
        try {
            const formData = new FormData();
            formData.append('is_public', (!playlist.is_public).toString());
            await axios.put(`/api/playlists/${playlist.id}`, formData);
            fetchPlaylists();
        } catch (err) {
            alert(t('playlists.update_failed'));
        }
    };

    const startEditing = (playlist: Playlist) => {
        setEditingId(playlist.id);
        setEditName(playlist.name);
    };

    const saveName = async (id: number) => {
        try {
            const formData = new FormData();
            formData.append('name', editName);
            await axios.put(`/api/playlists/${id}`, formData);
            setEditingId(null);
            fetchPlaylists();
        } catch (err) {
            alert(t('playlists.update_failed'));
        }
    };

    const copyToClipboard = (playlist: Playlist) => {
        const url = `${window.location.origin}/#/public/${playlist.public_slug}`;
        navigator.clipboard.writeText(url);
        setCopiedId(playlist.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (loading) return <div className="text-slate-400">{t('common.loading')}</div>;

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-[var(--text-main)] mb-1">{t('playlists.title')}</h3>
                    <p className="text-slate-400">{t('playlists.subtitle')}</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus size={18} />
                    {t('playlists.new')}
                </button>
            </div>

            <PlaylistCreationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchPlaylists}
            />

            <SlideSelectionModal
                isOpen={selectionModalOpen}
                slides={slides}
                onClose={() => {
                    setSelectionModalOpen(false);
                    setTargetPlaylist(null);
                }}
                onSelect={(slideId) => {
                    if (targetPlaylist) {
                        addSlideToPlaylist(targetPlaylist, slideId);
                    }
                }}
            />

            <div className="grid grid-cols-1 gap-6">
                {playlists.length === 0 ? (
                    <div className="text-slate-500 italic py-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
                        {t('playlists.no_playlists')}
                    </div>
                ) : (
                    playlists.map((playlist) => (
                        <div key={playlist.id} className="glass-card p-6 group hover:border-indigo-500/30 transition-all" style={{ backgroundColor: 'var(--bg-card)' }}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                                        <PlaySquare size={26} />
                                    </div>
                                    <div>
                                        {editingId === playlist.id ? (
                                            <div className="flex items-center gap-2 mb-1">
                                                <input
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded px-2 py-1 text-[var(--text-main)] font-bold text-lg focus:outline-none focus:border-indigo-500"
                                                    autoFocus
                                                />
                                                <button onClick={() => saveName(playlist.id)} className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded"><Save size={18} /></button>
                                                <button onClick={() => setEditingId(null)} className="p-1 text-slate-500 hover:bg-slate-500/10 rounded"><X size={18} /></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 group/name cursor-pointer" onClick={() => startEditing(playlist)}>
                                                <h4 className="font-bold text-[var(--text-main)] text-xl group-hover/name:text-indigo-400 transition-colors">{playlist.name}</h4>
                                                <Pencil size={14} className="text-slate-500 opacity-0 group-hover/name:opacity-100 transition-opacity" />
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3">
                                            <p className="text-sm text-slate-500">{(playlist.slides || []).length} {t('playlists.slides_count')}  {t('playlists.total_duration')}: {(playlist.slides || []).reduce((acc, s) => acc + s.duration, 0)}s</p>
                                            {playlist.groups?.length > 0 && (
                                                <div className="flex gap-1">
                                                    {playlist.groups.map((g: any) => (
                                                        <span key={g.id} className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-bold uppercase tracking-wider">
                                                            {g.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => deletePlaylist(playlist.id)}
                                        className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Public Access Section */}
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-4 px-4 bg-[var(--sidebar-hover)] border border-[var(--border-subtle)] rounded-2xl mb-6">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${playlist.is_public ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500'}`}>
                                        <Share2 size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[var(--text-main)]">{t('playlists.public_access')}</p>
                                        <p className="text-[10px] text-slate-500 font-medium">{t('playlists.share_hint')}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    {playlist.is_public && (
                                        <div className="flex-1 md:flex-initial flex items-center gap-2 bg-[var(--bg-main)] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] min-w-0">
                                            <span className="text-[10px] text-slate-400 font-medium truncate">.../#public/{playlist.public_slug}</span>
                                            <button
                                                onClick={() => copyToClipboard(playlist)}
                                                className="text-indigo-400 hover:text-indigo-300 transition-colors"
                                            >
                                                {copiedId === playlist.id ? <Check size={14} /> : <Copy size={14} />}
                                            </button>
                                            <a
                                                href={`/#public/${playlist.public_slug}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-slate-500 hover:text-[var(--text-main)] transition-colors"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => togglePublicAccess(playlist)}
                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${playlist.is_public ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                    >
                                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${playlist.is_public ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="bg-[var(--sidebar-hover)] rounded-2xl p-4 border border-[var(--border-subtle)]">
                                    <div className="flex items-center justify-between mb-4">
                                        <h5 className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('playlists.timeline')}</h5>
                                        <button
                                            onClick={() => {
                                                setTargetPlaylist(playlist);
                                                setSelectionModalOpen(true);
                                            }}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-all"
                                        >
                                            <Plus size={14} />
                                            {t('playlists.add_slide')}
                                        </button>
                                    </div>

                                    {playlist.slides && playlist.slides.length > 0 ? (
                                        <div className="space-y-2">
                                            {playlist.slides.map((ps, idx) => {
                                                const slide = ps.slide || {};
                                                let content: any = {};
                                                try {
                                                    content = typeof slide.content === 'string' ? JSON.parse(slide.content) : slide.content;
                                                } catch (e) { }

                                                return (
                                                    <div key={ps.id || idx} className="flex items-center gap-4 bg-[var(--bg-main)] hover:border-indigo-500/30 border border-[var(--border-subtle)] p-2 pr-4 rounded-xl transition-all group/row">
                                                        {/* Preview Thumbnail */}
                                                        <div className="w-24 h-14 bg-black/40 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border border-[var(--border-subtle)] relative">
                                                            {slide.thumbnail_url ? (
                                                                <img src={slide.thumbnail_url} className="w-full h-full object-cover" alt="" />
                                                            ) : slide.type === 'image' && content.url ? (
                                                                <img src={content.url} className="w-full h-full object-cover" alt="" />
                                                            ) : slide.type === 'video' ? (
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <Video className="text-slate-700" size={24} />
                                                                    {slide.processing_status === 'processing' && (
                                                                        <span className="text-[8px] text-indigo-400 font-bold animate-pulse">{t('slides.processing')}</span>
                                                                    )}
                                                                </div>
                                                            ) : slide.type === 'webpage' ? (
                                                                <Globe className="text-slate-700" size={24} />
                                                            ) : (
                                                                <PlaySquare className="text-slate-700" size={24} />
                                                            )}
                                                        </div>

                                                        {/* Name and Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-base font-bold text-[var(--text-main)] truncate group-hover/row:text-indigo-400 transition-colors">
                                                                {slide.name || `Slide #${ps.slide_id}`}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                                <span className="bg-[var(--bg-card)] px-1.5 py-0.5 rounded italic border border-[var(--border-subtle)]">{t(`slides.types.${slide.type}`)}</span>
                                                                <span className="text-slate-700">â€¢</span>
                                                                <span>ID {ps.slide_id}</span>
                                                            </div>
                                                        </div>

                                                        {/* Duration Slider/Input */}
                                                        <div className="flex items-center gap-3 bg-black/20 px-3 py-1.5 rounded-xl border border-white/5">
                                                            <Clock size={14} className="text-slate-500" />
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    value={ps.duration}
                                                                    onChange={(e) => updateSlideDuration(playlist, idx, parseInt(e.target.value))}
                                                                    className="bg-transparent text-sm text-indigo-400 font-black w-10 outline-none text-right"
                                                                />
                                                                <span className="text-[10px] text-slate-600 font-black uppercase">s</span>
                                                            </div>
                                                        </div>

                                                        {/* Reordering Controls */}
                                                        <div className="flex flex-col gap-0.5">
                                                            <button
                                                                onClick={() => moveSlide(playlist, idx, 'up')}
                                                                disabled={idx === 0}
                                                                className="p-1 text-slate-500 hover:text-white hover:bg-indigo-500 rounded-md disabled:opacity-0 transition-all"
                                                            >
                                                                <ChevronUp size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => moveSlide(playlist, idx, 'down')}
                                                                disabled={idx === playlist.slides.length - 1}
                                                                className="p-1 text-slate-500 hover:text-white hover:bg-indigo-500 rounded-md disabled:opacity-0 transition-all"
                                                            >
                                                                <ChevronDown size={16} />
                                                            </button>
                                                        </div>

                                                        {/* Delete button */}
                                                        <button
                                                            onClick={() => removeSlideFromPlaylist(playlist, idx)}
                                                            className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-slate-600 text-sm italic text-center py-6 border border-dashed border-white/5 rounded-xl">
                                            {t('playlists.no_content')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default PlaylistManager;
