"use client";

import { useState, useEffect } from "react";
import { MessageTemplate } from "@prisma/client";
import { 
  Edit2, 
  Trash2, 
  Plus, 
  Zap, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Users, 
  Shield, 
  Mail, 
  UserCheck, 
  UserX,
  Lock,
  MessageSquare,
  Package,
  Phone
} from "lucide-react";
import { ProductsPanel } from "@/components/settings/products-panel";

interface UserType {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  whatsappNumber?: string | null;
  createdAt: Date;
}

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  sortOrder: number;
};

interface SettingsClientProps {
  initialTemplates: MessageTemplate[];
  initialUsers: UserType[];
  initialProducts: Product[];
}

export function SettingsClient({ initialTemplates, initialUsers, initialProducts }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<'templates' | 'users' | 'automation' | 'products'>('templates');
  const [templates, setTemplates] = useState<MessageTemplate[]>(initialTemplates);
  const [users, setUsers] = useState<UserType[]>(initialUsers);
  
  // Automation Settings State
  const [autoFollowupEnabled, setAutoFollowupEnabled] = useState(false);
  const [autoFollowupHours, setAutoFollowupHours] = useState(24);
  const [autoFollowupTemplate, setAutoFollowupTemplate] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Messages templates category filter
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Template Modal & Form State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("GREETING");
  const [templateContent, setTemplateContent] = useState("");
  
  // User Modal & Form State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("AGENT");
  const [userPassword, setUserPassword] = useState("");
  const [userIsActive, setUserIsActive] = useState(true);
  const [userWhatsapp, setUserWhatsapp] = useState("");

  // Status Alerts
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch automation settings on mount
  useEffect(() => {
    async function loadSettings() {
      setLoadingSettings(true);
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.settings) {
            setAutoFollowupEnabled(data.settings.auto_followup_enabled === "true");
            setAutoFollowupHours(parseInt(data.settings.auto_followup_hours) || 24);
            setAutoFollowupTemplate(data.settings.auto_followup_template || "");
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoadingSettings(false);
      }
    }
    loadSettings();
  }, []);

  // Filter templates
  const filteredTemplates = activeCategory
    ? templates.filter(t => t.category === activeCategory)
    : templates;

  const categories = ["GREETING", "FOLLOW_UP", "CLOSING"];

  // ==========================================
  // MESSAGE TEMPLATES HANDLERS
  // ==========================================
  const handleOpenAddTemplate = () => {
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateCategory("GREETING");
    setTemplateContent("");
    setError(null);
    setIsTemplateModalOpen(true);
  };

  const handleOpenEditTemplate = (tpl: MessageTemplate) => {
    setEditingTemplateId(tpl.id);
    setTemplateName(tpl.name);
    setTemplateCategory(tpl.category);
    setTemplateContent(tpl.content);
    setError(null);
    setIsTemplateModalOpen(true);
  };

  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !templateContent.trim()) {
      setError("Nama templat dan isi pesan wajib diisi!");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = editingTemplateId ? `/api/templates/${editingTemplateId}` : "/api/templates";
      const method = editingTemplateId ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName, category: templateCategory, content: templateContent })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menyimpan templat");
      }

      const savedTpl = await res.json();

      if (editingTemplateId) {
        setTemplates(prev => prev.map(t => t.id === editingTemplateId ? savedTpl : t));
        setSuccess("Templat berhasil diperbarui!");
      } else {
        setTemplates(prev => [savedTpl, ...prev]);
        setSuccess("Templat baru berhasil ditambahkan!");
      }

      setIsTemplateModalOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Terjadi kesalahan koneksi server";
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTemplateDelete = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus templat "${name}"?`)) return;

    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Gagal menghapus templat");
      }

      setTemplates(prev => prev.filter(t => t.id !== id));
      setSuccess("Templat berhasil dihapus!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Gagal menghapus templat";
      alert(errorMsg);
    }
  };

  // ==========================================
  // USER SETUP / MANAGEMENT HANDLERS
  // ==========================================
  const handleOpenAddUser = () => {
    setEditingUserId(null);
    setUserFullName("");
    setUserEmail("");
    setUserRole("AGENT");
    setUserPassword("");
    setUserIsActive(true);
    setUserWhatsapp("");
    setError(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (usr: UserType) => {
    setEditingUserId(usr.id);
    setUserFullName(usr.fullName);
    setUserEmail(usr.email);
    setUserRole(usr.role);
    setUserPassword("");
    setUserIsActive(usr.isActive);
    setUserWhatsapp(usr.whatsappNumber || "");
    setError(null);
    setIsUserModalOpen(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFullName.trim() || !userEmail.trim() || !userRole) {
      setError("Nama Lengkap, Email, dan Role wajib diisi!");
      return;
    }
    if (!editingUserId && !userPassword) {
      setError("Kata sandi (password) wajib diisi untuk pengguna baru!");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = editingUserId ? `/api/users/${editingUserId}` : "/api/users";
      const method = editingUserId ? "PATCH" : "POST";
      
      const payload: {
        fullName: string;
        email: string;
        role: string;
        isActive: boolean;
        password?: string;
        whatsappNumber?: string;
      } = {
        fullName: userFullName,
        email: userEmail,
        role: userRole,
        isActive: userIsActive,
        whatsappNumber: userWhatsapp.trim() || undefined,
      };

      if (userPassword) {
        payload.password = userPassword;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan data pengguna");
      }

      if (editingUserId) {
        setUsers(prev => prev.map(u => u.id === editingUserId ? { ...u, ...data } : u));
        setSuccess("Pengguna berhasil diperbarui!");
      } else {
        setUsers(prev => [...prev, data].sort((a, b) => a.fullName.localeCompare(b.fullName)));
        setSuccess("Pengguna baru berhasil ditambahkan!");
      }

      setIsUserModalOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Terjadi kesalahan koneksi server";
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleUserStatus = async (usr: UserType) => {
    const action = usr.isActive ? "menonaktifkan" : "mengaktifkan";
    if (!confirm(`Apakah Anda yakin ingin ${action} pengguna "${usr.fullName}"?`)) return;

    try {
      const res = await fetch(`/api/users/${usr.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !usr.isActive })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengubah status pengguna");
      }

      setUsers(prev => prev.map(u => u.id === usr.id ? { ...u, isActive: data.isActive } : u));
      setSuccess(`Pengguna berhasil di-${usr.isActive ? "nonaktifkan" : "aktifkan"}!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Gagal mengubah status pengguna";
      alert(errorMsg);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auto_followup_enabled: autoFollowupEnabled ? "true" : "false",
          auto_followup_hours: String(autoFollowupHours),
          auto_followup_template: autoFollowupTemplate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan pengaturan");
      }

      setSuccess("Pengaturan otomasi berhasil disimpan!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan pengaturan";
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 md:p-8">
      {/* Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 md:w-6 md:h-6 text-[#1A56DB] fill-[#1A56DB]" />
            Pengaturan Sistem CRM
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Konfigurasi template respon cepat WhatsApp dan kelola akun otorisasi agen Husada.
          </p>
        </div>

        {activeTab === 'templates' && (
          <button
            onClick={handleOpenAddTemplate}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1A56DB] hover:bg-[#1A56DB]/90 text-white rounded-xl font-bold text-xs md:text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Tambah Templat
          </button>
        )}
        {activeTab === 'users' && (
          <button
            onClick={handleOpenAddUser}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#0d9488] hover:bg-[#0d9488]/90 text-white rounded-xl font-bold text-xs md:text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Tambah User
          </button>
        )}
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-slate-200 mb-6 text-sm overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 px-4 font-bold border-b-2 transition-all flex items-center gap-2 text-xs md:text-sm ${
            activeTab === 'templates'
              ? "border-[#1A56DB] text-[#1A56DB]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Templat Respon Cepat ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-4 font-bold border-b-2 transition-all flex items-center gap-2 text-xs md:text-sm ${
            activeTab === 'users'
              ? "border-[#0d9488] text-[#0d9488]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Users className="w-4 h-4" />
          Manajemen Pengguna ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`pb-3 px-4 font-bold border-b-2 transition-all flex items-center gap-2 text-xs md:text-sm ${
            activeTab === 'products'
              ? "border-[#7c3aed] text-[#7c3aed]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Package className="w-4 h-4" />
          Produk & Layanan ({initialProducts.length})
        </button>
        <button
          onClick={() => setActiveTab('automation')}
          className={`pb-3 px-4 font-bold border-b-2 transition-all flex items-center gap-2 text-xs md:text-sm ${
            activeTab === 'automation'
              ? "border-[#ea580c] text-[#ea580c]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Zap className="w-4 h-4" />
          Otomasi & Follow Up
        </button>
      </div>

      {/* Success Alert */}
      {success && (
        <div className="mb-6 p-3 md:p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <Check className="w-4 h-4 md:w-5 md:h-5 text-emerald-600 shrink-0" />
          <span className="text-xs md:text-sm font-semibold">{success}</span>
        </div>
      )}

      {/* ==========================================
          TAB 1: MESSAGE TEMPLATES
          ========================================== */}
      {activeTab === 'templates' && (
        <>
          {/* Subtabs Filter */}
          <div className="flex border-b border-slate-200 mb-6 text-[10px] md:text-xs overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => setActiveCategory(null)}
              className={`pb-2 px-3 font-bold border-b-2 transition-all ${
                !activeCategory ? "border-[#1A56DB] text-[#1A56DB]" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Semua ({templates.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`pb-2 px-3 font-bold border-b-2 transition-all uppercase ${
                  activeCategory === cat ? "border-[#1A56DB] text-[#1A56DB]" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {cat.replace("_", " ")} ({templates.filter(t => t.category === cat).length})
              </button>
            ))}
          </div>

          {/* Grid Templates */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredTemplates.length === 0 ? (
              <div className="col-span-full bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-400 text-xs md:text-sm">
                Belum ada templat respon cepat terdaftar.
              </div>
            ) : (
              filteredTemplates.map(tpl => (
                <div
                  key={tpl.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all hover:border-slate-300 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <h3 className="font-bold text-slate-800 text-xs md:text-sm truncate max-w-[70%]" title={tpl.name}>
                        {tpl.name}
                      </h3>
                      <span className="text-[9px] md:text-[10px] uppercase px-1.5 py-0.5 rounded font-extrabold bg-slate-100 text-slate-600 border border-slate-200/60 shrink-0">
                        {tpl.category.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-[11px] md:text-xs text-slate-500 leading-relaxed whitespace-pre-wrap break-words line-clamp-4 min-h-[4.5rem] mb-4">
                      {tpl.content}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {(tpl.variables as { variables?: string[] })?.variables?.map((v: string) => (
                        <span key={v} className="text-[8px] md:text-[9px] bg-blue-50 text-[#1A56DB] px-1.5 py-0.5 rounded font-bold">
                          {"{" + v + "}"}
                        </span>
                      )) || (
                        <span className="text-[9px] text-slate-400 italic">No variables</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handleOpenEditTemplate(tpl)}
                        className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-500 hover:text-[#1A56DB] transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleTemplateDelete(tpl.id, tpl.name)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ==========================================
          TAB 2: USER SETUP / MANAGEMENT
          ========================================== */}
      {activeTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-bold text-xs uppercase">
                  <th className="px-6 py-4">Nama Lengkap</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">No WA Notif</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                {users.map(usr => (
                  <tr key={usr.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-800">{usr.fullName}</td>
                    <td className="px-6 py-4 text-slate-500">{usr.email}</td>
                    <td className="px-6 py-4">
                      {usr.whatsappNumber ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-700">
                          <Phone className="w-3 h-3" />{usr.whatsappNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Belum diset</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        usr.role === 'SUPER_ADMIN' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                        usr.role === 'ADMIN' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        'bg-teal-50 text-teal-700 border border-teal-100'
                      }`}>
                        <Shield className="w-3 h-3" />
                        {usr.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${
                        usr.isActive 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {usr.isActive ? 'Aktif' : 'Non-aktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditUser(usr)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleUserStatus(usr)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          usr.isActive 
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-600' 
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                        }`}
                      >
                        {usr.isActive ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                        {usr.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card-Based List View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {users.map(usr => (
              <div key={usr.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{usr.fullName}</h4>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {usr.email}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    usr.isActive 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                      : 'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}>
                    {usr.isActive ? 'Aktif' : 'Non-aktif'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    usr.role === 'SUPER_ADMIN' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                    usr.role === 'ADMIN' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                    'bg-teal-50 text-teal-700 border border-teal-100'
                  }`}>
                    <Shield className="w-2.5 h-2.5" />
                    {usr.role}
                  </span>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEditUser(usr)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleUserStatus(usr)}
                      className={`p-2 rounded-lg text-xs font-bold flex items-center justify-center ${
                        usr.isActive 
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-600' 
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                      }`}
                    >
                      {usr.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 3: PRODUCTS & SERVICES
          ========================================== */}
      {activeTab === 'products' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <ProductsPanel initialProducts={initialProducts} />
        </div>
      )}

      {/* ==========================================
          TAB 4: AUTOMATION & FOLLOW UP
          ========================================== */}
      {activeTab === 'automation' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 max-w-2xl">
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b pb-3 mb-4">
              <Zap className="w-5 h-5 text-[#ea580c]" />
              Otomasi Re-Follow Up Chat Terbuka
            </h2>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Toggle Enabled */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="autoFollowupCheckbox"
                checked={autoFollowupEnabled}
                onChange={(e) => setAutoFollowupEnabled(e.target.checked)}
                className="rounded text-[#ea580c] focus:ring-[#ea580c] w-5 h-5 mt-0.5 cursor-pointer accent-[#ea580c]"
              />
              <div className="space-y-0.5">
                <label htmlFor="autoFollowupCheckbox" className="text-sm font-bold text-slate-800 cursor-pointer">
                  Aktifkan Re-Follow Up Otomatis
                </label>
                <p className="text-xs text-slate-500">
                  Secara otomatis mengirimkan pesan WhatsApp follow up jika pasien tidak membalas chat kita dalam batas waktu tertentu.
                </p>
              </div>
            </div>

            {/* Hours Threshold */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Batas Waktu Tunggu / Dianggurin (Jam)
              </label>
              <input
                type="number"
                min="1"
                max="168"
                value={autoFollowupHours}
                onChange={(e) => setAutoFollowupHours(Math.max(1, parseInt(e.target.value) || 24))}
                className="w-40 px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#ea580c] text-xs text-slate-700 bg-white"
                required
                disabled={!autoFollowupEnabled}
              />
              <p className="text-[10px] text-slate-400">Default: 24 jam (1 hari). Nilai maksimal: 168 jam (7 hari).</p>
            </div>

            {/* Template Message */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Pesan Custom Follow Up
              </label>
              <textarea
                placeholder="Halo {{nama}}, ada yang bisa kami bantu lagi?"
                value={autoFollowupTemplate}
                onChange={(e) => setAutoFollowupTemplate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#ea580c] text-xs text-slate-700 min-h-[6rem] resize-y bg-white font-sans"
                required
                disabled={!autoFollowupEnabled}
              />
              
              <div className="p-3 bg-orange-50/50 border border-orange-100 rounded-xl space-y-1 text-[10px] text-orange-950">
                <div className="font-bold flex items-center gap-1">
                  <span>💡 Dukungan Variabel Dinamis</span>
                </div>
                <p className="text-slate-600 leading-normal">
                  Sistem akan mengganti variabel ini secara otomatis sebelum mengirimkan pesan WhatsApp:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-orange-900 font-semibold">
                  <li><code className="bg-orange-100/70 px-1 py-0.5 rounded text-[9px]">{"{{nama}}"}</code> : Diganti nama lengkap/whatsapp number kontak.</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4 mt-6">
              <button
                type="submit"
                disabled={isSubmitting || loadingSettings}
                className="px-5 py-2.5 bg-[#ea580c] hover:bg-[#ea580c]/90 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================
          MODAL: CREATE/EDIT MESSAGE TEMPLATE
          ========================================== */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#1A56DB]" />
                {editingTemplateId ? "Ubah Templat Pesan" : "Buat Templat Pesan Baru"}
              </h2>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTemplateSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nama Templat</label>
                <input
                  type="text"
                  placeholder="Misal: Sapaan Screening Awal"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1A56DB] text-xs text-slate-700 bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Kategori</label>
                <select
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1A56DB] text-xs text-slate-700 bg-white"
                >
                  <option value="GREETING">Greeting / Sapaan</option>
                  <option value="FOLLOW_UP">Follow Up / Peninjauan</option>
                  <option value="CLOSING">Closing / Penutup</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Konten / Isi Pesan</label>
                <textarea
                  placeholder="Ketik isi templat pesan disini..."
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1A56DB] text-xs text-slate-700 min-h-[8rem] resize-y bg-white"
                  required
                />
                
                <div className="mt-2 p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-1 text-[10px] text-blue-800">
                  <div className="font-bold flex items-center gap-1">
                    <span>💡 Variabel Dinamis Otomatis</span>
                  </div>
                  <p className="text-slate-500 leading-normal">
                    Anda dapat menggunakan *placeholder* variabel berikut. Sistem akan menggantinya secara otomatis saat agen memilih templat ini:
                  </p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-blue-900 font-semibold">
                    <li><code className="bg-blue-100/80 px-1 py-0.5 rounded text-[9px]">{"{{nama}}"}</code> : Diganti nama depan pasien.</li>
                    <li><code className="bg-blue-100/80 px-1 py-0.5 rounded text-[9px]">{"{{agent_name}}"}</code> : Diganti nama lengkap agen saat ini.</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#1A56DB] hover:bg-[#1A56DB]/90 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Templat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: CREATE/EDIT USER SETUP
          ========================================== */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b flex items-center justify-between">
              <h2 className="font-bold text-[#0d9488] text-sm tracking-tight flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#0d9488]" />
                {editingUserId ? "Ubah Akun Pengguna / Agen" : "Daftarkan Pengguna / Agen Baru"}
              </h2>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Misal: dr. Candy"
                  value={userFullName}
                  onChange={(e) => setUserFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#0d9488] text-xs text-slate-700 bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Alamat Email</label>
                <input
                  type="email"
                  placeholder="email@husada.webhaus.id"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#0d9488] text-xs text-slate-700 bg-white"
                  required
                  disabled={!!editingUserId}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Role / Hak Akses</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#0d9488] text-xs text-slate-700 bg-white"
                >
                  <option value="AGENT">AGENT (Akses Inbox & Leads)</option>
                  <option value="ADMIN">ADMIN (Akses Penuh Tanpa Hapus Super)</option>
                  <option value="SUPER_ADMIN">SUPER ADMIN (Otoritas Tertinggi)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-600" />
                  No WhatsApp (untuk notif assign)
                </label>
                <input
                  type="tel"
                  placeholder="Contoh: 08123456789"
                  value={userWhatsapp}
                  onChange={(e) => setUserWhatsapp(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#0d9488] text-xs text-slate-700 bg-white"
                />
                <p className="text-[10px] text-slate-400">Notifikasi WhatsApp akan dikirim ke nomor ini saat ada penugasan leads baru.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Kata Sandi (Password)</span>
                  {editingUserId && <span className="text-[10px] text-amber-600 font-normal">Isi hanya jika ingin mengganti</span>}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder={editingUserId ? "••••••••" : "Masukkan password aman..."}
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#0d9488] text-xs text-slate-700 bg-white"
                    required={!editingUserId}
                  />
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {editingUserId && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActiveCheckbox"
                    checked={userIsActive}
                    onChange={(e) => setUserIsActive(e.target.checked)}
                    className="rounded text-[#0d9488] focus:ring-[#0d9488] w-4 h-4"
                  />
                  <label htmlFor="isActiveCheckbox" className="text-xs font-bold text-slate-700">
                    Akun ini aktif (Dapat masuk ke CRM)
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#0d9488] hover:bg-[#0d9488]/90 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Akun"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
