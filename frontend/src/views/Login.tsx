import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Mail, Lock, LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Login: React.FC = () => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();

    useEffect(() => {
        // Check for injected token from POST login
        const injectedToken = (window as any).INITIAL_TOKEN;
        if (injectedToken) {
            handleTokenLogin(injectedToken);
            // Clean up
            delete (window as any).INITIAL_TOKEN;
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) {
            handleTokenLogin(token);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [login, t]);

    const handleTokenLogin = (token: string) => {
        try {
            const user = parseJwt(token);
            if (user) {
                const mappedUser = {
                    id: user.user_id,
                    email: user.email,
                    role: user.role,
                    organization_id: user.organization_id
                };
                login(token, mappedUser);
            }
        } catch (e) {
            console.error("Failed to decode token", e);
            setError(t('login.error_generic'));
        }
    }

    const parseJwt = (token: string) => {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const res = await axios.post('/login', { email, password });
            login(res.data.token, res.data.user);
        } catch (err: any) {
            setError(err.response?.data?.error || t('login.error_generic'));
        }
    };

    const handleOIDC = (provider: string) => {
        window.location.href = `http://localhost:8080/auth/${provider}`;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)] p-4 font-sans transition-colors duration-300">
            <div className="max-w-md w-full glass-card p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6 font-black text-2xl text-white shadow-2xl shadow-indigo-500/40 transform -rotate-6 hover:rotate-0 transition-transform duration-500">M</div>
                    <h2 className="text-4xl font-black text-[var(--text-main)] tracking-tight">{t('login.welcome')}</h2>
                    <p className="text-slate-400 mt-2 font-medium">{t('login.subtitle')}</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-2xl mb-6 text-sm font-bold flex items-center gap-2 animate-shake">
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">{t('login.email_label')}</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-indigo-400" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-[var(--input-bg)] border border-[var(--glass-border)] rounded-2xl py-4 pl-12 pr-4 text-[var(--text-main)] placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                                placeholder={t('login.email_placeholder')}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">{t('login.password_label')}</label>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-indigo-400" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-[var(--input-bg)] border border-[var(--glass-border)] rounded-2xl py-4 pl-12 pr-4 text-[var(--text-main)] placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                                placeholder={t('login.password_placeholder')}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-600 py-4 rounded-2xl flex items-center justify-center gap-2 text-white font-black text-lg transition-all shadow-[0_20px_40px_-15px_rgba(99,102,241,0.5)] active:scale-95">
                        <LogIn size={20} />
                        {t('login.sign_in_button')}
                    </button>
                </form>

                <div className="relative my-10">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[var(--border-subtle)]"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.2em]">
                        <span className="bg-[var(--bg-card)] px-4 text-slate-500">{t('login.continue_with')}</span>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <button
                        onClick={() => handleOIDC('openid-connect')}
                        className="flex items-center justify-center gap-2 py-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--sidebar-hover)] hover:bg-[var(--glass-border)] transition-all text-[var(--text-main)] font-bold text-sm"
                    >
                        SSO
                    </button>
                </div>
            </div>

            <div className="fixed bottom-8 flex items-center gap-3 opacity-30 text-[10px] font-black uppercase tracking-[0.3em] text-white">
                <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
                {t('common.powered_by')}
                <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
            </div>
        </div>
    );
};

export default Login;
