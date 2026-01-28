import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Settings, User, Building, Save, Mail, Key, Shield, Trash2, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SettingsManager: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [activeSection, setActiveSection] = useState<'profile' | 'organization' | 'retention'>('profile');
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
        if (activeSection === 'organization' || activeSection === 'retention') {
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
            alert("Profile updated successfully!");
            setPassword('');
        } catch (err) {
            alert("Failed to update profile");
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

        try {
            await axios.put('/api/settings/org', formData);
            alert("Settings updated!");
        } catch (err: any) {
            console.error("Failed to update organization", err);
            const errorMessage = err.response?.data?.error || "Failed to update organization settings";
            alert(errorMessage);
            // Revert local state if it was an OCR toggle failure (optional but good UX)
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
                    <h3 className="text-2xl font-bold text-white mb-1">Settings</h3>
                    <p className="text-slate-400 text-sm">Manage your personal and organization preferences</p>
                </div>
            </div>

            <div className="flex gap-8">
                {/* Sidebar-like tabs */}
                <div className="w-64 space-y-2">
                    <button
                        onClick={() => setActiveSection('profile')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all
                            ${activeSection === 'profile' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <User size={18} />
                        Personal Profile
                    </button>
                    <button
                        onClick={() => setActiveSection('organization')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all
                            ${activeSection === 'organization' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <Building size={18} />
                        Organization
                    </button>
                    <button
                        onClick={() => setActiveSection('retention')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all
                            ${activeSection === 'retention' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <Trash2 size={18} />
                        Retention Policy
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 glass-card p-8">
                    {activeSection === 'profile' && (
                        <form onSubmit={handleProfileUpdate} className="space-y-6">
                            <h4 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                                <User className="text-indigo-400" />
                                Profile Settings
                            </h4>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">New Password</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Leave blank to keep current"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary flex items-center gap-2 px-6"
                            >
                                <Save size={18} />
                                Update Profile
                            </button>
                        </form>
                    )}

                    {activeSection === 'organization' && (
                        <form onSubmit={handleOrgUpdate} className="space-y-6">
                            <h4 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                                <Building className="text-indigo-400" />
                                Organization Settings
                            </h4>

                            <div className="space-y-4">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Organization Name</label>
                                <input
                                    type="text"
                                    value={orgName}
                                    onChange={(e) => setOrgName(e.target.value)}
                                    disabled={currentUser?.role !== 'admin'}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                />

                                <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                                <Settings size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white leading-tight">Enable Background OCR</p>
                                                <p className="text-[10px] text-slate-400 font-medium">Extract text from images and videos to make them searchable</p>
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
                                            Requires Tesseract OCR installed on the server.{" "}
                                            <a
                                                href="https://tesseract-ocr.github.io/tessdoc/Installation.html"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-400 hover:underline inline-flex items-center gap-1"
                                            >
                                                View Setup Guide
                                            </a>
                                        </p>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-white leading-tight">Automated Screenshots</p>
                                            <p className="text-[10px] text-slate-400 font-medium">How often players should report their screen status</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xl font-black text-indigo-400">
                                                {screenshotInterval === 0 ? 'Disabled' : `${screenshotInterval}m`}
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
                                        <span>Off</span>
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
                                                <p className="text-sm font-bold text-white leading-tight">OIDC Auto-Provisioning</p>
                                                <p className="text-[10px] text-slate-400 font-medium">Automatically create users who sign in via SSO</p>
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
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Authorized Domain</label>
                                            <input
                                                type="text"
                                                value={oidcDomain}
                                                onChange={(e) => setOIDCDomain(e.target.value)}
                                                placeholder="e.g. company.com (without @)"
                                                disabled={currentUser?.role !== 'admin'}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                            />
                                            <p className="text-[10px] text-amber-500/80 font-medium italic">
                                                Users from other domains will still require a manual invite.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {currentUser?.role !== 'admin' && (
                                    <p className="text-[10px] text-amber-500 flex items-center gap-1 mt-1 font-bold italic uppercase">
                                        <Shield size={10} />
                                        Only administrators can change organization settings
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
                                    Save Changes
                                </button>
                            )}
                        </form>
                    )}

                    {activeSection === 'retention' && (
                        <form onSubmit={handleOrgUpdate} className="space-y-6 animate-in fade-in duration-300">
                            <h4 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                                <Trash2 className="text-indigo-400" />
                                Data Retention Policy
                            </h4>

                            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 mb-6">
                                <h5 className="font-bold text-amber-500 text-sm mb-1 flex items-center gap-2">
                                    <Clock size={14} />
                                    Automated Cleanup
                                </h5>
                                <p className="text-xs text-slate-400">
                                    Items older than the specified days will be permanently deleted. Set to 0 to disable auto-deletion.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h5 className="font-bold text-white text-sm border-b border-white/10 pb-2">File Storage</h5>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Trash (Soft Deleted)</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={retentionPolicy.user_upload_retention}
                                                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, user_upload_retention: parseInt(e.target.value) })}
                                                disabled={currentUser?.role !== 'admin'}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                            />
                                            <span className="text-sm text-slate-400 font-bold w-12">days</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">System Screenshots</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={retentionPolicy.system_upload_retention}
                                                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, system_upload_retention: parseInt(e.target.value) })}
                                                disabled={currentUser?.role !== 'admin'}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                            />
                                            <span className="text-sm text-slate-400 font-bold w-12">days</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h5 className="font-bold text-white text-sm border-b border-white/10 pb-2">Logs & History</h5>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Audit Logs</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={retentionPolicy.log_retention.audit}
                                                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, log_retention: { ...retentionPolicy.log_retention, audit: parseInt(e.target.value) } })}
                                                disabled={currentUser?.role !== 'admin'}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                            />
                                            <span className="text-sm text-slate-400 font-bold w-12">days</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Worker Logs</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={retentionPolicy.log_retention.worker}
                                                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, log_retention: { ...retentionPolicy.log_retention, worker: parseInt(e.target.value) } })}
                                                disabled={currentUser?.role !== 'admin'}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                            />
                                            <span className="text-sm text-slate-400 font-bold w-12">days</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">API Logs</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={retentionPolicy.log_retention.api}
                                                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, log_retention: { ...retentionPolicy.log_retention, api: parseInt(e.target.value) } })}
                                                disabled={currentUser?.role !== 'admin'}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                            />
                                            <span className="text-sm text-slate-400 font-bold w-12">days</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Automation (Burp) Logs</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={retentionPolicy.log_retention.burp}
                                                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, log_retention: { ...retentionPolicy.log_retention, burp: parseInt(e.target.value) } })}
                                                disabled={currentUser?.role !== 'admin'}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                            />
                                            <span className="text-sm text-slate-400 font-bold w-12">days</span>
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
                                    Save Policy
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
