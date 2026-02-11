import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Monitor, Wifi, WifiOff, AlertTriangle, Share2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useTranslation } from 'react-i18next';
import ScreenshareOverlay from '../components/ScreenshareOverlay';

const ScrollingWebImage: React.FC<{ src: string; durationSec: number; scaleMode?: string }> = ({ src, durationSec, scaleMode }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [scrollNeeded, setScrollNeeded] = useState(false);
    const [keyframeStyle, setKeyframeStyle] = useState("");

    const handleLoad = () => {
        const img = imgRef.current;
        const container = containerRef.current;
        if (!img || !container) return;

        const containerW = container.clientWidth;
        const containerH = container.clientHeight;

        // Use 98% width to reduce the "zoomed in" feel
        const targetW = containerW * 0.98;
        const scaledH = (img.naturalHeight / img.naturalWidth) * targetW;

        if (scaledH > containerH * 1.05) {
            setScrollNeeded(true);
            const totalOverflow = scaledH - containerH;

            // Calculate steps (number of viewports)
            const steps = Math.max(1, Math.ceil(scaledH / containerH));

            // Generate keyframes for incremental scroll
            let kfs = `@keyframes scrollWebSnap {`;
            const stepPercent = 100 / steps;
            const transitionPercent = stepPercent * 0.2; // 20% of step time for transition

            for (let i = 0; i < steps; i++) {
                const startPause = i * stepPercent;
                const endPause = (i + 1) * stepPercent - (i === steps - 1 ? 0 : transitionPercent);
                const pos = Math.min(i * containerH, totalOverflow);

                kfs += `\n  ${startPause.toFixed(2)}%, ${endPause.toFixed(2)}% { transform: translateY(-${pos}px); }`;
            }
            kfs += "\n}";
            setKeyframeStyle(kfs);
        } else {
            setScrollNeeded(false);
        }
    };

    if (!scrollNeeded) {
        return (
            <div ref={containerRef} className="w-full h-full flex items-center justify-center">
                <img
                    ref={imgRef}
                    src={src}
                    onLoad={handleLoad}
                    className={`max-w-[98%] max-h-full animate-in fade-in duration-1000 ${scaleMode === 'contain' ? 'object-contain' : 'object-cover'}`}
                    alt=""
                />
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full h-full overflow-hidden flex flex-col items-center">
            <img
                ref={imgRef}
                src={src}
                onLoad={handleLoad}
                alt=""
                className="animate-in fade-in duration-1000"
                style={{
                    width: '98%',
                    display: 'block',
                    animation: `scrollWebSnap ${durationSec}s linear forwards`,
                }}
            />
            {keyframeStyle && <style>{keyframeStyle}</style>}
        </div>
    );
};

const Player: React.FC = () => {
    const { t } = useTranslation();
    const [display, setDisplay] = useState<any>(null);
    const [currentSlide, setCurrentSlide] = useState<any>(null);
    const [resolvedUrl, setResolvedUrl] = useState<string>('');
    const [status, setStatus] = useState<'unregistered' | 'pending' | 'active'>('unregistered');
    const [online, setOnline] = useState(true);
    const [playlist, setPlaylist] = useState<any>(null);
    const [slideIndex, setSlideIndex] = useState(0);
    const [slideDuration, setSlideDuration] = useState(10);

    const [schedules, setSchedules] = useState<any[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [screenshotInterval, setScreenshotInterval] = useState(0);

    // Screenshare State
    const [screenshareCode, setScreenshareCode] = useState('');
    const [isScreensharing, setIsScreensharing] = useState(false);
    const [screenshareGuestName, setScreenshareGuestName] = useState('');
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const signalingPendingRef = useRef<any[]>([]);
    const isInitializingPCRef = useRef(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);

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
                (window as any)._playerWS = socket;
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
        return () => {
            socket?.close();
            (window as any)._playerWS = null;
        };
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
            case 'FORCE_SCREENSHARE':
                setScreenshareGuestName(msg.payload.guest_name || t('screenshare.active_guest'));
                setIsScreensharing(true);
                break;
            case 'screenshare_signal':
                handleScreenshareSignal(msg.payload);
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

        const durationSec = currentSlideData.duration || 10;
        setSlideDuration(durationSec);
        const duration = durationSec * 1000;
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

    const fetchScreenshareCode = async () => {
        if (status !== 'active') return;

        // Check if local pairing is allowed
        if (display && display.allow_local_pairing === false) {
            setScreenshareCode('');
            return;
        }

        try {
            const id = localStorage.getItem('display_id');
            const res = await axios.get(`/api/screenshare/code?display_id=${id}`, getHeaders());
            setScreenshareCode(res.data.code);
            console.log("[Screenshare] New pairing code generated:", res.data.code);
        } catch (e) {
            console.error("Failed to fetch pairing code", e);
        }
    };

    // Pairing Code Retrieval
    useEffect(() => {
        if (status !== 'active') return;
        fetchScreenshareCode();
        const interval = setInterval(fetchScreenshareCode, 5 * 60 * 1000); // Life insurance: refresh every 5 mins
        return () => clearInterval(interval);
    }, [status, display]); // Added display dependency to react to config changes

    const handleScreenshareSignal = async (payload: any) => {
        const { signal, session_id, guest_name } = payload;
        if (guest_name) setScreenshareGuestName(guest_name);

        if (!pcRef.current && !isInitializingPCRef.current) {
            isInitializingPCRef.current = true;
            try {
                const iceRes = await axios.get('/api/screenshare/ice');
                const pc = new RTCPeerConnection({ iceServers: iceRes.data });

                pc.ontrack = (event) => {
                    console.log("[WebRTC] Remote track received", event.streams[0]);
                    setRemoteStream(event.streams[0]);
                    setIsScreensharing(true);
                };

                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        sendSignalToSharer(session_id, JSON.stringify(event.candidate));
                    }
                };

                pc.oniceconnectionstatechange = () => {
                    console.log("[WebRTC] ICE Connection State:", pc.iceConnectionState);
                    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
                        console.log("[WebRTC] Screenshare stopping due to ICE state:", pc.iceConnectionState);
                        stopScreenshare();
                    }
                };

                pcRef.current = pc;
                isInitializingPCRef.current = false;

                // Process buffered signals
                const pending = signalingPendingRef.current;
                signalingPendingRef.current = [];
                for (const sig of pending) {
                    await processSignal(sig, session_id);
                }

                // Process current signal
                await processSignal(signal, session_id);
            } catch (err) {
                console.error("Failed to initialize WebRTC", err);
                isInitializingPCRef.current = false;
            }
        } else if (isInitializingPCRef.current) {
            signalingPendingRef.current.push(signal);
        } else {
            await processSignal(signal, session_id);
        }
    };

    const processSignal = async (signal: string, session_id: number) => {
        if (!pcRef.current) return;
        try {
            const data = JSON.parse(signal);
            console.log("[WebRTC] Processing incoming signal:", data.type || (data.candidate ? 'candidate' : 'unknown'));
            if (data.type === 'offer') {
                await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
                const answer = await pcRef.current.createAnswer();
                await pcRef.current.setLocalDescription(answer);
                console.log("[WebRTC] Sending answer back to sharer");
                sendSignalToSharer(session_id, JSON.stringify(answer));
            } else if (data.candidate) {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(data));
            }
        } catch (e) {
            console.error("[WebRTC] Failed to process signal", e);
        }
    };

    const stopScreenshare = () => {
        pcRef.current?.close();
        pcRef.current = null;
        setRemoteStream(null);
        setIsScreensharing(false);
        setScreenshareGuestName('');
        // Regenerate code immediately after a session ends for security/freshness
        fetchScreenshareCode();
    };

    const sendSignalToSharer = (sessionId: number, signal: string) => {
        const ws = (window as any)._playerWS;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'screenshare_signal',
                payload: {
                    session_id: sessionId,
                    signal: signal
                }
            }));
        }
    };

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

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
                    {t('player.not_registered')}<br />{t('player.generate_claim_hint')}
                </p>
                <button
                    onClick={registerDisplay}
                    className="px-10 py-5 bg-indigo-500 hover:bg-indigo-600 rounded-3xl font-black text-2xl transition-all shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] active:scale-95"
                >
                    {t('player.register_button')}
                </button>
            </div>
        );
    }

    if (status === 'pending') {
        return (
            <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-center text-white">
                <div className="mb-8 text-slate-500 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></div>
                    {t('player.waiting_link')}
                </div>
                <div className="w-48 h-48 bg-white/5 border border-white/10 rounded-[3rem] flex items-center justify-center mb-12 text-7xl font-black shadow-2xl backdrop-blur-xl relative">
                    <div className="absolute inset-0 bg-indigo-500/5 blur-2xl rounded-full"></div>
                    <span className="relative text-white">{display?.registration_code || '---'}</span>
                </div>
                <h1 className="text-4xl font-black mb-4">{t('player.pair_title')}</h1>
                <p className="text-xl text-slate-400 max-w-sm mb-12">
                    {t('player.pair_desc')}
                </p>
                <div className="p-4 bg-white/5 rounded-2xl flex items-center gap-3 border border-white/5">
                    <div className={`w-3 h-3 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'} shadow-[0_0_10px_currentColor]`}></div>
                    <span className="text-sm font-bold text-slate-400">{online ? t('player.connected') : t('player.disconnected')}</span>
                </div>
            </div>
        );
    }

    const renderSlide = () => {
        if (!currentSlide) return null;

        let data: any = { url: '' };
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
                    return <ScrollingWebImage src={currentSlide.thumbnail_url} durationSec={slideDuration} scaleMode={currentSlide.scale_mode} />;
                }
                return <iframe src={resolvedUrl} className="w-full h-full border-none animate-in fade-in duration-1000" title="web-slide" />;
            case 'table':
                const theme = data?.theme || 'default';
                const rows = data?.rows || [];
                const headers = rows.length > 0 ? rows[0] : [];
                const body = rows.length > 1 ? rows.slice(1) : [];

                return (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 lg:p-12 animate-in zoom-in-95 duration-700">
                        <div className={`table-container theme-${theme} w-full max-w-[95%] max-h-[90%] overflow-hidden flex flex-col`}>
                            <table className="player-table w-full">
                                <thead>
                                    <tr>
                                        {headers.map((h: string, i: number) => (
                                            <th key={i}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="overflow-y-auto">
                                    {body.map((row: string[], ri: number) => (
                                        <tr key={ri}>
                                            {row.map((cell: string, ci: number) => (
                                                <td key={ci}>{cell}</td>
                                            ))}
                                        </tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <tr>
                                            <td className="text-center py-20 text-slate-500 italic">{t('player.no_table_data')}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'html':
                const html = data?.html || '';
                const css = data?.css || '';
                const js = data?.js || '';
                const variables = data?.variables || {};

                // Simple variable injection: Replace {{key}} with value
                let finalHtml = html;
                if (variables) {
                    Object.keys(variables).forEach(key => {
                        const val = variables[key];
                        finalHtml = finalHtml.replaceAll(`{{${key}}}`, val);
                    });
                }

                const combinedContent = `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body, html { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background: transparent; color: white; font-family: sans-serif; }
                                ${css}
                            </style>
                        </head>
                        <body>
                            ${finalHtml}
                            <script>
                                (function() {
                                    try {
                                        const CONFIG = ${JSON.stringify(variables || {})};
                                        ${js}
                                    } catch (e) {
                                        console.error("Custom JS Error:", e);
                                    }
                                })();
                            </script>
                        </body>
                    </html>
                `;

                return (
                    <div className="w-full h-full animate-in fade-in duration-700">
                        <iframe
                            title="HTML Slide"
                            srcDoc={combinedContent}
                            className="w-full h-full border-0"
                            sandbox="allow-scripts"
                        />
                    </div>
                );
            case 'screenshare':
                return (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                        {!isScreensharing && (
                            <div className="text-center opacity-30 animate-pulse">
                                <Share2 size={120} className="mb-4 mx-auto" />
                                <h2 className="text-2xl font-black uppercase tracking-widest">{t('player.awaiting_share')}</h2>
                            </div>
                        )}
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full ${isScreensharing ? 'block' : 'hidden'}`}
                        />
                    </div>
                );
            default:
                return (
                    <div className="text-center opacity-20">
                        <Monitor size={150} />
                        <p className="mt-4 font-black uppercase">{t('player.unsupported_format')}</p>
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
                    {t('player.offline_mode')}
                </div>
            )}

            {/* Syncing Progress */}
            {syncing && (
                <div className="absolute top-8 right-8 z-50 flex items-center gap-4 bg-indigo-600/90 backdrop-blur-xl text-white px-6 py-4 rounded-[2rem] text-sm font-bold shadow-2xl animate-in slide-in-from-right-8">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {t('player.syncing', { progress: syncProgress })}
                </div>
            )}

            {/* Subtle overlay if no content */}
            {!currentSlide && !isScreensharing && (
                <div className="z-10 text-center opacity-10">
                    <Monitor size={200} className="mb-8 mx-auto" />
                    <h2 className="text-4xl font-black uppercase tracking-[1em] ml-[1em]">{t('player.idle')}</h2>
                </div>
            )}

            {/* Screenshare Overlay (Global takeover) */}
            {isScreensharing && currentSlide?.type !== 'screenshare' && (
                <div className="absolute inset-0 z-[100] bg-black">
                    <video
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full"
                        ref={(el) => { if (el) el.srcObject = remoteStream; }}
                    />
                </div>
            )}

            {/* Pairing Code Overlay */}
            {screenshareCode && (
                <ScreenshareOverlay
                    code={screenshareCode}
                    isConnected={isScreensharing}
                    guestName={screenshareGuestName}
                    oidcRequired={currentSlide?.oidc_required || display?.ScreenshareOIDCRequired}
                />
            )}
        </div>
    );
};

export default Player;
