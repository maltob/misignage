import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, PlaySquare, Trash2, GripVertical, Clock, X, ChevronUp, ChevronDown, Video, Globe, Search } from 'lucide-react';
import PlaylistCreationModal from '../components/PlaylistCreationModal';
import SlideSelectionModal from '../components/SlideSelectionModal';

interface Playlist {
    id: number;
    name: string;
    slides: any[];
}

const PlaylistManager: React.FC = () => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [slides, setSlides] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
    const [selectionModalOpen, setSelectionModalOpen] = useState(false);
    const [targetPlaylist, setTargetPlaylist] = useState<Playlist | null>(null);

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
        if (!confirm("Are you sure you want to delete this playlist?")) return;
        try {
            await axios.delete(`/api/playlists/${id}`);
            fetchPlaylists();
        } catch (err) {
            alert("Failed to delete playlist");
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
            alert("Failed to update slides");
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

    if (loading) return <div className="text-slate-400">Loading playlists...</div>;

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Playlists</h3>
                    <p className="text-slate-400">Sequential content collections for your displays</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus size={18} />
                    New Playlist
                </button>
            </div>

            <PlaylistCreationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchPlaylists}
            />

            <SlideSelectionModal
                isOpen={selectionModalOpen}
                onClose={() => {
                    setSelectionModalOpen(false);
                    setTargetPlaylist(null);
                }}
                slides={slides}
                onSelect={(slideId) => {
                    if (targetPlaylist) {
                        addSlideToPlaylist(targetPlaylist, slideId);
                    }
                }}
            />

            <div className="grid grid-cols-1 gap-6">
                {playlists.length === 0 ? (
                    <div className="text-slate-500 italic py-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
                        No playlists created yet.
                    </div>
                ) : (
                    playlists.map((playlist) => (
                        <div key={playlist.id} className="glass-card p-6 group hover:border-indigo-500/30 transition-all">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                                        <PlaySquare size={26} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-xl">{playlist.name}</h4>
                                        <p className="text-sm text-slate-500">{(playlist.slides || []).length} slides • Total duration: {(playlist.slides || []).reduce((acc, s) => acc + s.duration, 0)}s</p>
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

                            <div className="space-y-3">
                                <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h5 className="text-xs font-bold uppercase tracking-widest text-slate-500">Timeline</h5>
                                        <button
                                            onClick={() => {
                                                setTargetPlaylist(playlist);
                                                setSelectionModalOpen(true);
                                            }}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-all"
                                        >
                                            <Plus size={14} />
                                            Add Slide
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
                                                    <div key={ps.id || idx} className="flex items-center gap-4 bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 p-2 pr-4 rounded-xl transition-all group/row">
                                                        {/* Preview Thumbnail */}
                                                        <div className="w-24 h-14 bg-black/40 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border border-white/5 relative">
                                                            {slide.thumbnail_url ? (
                                                                <img src={slide.thumbnail_url} className="w-full h-full object-cover" alt="" />
                                                            ) : slide.type === 'image' && content.url ? (
                                                                <img src={content.url} className="w-full h-full object-cover" alt="" />
                                                            ) : slide.type === 'video' ? (
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <Video className="text-slate-700" size={24} />
                                                                    {slide.processing_status === 'processing' && (
                                                                        <span className="text-[8px] text-indigo-400 font-bold animate-pulse">PROCESSING</span>
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
                                                            <div className="text-base font-bold text-white truncate group-hover/row:text-indigo-400 transition-colors">
                                                                {slide.name || `Slide #${ps.slide_id}`}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                                <span className="bg-white/5 px-1.5 py-0.5 rounded italic">{slide.type}</span>
                                                                <span className="text-slate-700">•</span>
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
                                                                <span className="text-[10px] text-slate-600 font-black uppercase">sec</span>
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
                                            No content in this playlist. Start by adding a slide above.
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
