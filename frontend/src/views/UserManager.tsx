import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, UserPlus, Shield, User as UserIcon, Trash2, Edit2, Mail, Key } from 'lucide-react';

interface User {
    id: number;
    email: string;
    role: string;
    created_at: string;
}

const UserManager: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('viewer');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/users');
            setUsers(res.data);
        } catch (err) {
            console.error("Failed to fetch users", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('email', email);
        formData.append('role', role);
        if (password) formData.append('password', password);

        try {
            if (editingUser) {
                await axios.put(`/api/users/${editingUser.id}`, formData);
            } else {
                await axios.post('/api/users', formData);
            }
            setIsModalOpen(false);
            resetForm();
            fetchUsers();
        } catch (err) {
            alert("Failed to save user");
        }
    };

    const deleteUser = async (id: number) => {
        if (!confirm("Are you sure you want to remove this user?")) return;
        try {
            await axios.delete(`/api/users/${id}`);
            fetchUsers();
        } catch (err) {
            alert("Failed to delete user");
        }
    };

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setRole('viewer');
        setEditingUser(null);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setEmail(user.email);
        setRole(user.role);
        setIsModalOpen(true);
    };

    if (loading && users.length === 0) return <div className="text-slate-400">Loading users...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-white mb-1">User Management</h3>
                    <p className="text-slate-400 text-sm">Manage team members and access permissions</p>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="btn-primary flex items-center gap-2"
                >
                    <UserPlus size={18} />
                    Add User
                </button>
            </div>

            <div className="glass-card overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Joined</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {users.map((u) => (
                            <tr key={u.id} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                                            <UserIcon size={20} />
                                        </div>
                                        <div>
                                            <div className="text-white font-bold">{u.email}</div>
                                            <div className="text-[10px] text-slate-500 font-medium">Internal User</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider
                                        ${u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                                            u.role === 'manager' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                'bg-slate-500/20 text-slate-400 border border-slate-500/30'}`}>
                                        <Shield size={12} />
                                        {u.role}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-400 text-sm font-medium">
                                    {new Date(u.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right overflow-hidden">
                                    <div className="flex items-center justify-end gap-2 translate-x-12 group-hover:translate-x-0 transition-transform">
                                        <button
                                            onClick={() => openEditModal(u)}
                                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => deleteUser(u.id)}
                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="glass-card w-full max-w-md p-8 animate-in zoom-in duration-200">
                        <h4 className="text-2xl font-bold text-white mb-6">
                            {editingUser ? 'Edit User' : 'Add New User'}
                        </h4>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
                                        placeholder="user@example.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                                    {editingUser ? 'New Password (Leave blank to keep current)' : 'Password'}
                                </label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="password"
                                        required={!editingUser}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">System Role</label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="viewer">Viewer (Read Only)</option>
                                    <option value="manager">Manager (Manage Content)</option>
                                    <option value="admin">Administrator (Full Access)</option>
                                </select>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 text-sm font-bold text-slate-400 hover:bg-white/5 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 btn-primary"
                                >
                                    {editingUser ? 'Save Changes' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManager;
