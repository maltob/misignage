import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Mail, Lock, LogIn, Github } from 'lucide-react';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) {
            // OIDC callback handling
            // In a real app, you'd fetch the user profile with the token
            // For now, let's assume login() is called with the token
            // logic to handle user data from OIDC would go here
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const res = await axios.post('/login', { email, password });
            login(res.data.token, res.data.user);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed');
        }
    };

    const handleOIDC = (provider: string) => {
        window.location.href = `http://localhost:8080/auth/${provider}`;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4">
            <div className="max-w-md w-full glass-card p-8 shadow-2xl">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center mx-auto mb-4 font-bold text-xl shadow-lg shadow-indigo-500/20">M</div>
                    <h2 className="text-3xl font-bold text-white">Welcome Back</h2>
                    <p className="text-slate-400 mt-2">Sign in to manage your signage network</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-2">
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
                                placeholder="name@company.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="w-full btn-primary py-3 flex items-center justify-center gap-2 text-base font-bold">
                        <LogIn size={20} />
                        Sign In
                    </button>
                </form>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-[#1e293b] px-2 text-slate-500">Or continue with</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => handleOIDC('google')}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-all text-slate-300 font-medium"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                        Google
                    </button>
                    <button
                        onClick={() => handleOIDC('microsoftonline')}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-all text-slate-300 font-medium"
                    >
                        <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                            <div className="bg-[#f25022]"></div>
                            <div className="bg-[#7fba00]"></div>
                            <div className="bg-[#00a4ef]"></div>
                            <div className="bg-[#ffb900]"></div>
                        </div>
                        Microsoft
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
