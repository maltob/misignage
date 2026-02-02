import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, UserPlus, Shield, User as UserIcon, Trash2, Edit2, Mail, Key } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface User {
    id: number;
    email: string;
    role: string;
    created_at: string;
}

const UserManager: React.FC = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any | null>(null);

    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('viewer');
    const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
    const [isOidc, setIsOidc] = useState(false);

    useEffect(() => {
        fetchUsers();
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const res = await axios.get('/api/groups');
            setGroups(res.data);
        } catch (err) {
            console.error("Failed to fetch groups", err);
        }
    };

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
        if (isOidc) formData.append('is_oidc', 'true');
        if (password) formData.append('password', password);

        if (selectedGroups.length > 0) {
            selectedGroups.forEach(id => formData.append('group_ids[]', id.toString()));
        } else if (editingUser) {
            formData.append('group_ids_cleared', 'true');
        }

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
            alert(t('users.save_failed'));
        }
    };

    const deleteUser = async (id: number) => {
        if (!confirm(t('users.confirm_delete'))) return;
        try {
            await axios.delete(`/api/users/${id}`);
            fetchUsers();
        } catch (err) {
            alert(t('users.delete_failed'));
        }
    };

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setRole('viewer');
        setSelectedGroups([]);
        setEditingUser(null);
        setIsOidc(false);
    };

    const openEditModal = (user: any) => {
        setEditingUser(user);
        setEmail(user.email);
        setRole(user.role);
        setSelectedGroups(user.groups?.map((g: any) => g.id) || []);
        setIsOidc(!user.password_hash); // If no hash, it's likely OIDC
        setIsModalOpen(true);
    };

    if (loading && users.length === 0) return <div className="text-[var(--text-muted)]">{t('users.loading')}</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-[var(--text-main)] mb-1">{t('users.title')}</h3>
                    <p className="text-[var(--text-muted)] text-sm">{t('users.subtitle')}</p>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="btn-primary flex items-center gap-2"
                >
                    <UserPlus size={18} />
                    {t('users.add_user')}
                </button>
            </div>

            <div className="glass-card overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[var(--sidebar-hover)] text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                            <th className="px-6 py-4">{t('users.table.user')}</th>
                            <th className="px-6 py-4">{t('users.table.role')}</th>
                            <th className="px-6 py-4">{t('users.table.joined')}</th>
                            <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                        {users.map((u) => (
                            <tr key={u.id} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                                            <UserIcon size={20} />
                                        </div>
                                        <div>
                                            <div className="text-[var(--text-main)] font-bold">{u.email}</div>
                                            <div className="text-[10px] text-[var(--text-muted)] font-medium">{t('users.internal_user')}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider
                                        ${u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                                            u.role === 'manager' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                'bg-[var(--sidebar-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]'}`}>
                                        <Shield size={12} />
                                        {u.role}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-[var(--text-muted)] text-sm font-medium">
                                    {new Date(u.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right overflow-hidden">
                                    <div className="flex items-center justify-end gap-2 translate-x-12 group-hover:translate-x-0 transition-transform">
                                        <button
                                            onClick={() => openEditModal(u)}
                                            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--sidebar-hover)] rounded-lg transition-all">
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => deleteUser(u.id)}
                                            className="p-2 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="modal-card w-full max-w-md p-8 animate-in zoom-in duration-200" style={{ backgroundColor: 'var(--bg-modal)' }}>
                        <h4 className="text-2xl font-bold text-[var(--text-main)] mb-6">
                            {editingUser ? t('users.edit_user') : t('users.add_new_user')}
                        </h4>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">{t('users.email_address')}</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full input-field !pl-12 border-2 border-[var(--border-subtle)]"
                                        placeholder="user@example.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center gap-3 p-4 rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--sidebar-hover)] cursor-pointer hover:border-indigo-500/50 transition-all">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded-lg accent-indigo-500"
                                        checked={isOidc}
                                        onChange={(e) => setIsOidc(e.target.checked)}
                                    />
                                    <div>
                                        <div className="text-xs font-black uppercase tracking-widest text-[var(--text-main)]">OIDC / External Account</div>
                                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Allow login via Google/Microsoft only</div>
                                    </div>
                                </label>

                                {!isOidc && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                        <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                            {editingUser ? t('users.new_password_hint') : t('users.password')}
                                        </label>
                                        <div className="relative">
                                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                            <input
                                                type="password"
                                                required={!editingUser}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full input-field !pl-12 border-2 border-[var(--border-subtle)]"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">{t('users.system_role')}</label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full input-field appearance-none cursor-pointer border-2 border-[var(--border-subtle)]"
                                >
                                    <option value="viewer" className="bg-[var(--bg-card)] text-[var(--text-main)]">{t('users.roles.viewer')}</option>
                                    <option value="manager" className="bg-[var(--bg-card)] text-[var(--text-main)]">{t('users.roles.manager')}</option>
                                    <option value="admin" className="bg-[var(--bg-card)] text-[var(--text-main)]">{t('users.roles.admin')}</option>
                                </select>
                            </div>

                            {role !== 'admin' && (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">{t('users.assigned_groups')}</label>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                        {groups.map(g => (
                                            <label key={g.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${selectedGroups.includes(g.id) ? 'bg-indigo-500/10 border-indigo-500/30 text-[var(--text-main)]' : 'bg-[var(--sidebar-hover)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-indigo-500/30'}`}>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={selectedGroups.includes(g.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedGroups([...selectedGroups, g.id]);
                                                        else setSelectedGroups(selectedGroups.filter(id => id !== g.id));
                                                    }}
                                                />
                                                <Users size={14} className={selectedGroups.includes(g.id) ? 'text-indigo-400' : 'text-slate-500'} />
                                                <span className="text-[10px] font-bold uppercase tracking-wider truncate">{g.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {groups.length === 0 && (
                                        <p className="text-[10px] text-[var(--text-muted)] italic">{t('users.no_groups')}</p>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--sidebar-hover)] rounded-xl transition-all border border-[var(--border-subtle)]"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 btn-primary"
                                >
                                    {editingUser ? t('users.save_changes') : t('users.create_account')}
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
