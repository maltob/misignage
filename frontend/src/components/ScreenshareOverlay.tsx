import React from 'react';
import { Tv, ShieldCheck, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ScreenshareOverlayProps {
    code: string;
    isConnected: boolean;
    guestName?: string;
    oidcRequired?: boolean;
}

const ScreenshareOverlay: React.FC<ScreenshareOverlayProps> = ({ code, isConnected, guestName, oidcRequired }) => {
    const { t } = useTranslation();

    if (isConnected) {
        return (
            <div className="absolute top-8 left-8 z-50 flex items-center gap-4 bg-emerald-600/90 backdrop-blur-xl text-white px-6 py-4 rounded-[2rem] text-sm font-bold shadow-2xl animate-in fade-in slide-in-from-left-8">
                <div className="relative">
                    <Share2 size={24} className="text-white" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping"></div>
                </div>
                <div>
                    <p className="text-[10px] uppercase tracking-widest opacity-70">{t('screenshare.live_label')}</p>
                    <p className="text-lg font-black">{guestName || t('screenshare.active_guest')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute bottom-12 right-12 z-50 flex flex-col items-end gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="glass-card p-8 border border-[var(--border-subtle)] shadow-2xl flex flex-col items-center gap-6 min-w-[320px]" style={{ backgroundColor: 'var(--bg-modal)' }}>
                <div className="flex items-center gap-3 self-start mb-2">
                    <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20">
                        <Tv size={24} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-[var(--text-main)]">{t('screenshare.title')}</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{t('screenshare.subtitle')}</p>
                    </div>
                </div>

                <div className="w-full flex flex-col gap-2">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">
                        {t('screenshare.connect_at', { host: window.location.host })}
                    </div>
                    <div className="bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-3xl p-6 flex items-center justify-center text-6xl font-black tracking-widest text-[var(--text-main)] shadow-inner">
                        {code.split('').map((char, i) => (
                            <span key={i} className="inline-block hover:text-indigo-400 transition-colors">{char}</span>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4 text-slate-400">
                    <div className="flex items-center gap-2 px-4 py-2 bg-[var(--sidebar-hover)] rounded-full border border-[var(--border-subtle)]">
                        <ShieldCheck size={14} className={oidcRequired ? "text-amber-500" : "text-emerald-500"} />
                        <span className="text-[10px] font-bold uppercase text-[var(--text-main)]">
                            {oidcRequired ? t('screenshare.oidc_required') : t('screenshare.guest_access')}
                        </span>
                    </div>
                    <div className="text-[10px] font-bold opacity-30 uppercase tracking-widest">{t('common.powered_by')}</div>
                </div>
            </div>
        </div>
    );
};

export default ScreenshareOverlay;
