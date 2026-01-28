import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Image as ImageIcon, Video, Globe, Table as TableIcon, Search, Trash2 } from 'lucide-react';
import SlideCreationModal from '../components/SlideCreationModal';

interface Slide {
    id: number;
    name: string;
    type: string;
    content: string;
    scale_mode?: string;
    thumbnail_url?: string;
    duration?: number;
    processing_status?: string;
    render_webpage?: boolean;
    render_interval?: number;
}

const SlideManager: React.FC = () => {
    const [slides, setSlides] = useState<Slide[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editSlide, setEditSlide] = useState<Slide | undefined>();
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchSlides(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

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
        if (!window.confirm('Are you sure you want to delete this slide? This will also remove it from any playlists.')) return;

        try {
            await axios.delete(`/api/slides/${slideId}`);
            fetchSlides(searchQuery);
        } catch (err) {
            console.error("Failed to delete slide", err);
            alert("Failed to delete slide");
        }
    };

    const slideTypeIcons: Record<string, any> = {
        image: ImageIcon,
        video: Video,
        webpage: Globe,
        table: TableIcon,
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-white">Content Library</h3>
                    <p className="text-xs text-slate-500 font-medium">Search for assets by name or extracted text content</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Deep Search content..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                        />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="btn-primary flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus size={18} />
                        Create Slide
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
                        <div key={slide.id} className="glass-card overflow-hidden group hover:border-indigo-500/50 transition-all flex flex-col">
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
                                        <span className="text-[10px] font-bold text-indigo-400 tracking-widest">PROCESSING</span>
                                    </div>
                                )}

                                <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] font-bold uppercase tracking-widest text-white/70 flex items-center gap-2">
                                    <Icon size={12} />
                                    {slide.type}
                                </div>

                                {slide.duration !== undefined && slide.duration > 0 && (
                                    <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-500/80 backdrop-blur-md rounded text-[10px] font-black text-white">
                                        {Math.ceil(slide.duration)}s
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/20 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                    <button
                                        onClick={() => {
                                            setEditSlide(slide);
                                            setIsModalOpen(true);
                                        }}
                                        className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-black text-sm shadow-xl hover:scale-110 transition-all"
                                    >
                                        EDIT
                                    </button>
                                    <button
                                        onClick={(e) => handleDeleteSlide(e, slide.id)}
                                        className="bg-red-500 text-white p-2 rounded-lg shadow-xl hover:bg-red-600 hover:scale-110 transition-all"
                                        title="Delete Slide"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 flex-1">
                                <h4 className="font-bold text-white truncate">
                                    {slide.name || (slide.type === 'webpage' ? content.url : `Slide #${slide.id}`)}
                                </h4>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-sm text-slate-400">
                                        {slide.type === 'table' ? 'Data Table' : (slide.scale_mode === 'contain' ? 'Fit All' : 'Fill Screen')}
                                    </p>
                                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tight">ID: {slide.id}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="aspect-video glass-card border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 transition-all"
                >
                    <Plus size={32} />
                    <span className="font-bold">Add Slide</span>
                </button>
            </div>
        </div>
    );
};

export default SlideManager;
