import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Settings, User, Building, Save, Mail, Key, Shield, Trash2, Clock, Share2, Globe, Lock as LockIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const SettingsManager: React.FC = () => {
    const { t } = useTranslation();
    const { user: currentUser } = useAuth();
    const [activeSection, setActiveSection] = useState<'profile' | 'organization' | 'retention' | 'screenshare'>('profile');
    const [loading, setLoading] = useState(false);

    // Profile State
    const [email, setEmail] = useState(currentUser?.email || '');
    const [password, setPassword] = useState('');

    // Org State
    const [orgName, setOrgName] = useState('');
    const [enableOCR, setEnableOCR] = useState(false);
    const [screenshotInterval, setScreenshotInterval] = useState(0);
    const [allowOIDCAutoProvision, setAllowOIDCAutoProvision] = useState(false);
    const [oidcDomain, setOIDCDomain] = useState('');

    // Screenshare State
    const [iceProvider, setIceProvider] = useState('default');
    const [iceConfig, setIceConfig] = useState({
        key_id: '',
        key_token: ''
    });

    // Retention State
    const [retentionPolicy, setRetentionPolicy] = useState({
        user_upload_retention: 30,
        system_upload_retention: 1,
        log_retention: {
            audit: 30,
            worker: 7,
            api: 7,
            burp: 7
        }
    });

    useEffect(() => {
        if (activeSection === 'organization' || activeSection === 'retention' || activeSection === 'screenshare') {
            fetchOrgSettings();
        }
    }, [activeSection]);

    const fetchOrgSettings = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/settings/org');
            setOrgName(res.data.name);
            setEnableOCR(res.data.enable_ocr);
            setScreenshotInterval(res.data.screenshot_interval || 0);
            setAllowOIDCAutoProvision(res.data.allow_oidc_auto_provision);
            setOIDCDomain(res.data.oidc_domain || '');
            setIceProvider(res.data.ice_provider || 'default');
            if (res.data.ice_config) {
                try {
                    setIceConfig(JSON.parse(res.data.ice_config));
                } catch (e) {
                    console.error("Failed to parse ice config", e);
                }
            }
            if (res.data.retention_policy) {
                try {
                    setRetentionPolicy(JSON.parse(res.data.retention_policy));
                } catch (e) {
                    console.error("Failed to parse retention policy", e);
                }
            }
        } catch (err) {
            console.error("Failed to fetch org settings", err);
        } finally {
            setLoading(false);
        }
    };

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData();
        formData.append('email', email);
        if (password) formData.append('password', password);

        try {
            await axios.put('/api/settings/profile', formData);
            alert(t('settings.alerts.profile_success'));
            setPassword('');
        } catch (err) {
            alert(t('settings.alerts.profile_fail'));
        } finally {
            setLoading(false);
        }
    };

    const handleOrgUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData();
        formData.append('name', orgName);
        formData.append('enable_ocr', String(enableOCR));
        formData.append('screenshot_interval', String(screenshotInterval));
        formData.append('allow_oidc_auto_provision', String(allowOIDCAutoProvision));
        formData.append('oidc_domain', oidcDomain);
        formData.append('retention_policy', JSON.stringify(retentionPolicy));
        formData.append('ice_provider', iceProvider);
        formData.append('ice_config', JSON.stringify(iceConfig));

        try {
            await axios.put('/api/settings/org', formData);
            alert(t('settings.alerts.org_success'));
        } catch (err: any) {
            console.error("Failed to update organization", err);
            const errorMessage = err.response?.data?.error || t('settings.alerts.org_fail');
            alert(errorMessage);
            if (errorMessage.includes("Tesseract")) {
                setEnableOCR(false);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-[var(--text-main)] mb-1">{t('settings.title')}</h3>
                    <p className="text-slate-400 text-sm">{t('settings.subtitle')}</p>
                </div>
            </div>

            <div className="flex gap-8">
                {/* Sidebar-like tabs */}
                <div className="w-64 space-y-2">
                    <button
                        onClick={() => setActiveSection('profile')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all
                            ${activeSection === 'profile' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-main)]'}`}
                    >
                        <User size={18} />
                        {t('settings.tabs.profile')}
                    </button>
                    <button
                        onClick={() => setActiveSection('organization')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all
                            ${activeSection === 'organization' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-main)]'}`}
                    >
                        <Building size={18} />
                        {t('settings.tabs.organization')}
                    </button>
                    <button
                        onClick={() => setActiveSection('retention')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all
                            ${activeSection === 'retention' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-main)]'}`}
                    >
                        <Trash2 size={18} />
                        {t('settings.tabs.retention')}
                    </button>
                    <button
                        onClick={() => setActiveSection('screenshare')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all
                            ${activeSection === 'screenshare' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-main)]'}`}
                    >
                        <Share2 size={18} />
                        {t('settings.tabs.screenshare')}
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 glass-card p-8 border border-[var(--border-subtle)]" style={{ backgroundColor: 'var(--bg-card)' }}>
                    {activeSection === 'profile' && (
                        <form onSubmit={handleProfileUpdate} className="space-y-6">
                            <h4 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2 mb-4">
                                <User className="text-indigo-400" />
                                {t('settings.profile.title')}
                            </h4>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('settings.profile.email_address')}</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl py-3 pl-10 pr-4 text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('settings.profile.new_password')}</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={t('settings.profile.password_hint')}
                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl py-3 pl-10 pr-4 text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary flex items-center gap-2 px-6"
                            >
                                <Save size={18} />
                                {t('settings.profile.update_button')}
                            </button>
                        </form>
                    )}

                    {activeSection === 'organization' && (
                        <form onSubmit={handleOrgUpdate} className="space-y-6">
                            <h4 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2 mb-4">
                                <Building className="text-indigo-400" />
                                {t('settings.organization.title')}
                            </h4>

                            <div className="space-y-4">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('settings.organization.name')}</label>
                                <input
                                    type="text"
                                    value={orgName}
                                    onChange={(e) => setOrgName(e.target.value)}
                                    disabled={currentUser?.role !== 'admin'}
                                    className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl py-3 px-4 text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                />

                                <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                                <Settings size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-[var(--text-main)] leading-tight">{t('settings.organization.enable_ocr')}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{t('settings.organization.ocr_desc')}</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={enableOCR}
                                                onChange={(e) => setEnableOCR(e.target.checked)}
                                                disabled={currentUser?.role !== 'admin'}
                                            />
                                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                                        </label>
                                    </div>

                                    <div className="pt-2 border-t border-white/5">
                                        <p className="text-[10px] text-slate-400 font-medium italic">
                                            {t('settings.organization.ocr_requirement')}{" "}
                                            <a
                                                href="https://tesseract-ocr.github.io/tessdoc/Installation.html"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-400 hover:underline inline-flex items-center gap-1"
                                            >
                                                {t('settings.organization.ocr_guide')}
                                            </a>
                                        </p>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-[var(--text-main)] leading-tight">{t('settings.organization.screenshots')}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">{t('settings.organization.screenshots_desc')}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xl font-black text-indigo-400">
                                                {screenshotInterval === 0 ? t('settings.organization.disabled') : `${screenshotInterval}m`}
                                            </span>
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="60"
                                        step="5"
                                        value={screenshotInterval}
                                        onChange={(e) => setScreenshotInterval(parseInt(e.target.value))}
                                        disabled={currentUser?.role !== 'admin'}
                                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
                                    />
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                        <span>{t('settings.organization.off')}</span>
                                        <span>15m</span>
                                        <span>30m</span>
                                        <span>45m</span>
                                        <span>60m</span>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                                <Shield size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-[var(--text-main)] leading-tight">{t('settings.organization.oidc_title')}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{t('settings.organization.oidc_desc')}</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={allowOIDCAutoProvision}
                                                onChange={(e) => setAllowOIDCAutoProvision(e.target.checked)}
                                                disabled={currentUser?.role !== 'admin'}
                                            />
                                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                                        </label>
                                    </div>

                                    {allowOIDCAutoProvision && (
                                        <div className="pt-2 space-y-2 animate-in slide-in-from-top-2 duration-300">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t('settings.organization.oidc_domain')}</label>
                                            <input
                                                type="text"
                                                value={oidcDomain}
                                                onChange={(e) => setOIDCDomain(e.target.value)}
                                                placeholder={t('settings.organization.oidc_placeholder')}
                                                disabled={currentUser?.role !== 'admin'}
                                                className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl py-2 px-4 text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                            />
                                            <p className="text-[10px] text-amber-500/80 font-medium italic">
                                                {t('settings.organization.oidc_hint')}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {currentUser?.role !== 'admin' && (
                                    <p className="text-[10px] text-amber-500 flex items-center gap-1 mt-1 font-bold italic uppercase">
                                        <Shield size={10} />
                                        {t('settings.organization.admin_only')}
                                    </p>
                                )}
                            </div>

                            {currentUser?.role === 'admin' && (
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary flex items-center gap-2 px-6"
                                >
                                    <Save size={18} />
                                    {t('common.save')}
                                </button>
                            )}
                        </form>
                    )}

                    {activeSection === 'retention' && (
                        <form onSubmit={handleOrgUpdate} className="space-y-6 animate-in fade-in duration-300">
                            <h4 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2 mb-4">
                                <Trash2 className="text-indigo-400" />
                                {t('settings.retention.title')}
                            </h4>

                            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 mb-6">
                                <h5 className="font-bold text-amber-500 text-sm mb-1 flex items-center gap-2">
                                    <Clock size={14} />
                                    {t('settings.retention.cleanup_title')}
                                </h5>
                                <p className="text-xs text-slate-400">
                                    {t('settings.retention.cleanup_desc')}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h5 className="font-bold text-[var(--text-main)] text-sm border-b border-[var(--border-subtle)] pb-2">{t('settings.retention.storage_title')}</h5>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('settings.retention.trash')}</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={retentionPolicy.user_upload_retention}
                                                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, user_upload_retention: parseInt(e.target.value) })}
                                                disabled={currentUser?.role !== 'admin'}
                                                className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl py-2 px-4 text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                            />
                                            <span className="text-sm text-slate-400 font-bold w-12">{t('settings.retention.days')}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('settings.retention.screenshots')}</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={retentionPolicy.system_upload_retention}
                                                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, system_upload_retention: parseInt(e.target.value) })}
                                                disabled={currentUser?.role !== 'admin'}
                                                className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl py-2 px-4 text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                            />
                                            <span className="text-sm text-slate-400 font-bold w-12">{t('settings.retention.days')}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h5 className="font-bold text-[var(--text-main)] text-sm border-b border-[var(--border-subtle)] pb-2">{t('settings.retention.logs_title')}</h5>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('settings.retention.audit')}</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={retentionPolicy.log_retention.audit}
                                                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, log_retention: { ...retentionPolicy.log_retention, audit: parseInt(e.target.value) } })}
                                                disabled={currentUser?.role !== 'admin'}
                                                className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl py-2 px-4 text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                            />
                                            <span className="text-sm text-slate-400 font-bold w-12">{t('settings.retention.days')}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('settings.retention.worker')}</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={retentionPolicy.log_retention.worker}
                                                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, log_retention: { ...retentionPolicy.log_retention, worker: parseInt(e.target.value) } })}
                                                disabled={currentUser?.role !== 'admin'}
                                                className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl py-2 px-4 text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                            />
                                            <span className="text-sm text-slate-400 font-bold w-12">{t('settings.retention.days')}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('settings.retention.api')}</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={retentionPolicy.log_retention.api}
                                                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, log_retention: { ...retentionPolicy.log_retention, api: parseInt(e.target.value) } })}
                                                disabled={currentUser?.role !== 'admin'}
                                                className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl py-2 px-4 text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                            />
                                            <span className="text-sm text-slate-400 font-bold w-12">{t('settings.retention.days')}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('settings.retention.burp')}</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={retentionPolicy.log_retention.burp}
                                                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, log_retention: { ...retentionPolicy.log_retention, burp: parseInt(e.target.value) } })}
                                                disabled={currentUser?.role !== 'admin'}
                                                className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl py-2 px-4 text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                            />
                                            <span className="text-sm text-slate-400 font-bold w-12">{t('settings.retention.days')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {currentUser?.role === 'admin' && (
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary flex items-center gap-2 px-6"
                                >
                                    <Save size={18} />
                                    {t('settings.retention.save_policy')}
                                </button>
                            )}
                        </form>
                    )}

                    {activeSection === 'screenshare' && (
                        <form onSubmit={handleOrgUpdate} className="space-y-6 animate-in fade-in duration-300">
                            <h4 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2 mb-4">
                                <Share2 className="text-indigo-400" />
                                {t('settings.screenshare.title')}
                            </h4>

                            <div className="space-y-4">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('settings.screenshare.provider_label')}</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setIceProvider('default')}
                                        className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${iceProvider === 'default' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-slate-400 hover:border-slate-600'}`}
                                    >
                                        <Globe size={24} />
                                        <div className="text-center">
                                            <p className="font-bold text-sm">Default</p>
                                            <p className="text-[10px] opacity-60">Public STUN servers</p>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIceProvider('cloudflare')}
                                        className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${iceProvider === 'cloudflare' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-slate-400 hover:border-slate-600'}`}
                                    >
                                        <Shield size={24} />
                                        <div className="text-center">
                                            <p className="font-bold text-sm">Cloudflare TURN</p>
                                            <p className="text-[10px] opacity-60">High reliability Relay</p>
                                        </div>
                                    </button>
                                </div>

                                {iceProvider === 'cloudflare' && (
                                    <div className="space-y-4 p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t('settings.screenshare.cloudflare_key_id')}</label>
                                            <input
                                                type="text"
                                                value={iceConfig.key_id}
                                                onChange={(e) => setIceConfig({ ...iceConfig, key_id: e.target.value })}
                                                placeholder="e.g. 1a2b3c..."
                                                className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl py-2 px-4 text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t('settings.screenshare.cloudflare_key_token')}</label>
                                            <div className="relative">
                                                <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                                <input
                                                    type="password"
                                                    value={iceConfig.key_token}
                                                    onChange={(e) => setIceConfig({ ...iceConfig, key_token: e.target.value })}
                                                    placeholder="Enter Cloudflare Key Token"
                                                    className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl py-2 pl-9 pr-4 text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-500 italic">
                                            Generate these in your Cloudflare Dashboard under Real-time &gt; TURN.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {currentUser?.role === 'admin' && (
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary flex items-center gap-2 px-6"
                                >
                                    <Save size={18} />
                                    {t('common.save')}
                                </button>
                            )}
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsManager;
