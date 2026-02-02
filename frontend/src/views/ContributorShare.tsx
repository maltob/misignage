import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Share2, Lock, ShieldCheck, AlertCircle, StopCircle, User, ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const ContributorShare: React.FC = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const [code, setCode] = useState('');
    const [name, setName] = useState(localStorage.getItem('share_name') || '');
    const [status, setStatus] = useState<'idle' | 'joining' | 'sharing' | 'error'>('idle');
    const [error, setError] = useState('');
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [iceServers, setIceServers] = useState<any[]>([]);

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const pollingRef = useRef<boolean>(false);

    useEffect(() => {
        const directSession = location.state?.directSession;
        if (directSession && status === 'idle') {
            setSessionId(directSession.session_id);
            setIceServers(directSession.ice_servers);
            setStatus('sharing');
            startWebRTC(directSession.session_id, directSession.ice_servers);
        }
    }, [location.state, status]);

    useEffect(() => {
        let isActive = true;
        if (status === 'sharing' && sessionId) {
            console.log(`[WebRTC] Starting signaling polling for session ${sessionId}`);
            startSignalingPolling(sessionId, () => isActive);
        }
        return () => {
            isActive = false;
            pollingRef.current = false;
        };
    }, [status, sessionId]);

    const startSignalingPolling = async (sid: number, isEffectActive: () => boolean) => {
        pollingRef.current = true;
        while (pollingRef.current && isEffectActive()) {
            try {
                const res = await axios.get(`/api/screenshare/${sid}/receive`);
                if (!isEffectActive()) break;

                if (res.status === 200 && res.data.signal) {
                    const signal = JSON.parse(res.data.signal);
                    if (signal.type === 'answer') {
                        console.log("[WebRTC] Received answer from display");
                        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(signal));
                    } else if (signal.candidate) {
                        console.log("[WebRTC] Received ICE candidate from display");
                        await pcRef.current?.addIceCandidate(new RTCIceCandidate(signal));
                    }
                }
            } catch (err) {
                if (!isEffectActive()) break;
                console.error("Polling error", err);
                if (axios.isAxiosError(err) && err.response?.status === 404) break;
            }
            await new Promise(r => setTimeout(r, 200));
        }
        console.log(`[WebRTC] Signaling polling stopped for session ${sid}`);
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) {
            setError(t('contributor.errors.invalid_code'));
            return;
        }
        if (!name) {
            setError(t('contributor.errors.name_required'));
            return;
        }

        if (!window.isSecureContext) {
            setError(t('contributor.errors.secure_context'));
            setStatus('error');
            return;
        }

        setStatus('joining');
        setError('');
        localStorage.setItem('share_name', name);

        try {
            const formData = new FormData();
            formData.append('code', code);
            formData.append('name', name);

            const res = await axios.post('/api/screenshare/join', formData);
            setSessionId(res.data.session_id);
            setIceServers(res.data.ice_servers);

            await startWebRTC(res.data.session_id, res.data.ice_servers);
            setStatus('sharing');
        } catch (err: any) {
            setStatus('error');
            setError(err.response?.data?.error || t('contributor.errors.generic_fail'));
        }
    };

    const startWebRTC = async (sid: number, ice: any[]) => {
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" } as any,
                audio: false
            } as any);
        } catch (e: any) {
            if (e.name === 'NotAllowedError') throw new Error(t('contributor.errors.permission_denied'));
            if (e.name === 'NotFoundError') throw new Error(t('contributor.errors.no_device'));
            throw e;
        }
        streamRef.current = stream;

        const pc = new RTCPeerConnection({ iceServers: ice });
        pcRef.current = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("[WebRTC] Local ICE candidate generated");
                sendSignal(sid, JSON.stringify(event.candidate));
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log("[WebRTC] Created and set local offer, sending to display...");
        sendSignal(sid, JSON.stringify(offer));

        stream.getVideoTracks()[0].onended = () => {
            console.log("[WebRTC] User stopped screen capture from browser UI");
            stopSharing();
        };

    };

    const sendSignal = async (sid: number, signal: string) => {
        await axios.post(`/api/screenshare/${sid}/signal`, { signal });
    };

    const stopSharing = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        pcRef.current?.close();
        pcRef.current = null;
        streamRef.current = null;
        setStatus('idle');
        setSessionId(null);
        pollingRef.current = false;
    };

    return (
        <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500 blur-[120px] rounded-full"></div>
            </div>

            <button
                onClick={() => navigate(-1)}
                className="absolute top-8 left-8 flex items-center gap-2 text-slate-400 hover:text-white transition-all font-bold uppercase tracking-widest text-xs z-20 group"
            >
                <div className="p-2 bg-[var(--sidebar-hover)] rounded-lg group-hover:bg-indigo-500 transition-all">
                    <ArrowLeft size={16} />
                </div>
                {t('common.back')}
            </button>

            <div className="w-full max-w-md z-10">
                <div className="flex flex-col items-center mb-8">
                    <div className="p-4 bg-indigo-500 rounded-[2rem] shadow-2xl shadow-indigo-500/20 mb-6 group transition-transform hover:scale-110">
                        <Share2 size={32} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-black mb-2 tracking-tight text-[var(--text-main)]">{t('contributor.title')}</h1>
                    <p className="text-slate-400 font-medium text-center">{t('contributor.subtitle')}</p>
                </div>

                {status !== 'sharing' ? (
                    <form onSubmit={handleJoin} className="glass-card p-8 border border-[var(--border-subtle)] shadow-2xl flex flex-col gap-6 scale-in-center" style={{ backgroundColor: 'var(--bg-card)' }}>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">{t('contributor.pairing_code_label')}</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-indigo-400" size={20} />
                                <input
                                    type="text"
                                    maxLength={6}
                                    placeholder={t('contributor.code_placeholder')}
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    className="w-full bg-[var(--input-bg)] border border-[var(--glass-border)] rounded-2xl py-4 pl-12 pr-4 text-center text-2xl font-black tracking-[0.5em] text-[var(--text-main)] placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all uppercase"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">{t('contributor.name_label')}</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-indigo-400" size={20} />
                                <input
                                    type="text"
                                    placeholder={t('contributor.name_placeholder')}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-sm font-bold animate-shake">
                                <AlertCircle size={18} />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'joining'}
                            className="w-full py-5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 rounded-3xl font-black text-lg transition-all shadow-[0_20px_40px_-15px_rgba(99,102,241,0.5)] active:scale-95 flex items-center justify-center gap-2"
                        >
                            {status === 'joining' ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>{t('contributor.connect_button')}</>
                            )}
                        </button>
                    </form>
                ) : (
                    <div className="glass-card p-12 border border-white/10 shadow-2xl flex flex-col items-center gap-8 scale-in-center">
                        <div className="relative">
                            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center animate-pulse">
                                <Share2 size={48} className="text-emerald-500" />
                            </div>
                            <div className="absolute top-0 right-0 w-6 h-6 bg-emerald-500 border-4 border-[#020617] rounded-full"></div>
                        </div>

                        <div className="text-center">
                            <h2 className="text-3xl font-black mb-2 text-white">{t('contributor.broadcasting')}</h2>
                            <p className="text-slate-400 font-medium">{t('contributor.broadcasting_desc')}</p>
                        </div>

                        <div className="w-full flex flex-col gap-4">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                                <ShieldCheck size={20} className="text-emerald-500" />
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('contributor.connection_label')}</p>
                                    <p className="text-sm font-bold">{t('contributor.connection_value')}</p>
                                </div>
                            </div>

                            <button
                                onClick={stopSharing}
                                className="w-full py-5 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white group rounded-3xl font-black text-red-500 transition-all active:scale-95 flex items-center justify-center gap-3"
                            >
                                <StopCircle size={20} className="group-hover:animate-pulse" />
                                {t('contributor.stop_button')}
                            </button>
                        </div>
                    </div>
                )}

                <div className="mt-8 flex items-center justify-center gap-3 opacity-30 text-[10px] font-black uppercase tracking-[0.3em]">
                    <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
                    {t('common.powered_by')}
                    <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
                </div>
            </div>
        </div>
    );
};

export default ContributorShare;
