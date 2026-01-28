import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Monitor, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import html2canvas from 'html2canvas';

const Player: React.FC = () => {
    const [display, setDisplay] = useState<any>(null);
    const [currentSlide, setCurrentSlide] = useState<any>(null);
    const [resolvedUrl, setResolvedUrl] = useState<string>('');
    const [status, setStatus] = useState<'unregistered' | 'pending' | 'active'>('unregistered');
    const [online, setOnline] = useState(true);
    const [playlist, setPlaylist] = useState<any>(null);
    const [slideIndex, setSlideIndex] = useState(0);

    const [schedules, setSchedules] = useState<any[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [screenshotInterval, setScreenshotInterval] = useState(0);

    const getHeaders = () => {
        const token = localStorage.getItem('display_token');
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    };

    const loginDisplay = async (id: string, secret: string) => {
        try {
            const res = await axios.post('/api/displays/login', { id: parseInt(id), secret });
            localStorage.setItem('display_token', res.data.token);
            return res.data.token;
        } catch (err) {
            console.error("Login failed", err);
            return null;
        }
    };

    useEffect(() => {
        const check = () => {
            const savedDisplay = localStorage.getItem('display_id');
            const savedStatus = localStorage.getItem('display_status');
            const savedData = localStorage.getItem('display_data');

            if (savedStatus) setStatus(savedStatus as any);
            if (savedData) setDisplay(JSON.parse(savedData));

            if (savedDisplay && savedDisplay !== 'undefined' && savedDisplay !== 'null') {
                const secret = localStorage.getItem('display_secret');
                let token = localStorage.getItem('display_token');

                if (!token && secret) {
                    // Attempt login
                    loginDisplay(savedDisplay, secret).then((newToken) => {
                        if (newToken) {
                            reportHeartbeat(savedDisplay);
                            checkStatus(savedDisplay);
                            fetchContent(savedDisplay);
                        }
                    });
                } else {
                    reportHeartbeat(savedDisplay);
                    checkStatus(savedDisplay);
                    fetchContent(savedDisplay);
                }
            }
        };

        check();
        window.addEventListener('online', () => setOnline(true));
        window.addEventListener('offline', () => setOnline(false));

        const interval = setInterval(check, 10000); // 10 seconds check
        return () => {
            clearInterval(interval);
            window.removeEventListener('online', () => setOnline(true));
            window.removeEventListener('offline', () => setOnline(false));
        };
    }, []);

    useEffect(() => {
        const displayId = localStorage.getItem('display_id');
        if (!displayId || displayId === 'undefined') return;

        const token = localStorage.getItem('display_token');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws?display_id=${displayId}&token=${token}`;
        let socket: WebSocket;

        const connect = () => {
            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("WebSocket Connected");
                setOnline(true);
            };

            socket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    console.log("Received command:", msg);
                    handleRemoteCommand(msg);
                } catch (e) {
                    console.error("Failed to parse WS message", e);
                }
            };

            socket.onclose = () => {
                console.log("WebSocket Disconnected, retrying...");
                setOnline(false);
                setTimeout(connect, 5000);
            };
        };

        connect();
        return () => socket?.close();
    }, []);

    const handleRemoteCommand = (msg: any) => {
        switch (msg.type) {
            case 'REFRESH':
                window.location.reload();
                break;
            case 'RESYNC':
                const id = localStorage.getItem('display_id');
                if (id) fetchContent(id);
                break;
            case 'SCREENSHOT':
                captureAndUploadScreenshot();
                break;
            default:
                console.warn("Unknown command type:", msg.type);
        }
    };

    // Periodic schedule evaluation (every second or better)
    useEffect(() => {
        if (status !== 'active' || schedules.length === 0) return;

        const interval = setInterval(() => {
            const active = findActivePlaylist(schedules);
            if (active && JSON.stringify(active) !== JSON.stringify(playlist)) {
                setPlaylist(active);
                setSlideIndex(0);
            } else if (!active && playlist) {
                setPlaylist(null);
                setCurrentSlide(null);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [status, schedules, playlist]);

    useEffect(() => {
        if (!playlist || !playlist.slides || playlist.slides.length === 0) {
            setCurrentSlide(null);
            return;
        }

        const currentSlideData = playlist.slides[slideIndex];
        const slide = currentSlideData?.slide || null;
        setCurrentSlide(slide);

        if (slide) {
            try {
                const content = JSON.parse(slide.content);
                const originalUrl = content.url;

                if (!online) {
                    resolveOfflineUrl(originalUrl);
                } else {
                    setResolvedUrl(originalUrl);
                }
            } catch (e) {
                setResolvedUrl('');
            }
        }

        const duration = (currentSlideData.duration || 10) * 1000;
        const timer = setTimeout(() => {
            setSlideIndex((prev) => (prev + 1) % playlist.slides.length);
        }, duration);

        return () => {
            clearTimeout(timer);
            if (resolvedUrl && resolvedUrl.startsWith('blob:')) {
                URL.revokeObjectURL(resolvedUrl);
            }
        };
    }, [playlist, slideIndex, online]);

    // Automated Screenshot Interval
    useEffect(() => {
        if (!screenshotInterval || screenshotInterval <= 0) return;

        console.log(`Setting up automated screenshots every ${screenshotInterval} minutes`);
        const interval = setInterval(() => {
            if (online) {
                captureAndUploadScreenshot();
            }
        }, screenshotInterval * 60 * 1000);

        return () => clearInterval(interval);
    }, [screenshotInterval, online]);

    const resolveOfflineUrl = async (url: string) => {
        if (!('caches' in window)) return;
        const cache = await caches.open('misignage-assets');
        const match = await cache.match(url);
        if (match) {
            const blob = await match.blob();
            const blobUrl = URL.createObjectURL(blob);
            setResolvedUrl(blobUrl);
        } else {
            setResolvedUrl(url); // Fallback to original URL
        }
    };

    const captureAndUploadScreenshot = async () => {
        const id = localStorage.getItem('display_id');
        if (!id) return;

        try {
            const canvas = await html2canvas(document.body, {
                useCORS: true,
                scale: 0.5, // Reduced scale for performance
                logging: false
            });

            canvas.toBlob(async (blob) => {
                if (!blob) return;
                const formData = new FormData();
                formData.append('screenshot', blob, 'screenshot.jpg');
                const token = localStorage.getItem('display_token');
                if (!token) return; // No token, no upload

                await axios.post(`/api/displays/${id}/screenshot`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'Authorization': `Bearer ${token}`
                    }
                });
                console.log("Screenshot uploaded");
            }, 'image/jpeg', 0.7);
        } catch (err) {
            console.error("Screenshot failed", err);
        }
    };

    const findActivePlaylist = (schedules: any[]) => {
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const weekdayBit = day === 0 ? 64 : (1 << (day - 1));

        for (const s of schedules) {
            // Date check
            if (s.start_date && new Date(s.start_date) > now) continue;
            if (s.end_date && new Date(s.end_date) < now) continue;

            // Day check
            if (s.days_of_week > 0 && !(s.days_of_week & weekdayBit)) continue;

            // Time check
            if (s.start_time && s.end_time) {
                if (currentTime < s.start_time || currentTime > s.end_time) continue;
            }

            return s.playlist;
        }
        return null;
    };

    const fetchContent = async (id: string) => {
        try {
            const res = await axios.get(`/api/displays/${id}/content`, getHeaders());
            const remoteSchedules = res.data;
            setSchedules(remoteSchedules);
            localStorage.setItem(`schedules_${id}`, JSON.stringify(remoteSchedules));

            // Trigger asset sync
            syncAssets(remoteSchedules);
        } catch (err) {
            console.error("Failed to fetch content, loading from cache", err);
            const cached = localStorage.getItem(`schedules_${id}`);
            if (cached) {
                const parsedSchedules = JSON.parse(cached);
                setSchedules(parsedSchedules);
            }
        }
    };

    const syncAssets = async (schedules: any[]) => {
        if (!('caches' in window)) return;

        const assetsToCache: string[] = [];
        schedules.forEach(s => {
            if (s.playlist && s.playlist.slides) {
                s.playlist.slides.forEach((ps: any) => {
                    if (ps.slide && ps.slide.content) {
                        try {
                            const content = JSON.parse(ps.slide.content);
                            if (content.url) assetsToCache.push(content.url);
                        } catch (e) { }
                    }
                    if (ps.slide && ps.slide.thumbnail_url) {
                        assetsToCache.push(ps.slide.thumbnail_url);
                    }
                });
            }
        });

        if (assetsToCache.length === 0) return;

        setSyncing(true);
        const cache = await caches.open('misignage-assets');
        let completed = 0;

        for (const url of assetsToCache) {
            try {
                // Check if already in cache
                const match = await cache.match(url);
                if (!match) {
                    await cache.add(url);
                }
            } catch (err) {
                console.error(`Failed to cache asset: ${url}`, err);
            }
            completed++;
            setSyncProgress(Math.round((completed / assetsToCache.length) * 100));
        }

        setSyncing(false);
        console.log("Asset sync completed");
    };

    const checkStatus = async (id: string) => {
        if (!id || id === 'undefined') return;
        try {
            const res = await axios.get(`/api/displays/${id}/status`);
            setDisplay(res.data);
            if (res.data.approved) {
                setStatus('active');
                localStorage.setItem('display_status', 'active');
            } else {
                setStatus('pending');
                localStorage.setItem('display_status', 'pending');
            }
            if (res.data.Organization && res.data.Organization.screenshot_interval !== undefined) {
                setScreenshotInterval(res.data.Organization.screenshot_interval);
            }
            localStorage.setItem('display_data', JSON.stringify(res.data));
        } catch (err) {
            console.error("Failed to check status", err);
        }
    };

    const registerDisplay = async () => {
        try {
            const res = await axios.post('/api/displays/register', {
                name: `Display ${Math.floor(Math.random() * 1000)}`,
                size: `${window.innerWidth}x${window.innerHeight}`,
                browser_agent: navigator.userAgent
            });
            localStorage.setItem('display_id', res.data.id);
            localStorage.setItem('display_secret', res.data.secret);
            setDisplay(res.data);
            setStatus('pending');
        } catch (err) {
            console.error("Registration failed", err);
        }
    };

    const reportHeartbeat = async (id: string) => {
        try {
            await axios.post(`/api/displays/${id}/heartbeat`, {}, getHeaders());
            setOnline(true);
        } catch (err) {
            setOnline(false);
        }
    };

    if (status === 'unregistered') {
        return (
            <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-center text-white">
                <div className="relative mb-12">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full"></div>
                    <Monitor size={120} className="text-indigo-500 relative animate-pulse" />
                </div>
                <h1 className="text-5xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">miSignage</h1>
                <p className="text-xl text-slate-400 max-w-md mb-12 font-medium">
                    This media player has not been registered.<br />Press the button below to generate a claim code.
                </p>
                <button
                    onClick={registerDisplay}
                    className="px-10 py-5 bg-indigo-500 hover:bg-indigo-600 rounded-3xl font-black text-2xl transition-all shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] active:scale-95"
                >
                    Register This Device
                </button>
            </div>
        );
    }

    if (status === 'pending') {
        return (
            <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-center text-white">
                <div className="mb-8 text-slate-500 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></div>
                    Waiting for link
                </div>
                <div className="w-48 h-48 bg-white/5 border border-white/10 rounded-[3rem] flex items-center justify-center mb-12 text-7xl font-black shadow-2xl backdrop-blur-xl relative">
                    <div className="absolute inset-0 bg-indigo-500/5 blur-2xl rounded-full"></div>
                    <span className="relative text-white">{display?.registration_code || '---'}</span>
                </div>
                <h1 className="text-4xl font-black mb-4">Pair Your Display</h1>
                <p className="text-xl text-slate-400 max-w-sm mb-12">
                    Go to your dashboard and enter this code to start broadcasting content.
                </p>
                <div className="p-4 bg-white/5 rounded-2xl flex items-center gap-3 border border-white/5">
                    <div className={`w-3 h-3 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'} shadow-[0_0_10px_currentColor]`}></div>
                    <span className="text-sm font-bold text-slate-400">{online ? 'Connected to Network' : 'Disconnected'}</span>
                </div>
            </div>
        );
    }

    const renderSlide = () => {
        if (!currentSlide) return null;

        let data = { url: '' };
        try {
            data = JSON.parse(currentSlide.content);
        } catch (e) { }

        switch (currentSlide.type) {
            case 'image':
                return <img src={resolvedUrl} className={`w-full h-full animate-in fade-in duration-1000 ${currentSlide.scale_mode === 'contain' ? 'object-contain' : 'object-cover'}`} alt="" />;
            case 'video':
                return (
                    <video
                        src={resolvedUrl}
                        autoPlay
                        muted
                        loop
                        className={`w-full h-full animate-in fade-in duration-1000 ${currentSlide.scale_mode === 'contain' ? 'object-contain' : 'object-cover'}`}
                    />
                );
            case 'webpage':
                if (currentSlide.render_webpage && currentSlide.thumbnail_url) {
                    return <img src={currentSlide.thumbnail_url} className={`w-full h-full animate-in fade-in duration-1000 ${currentSlide.scale_mode === 'contain' ? 'object-contain' : 'object-cover'}`} alt="" />;
                }
                return <iframe src={resolvedUrl} className="w-full h-full border-none animate-in fade-in duration-1000" title="web-slide" />;
            case 'table':
                return (
                    <div className="w-full h-full flex items-center justify-center p-20 animate-in zoom-in duration-1000">
                        <div className="glass-card p-12 w-full max-w-6xl shadow-[0_0_100px_-20px_rgba(0,0,0,0.5)]">
                            <h2 className="text-4xl font-bold mb-8 text-indigo-400 uppercase tracking-tighter">Information Display</h2>
                            <div className="pre text-2xl text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                                {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
                            </div>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="text-center opacity-20">
                        <Monitor size={150} />
                        <p className="mt-4 font-black uppercase">Unsupported Format</p>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden flex items-center justify-center">
            {/* Playback Layer */}
            <div className="absolute inset-0 z-0">
                {renderSlide()}
            </div>

            {/* Offline Overlay */}
            {!online && (
                <div className="absolute bottom-8 left-8 z-50 flex items-center gap-2 bg-black/20 backdrop-blur-md text-white/30 px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase border border-white/5 animate-in fade-in slide-in-from-left-4 duration-1000">
                    <WifiOff size={14} className="opacity-50" />
                    Offline Mode
                </div>
            )}

            {/* Syncing Progress */}
            {syncing && (
                <div className="absolute top-8 right-8 z-50 flex items-center gap-4 bg-indigo-600/90 backdrop-blur-xl text-white px-6 py-4 rounded-[2rem] text-sm font-bold shadow-2xl animate-in slide-in-from-right-8">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    SYNCING CONTENT: {syncProgress}%
                </div>
            )}

            {/* Subtle overlay if no content */}
            {!currentSlide && (
                <div className="z-10 text-center opacity-10">
                    <Monitor size={200} className="mb-8 mx-auto" />
                    <h2 className="text-4xl font-black uppercase tracking-[1em] ml-[1em]">IDLE</h2>
                </div>
            )}
        </div>
    );
};

export default Player;
