'use client';

import { useState, useRef } from 'react';
import { Search, Sparkles, Upload, Download, X, CheckCircle } from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { LeadDetailsSlideout } from './lead-details-slideout';

type Stage = { id: string; name: string; color: string };
type Agent = { id: string; fullName: string };

type ContactCustomField = {
  id: string;
  contactId: string;
  fieldKey: string;
  fieldValue: string;
  fieldType: string;
};

type Contact = {
  id: string;
  whatsappNumber: string;
  fullName: string | null;
  age: number | null;
  domicile: string | null;
  chiefComplaint: string | null;
  initialQuestion: string | null;
  medicalSupportData: string | null;
  stageId: string | null;
  assignedAgentId: string | null;
  lastInteractionAt: Date | null;
  notes: string | null;
  updatedAt: Date;
  stage: Stage | null;
  assignedAgent: Agent | null;
  customFields: ContactCustomField[];
};

interface LeadsTableProps {
  initialContacts: Contact[];
  stages: Stage[];
  agents: Agent[];
  currentSortBy: string;
  currentAgentId: string;
  currentStageId: string;
  currentRange: string;
  currentStartDate: string;
  currentEndDate: string;
}

export function LeadsTableClient({ 
  initialContacts, 
  stages, 
  agents,
  currentSortBy,
  currentAgentId,
  currentStageId,
  currentRange,
  currentStartDate,
  currentEndDate
}: LeadsTableProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Import state
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; errors: {row:number;reason:string}[] } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filter contacts based on search term (client-side)
  const filteredContacts = contacts.filter(c => 
    c.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.whatsappNumber.includes(searchTerm)
  );

  const updateQueryParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all' || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const updateContactInline = async (id: string, field: string, value: string | null) => {
    // Optimistic update
    setContacts(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, [field]: value };
      }
      return c;
    }));

    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        throw new Error('Update failed');
      }
    } catch (error) {
      console.error(error);
      alert('Gagal mengupdate data.');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSavedContact = (updatedContact: any) => {
    setContacts(prev => prev.map(c => c.id === updatedContact.id ? { ...c, ...updatedContact } : c));
  };

  // Import handler
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/contacts/import', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) {
        setImportResult({ inserted: data.inserted, skipped: data.skipped, errors: data.errors || [] });
        if (data.inserted > 0) router.refresh();
      } else {
        alert(`Import gagal: ${data.error}`);
      }
    } catch {
      alert('Terjadi kesalahan saat import.');
    } finally {
      setImportLoading(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  // Export handler
  const handleExport = async () => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentAgentId !== 'all') params.set('agentId', currentAgentId);
      if (currentStageId !== 'all') params.set('stageId', currentStageId);
      const url = `/api/contacts/export?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `husada-leads-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
    } catch {
      alert('Gagal mengeksport data.');
    } finally {
      setExportLoading(false);
    }
  };

  const getRevenue = (contact: Contact) => {
    const revField = contact.customFields?.find(f => f.fieldKey === 'revenue');
    return revField ? parseFloat(revField.fieldValue) || 0 : 0;
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/40 p-4 md:p-6 lg:p-8 space-y-6 overflow-y-auto no-scrollbar">
      {/* Hidden file input for import */}
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImport}
      />

      {/* Import result toast */}
      {importResult && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-4 max-w-sm w-full">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800 text-sm">Import Selesai</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ✅ {importResult.inserted} ditambahkan · ⏭️ {importResult.skipped} dilewati
                    {importResult.errors.length > 0 && ` · ❌ ${importResult.errors.length} error`}
                  </p>
                </div>
              </div>
              <button onClick={() => setImportResult(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200/60 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            Leads Management
            <Sparkles className="w-5 h-5 text-primary" />
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-semibold mt-1">
            Kelola data pasien, status alur flow CRM, dan penugasan agen secara real-time.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative min-w-[220px] w-full md:w-auto">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari nama atau nomor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full input-field outline-none text-sm text-slate-800 focus:outline-none"
            />
          </div>

          {/* Import & Export Buttons */}
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-60"
          >
            <Upload className="w-3.5 h-3.5" />
            {importLoading ? 'Importing...' : 'Import'}
          </button>
          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            {exportLoading ? 'Exporting...' : 'Export'}
          </button>

          {/* Filter Agent */}
          <div className="flex items-center gap-1.5 card-elevated px-4 py-2 text-xs text-slate-700">
            <span className="text-slate-400 font-medium">Agent:</span>
            <select
              value={currentAgentId}
              onChange={(e) => updateQueryParams('agentId', e.target.value)}
              className="bg-transparent outline-none font-bold text-slate-700 cursor-pointer"
            >
              <option value="all" className="bg-card">Semua Agent</option>
              {agents.map(a => (
                <option key={a.id} value={a.id} className="bg-card">{a.fullName}</option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div className="flex items-center gap-1.5 card-elevated px-4 py-2 text-xs text-slate-700">
            <span className="text-slate-400 font-medium">Status:</span>
            <select
              value={currentStageId}
              onChange={(e) => updateQueryParams('stageId', e.target.value)}
              className="bg-transparent outline-none font-bold text-slate-700 cursor-pointer"
            >
              <option value="all" className="bg-card">Semua Status</option>
              {stages.map(s => (
                <option key={s.id} value={s.id} className="bg-card">{s.name}</option>
              ))}
            </select>
          </div>

          {/* Filter Jangka Waktu */}
          <div className="flex items-center gap-1.5 card-elevated px-4 py-2 text-xs text-slate-700">
            <span className="text-slate-400 font-medium">Jangka Waktu:</span>
            <select
              value={currentRange}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== 'custom') {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('startDate');
                  params.delete('endDate');
                  if (val === 'all') {
                    params.delete('range');
                  } else {
                    params.set('range', val);
                  }
                  router.push(`${pathname}?${params.toString()}`);
                } else {
                  updateQueryParams('range', val);
                }
              }}
              className="bg-transparent outline-none font-bold text-slate-700 cursor-pointer"
            >
              <option value="all" className="bg-card">Semua Waktu</option>
              <option value="today" className="bg-card">Hari Ini</option>
              <option value="month" className="bg-card">Bulan Ini</option>
              <option value="year" className="bg-card">Tahun Ini</option>
              <option value="custom" className="bg-card">Rentang Kustom</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 card-elevated px-4 py-2 text-xs text-slate-700">
            <span className="text-slate-400 font-medium">Urutkan:</span>
            <select
              value={currentSortBy}
              onChange={(e) => updateQueryParams('sortBy', e.target.value)}
              className="bg-transparent outline-none font-bold text-slate-700 cursor-pointer"
            >
              <option value="date_desc" className="bg-card">Terbaru</option>
              <option value="name_asc" className="bg-card">Nama (A-Z)</option>
              <option value="name_desc" className="bg-card">Nama (Z-A)</option>
              <option value="revenue_desc" className="bg-card">Revenue Tertinggi</option>
              <option value="revenue_asc" className="bg-card">Revenue Terendah</option>
            </select>
          </div>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {currentRange === 'custom' && (
        <div className="card-elevated p-5 flex flex-col md:flex-row gap-4 items-end animate-in slide-in-from-top-4 duration-200">
          <div className="flex-1 max-w-xs space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tanggal Mulai</label>
            <input 
              type="date"
              value={currentStartDate}
              onChange={(e) => updateQueryParams('startDate', e.target.value)}
              className="w-full input-field px-4 py-2 text-xs text-slate-800 focus:outline-none"
            />
          </div>
          <div className="flex-1 max-w-xs space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tanggal Selesai</label>
            <input 
              type="date"
              value={currentEndDate}
              onChange={(e) => updateQueryParams('endDate', e.target.value)}
              className="w-full input-field px-4 py-2 text-xs text-slate-800 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Desktop Table Area */}
      <div className="hidden md:block card-elevated p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200/60">
                <th className="py-3 font-extrabold text-slate-500 text-xs uppercase tracking-wider">Nama Pasien</th>
                <th className="py-3 font-extrabold text-slate-500 text-xs uppercase tracking-wider">No. WhatsApp</th>
                <th className="py-3 font-extrabold text-slate-500 text-xs uppercase tracking-wider">Revenue</th>
                <th className="py-3 font-extrabold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                <th className="py-3 font-extrabold text-slate-500 text-xs uppercase tracking-wider">FR (Agent)</th>
                <th className="py-3 font-extrabold text-slate-500 text-xs uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {filteredContacts.map(contact => (
                <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors text-sm">
                  <td className="py-3.5">
                    <div className="font-semibold text-slate-800">{contact.fullName || '-'}</div>
                    {contact.age && <div className="text-xs text-slate-400 font-medium mt-0.5">{contact.age} thn</div>}
                  </td>
                  <td className="py-3.5 text-slate-600 font-medium">{contact.whatsappNumber}</td>
                  <td className="py-3.5 font-bold text-emerald-600">
                    {formatIDR(getRevenue(contact))}
                  </td>
                  <td className="py-3.5">
                    <select 
                      value={contact.stageId || ''}
                      onChange={(e) => updateContactInline(contact.id, 'stageId', e.target.value || null)}
                      className="border border-slate-200/80 rounded-xl px-3 py-1.5 bg-card focus:ring-2 focus:ring-primary/40 outline-none text-xs font-semibold text-slate-700 cursor-pointer shadow-sm"
                    >
                      <option value="" className="bg-card">Belum ada status</option>
                      {stages.map(stage => (
                        <option key={stage.id} value={stage.id} className="bg-card">{stage.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5">
                    <select 
                      value={contact.assignedAgentId || ''}
                      onChange={(e) => updateContactInline(contact.id, 'assignedAgentId', e.target.value || null)}
                      className="border border-slate-200/80 rounded-xl px-3 py-1.5 bg-card focus:ring-2 focus:ring-primary/40 outline-none text-xs font-semibold text-slate-700 cursor-pointer shadow-sm"
                    >
                      <option value="" className="bg-card">Belum di-assign</option>
                      {agents.map(agent => (
                        <option key={agent.id} value={agent.id} className="bg-card">{agent.fullName}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5">
                    <button 
                      onClick={() => setSelectedContact(contact)}
                      className="btn-primary px-4 py-1.5 text-xs font-bold shadow-sm cursor-pointer"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
              {filteredContacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                    Tidak ada data pasien yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List View */}
      <div className="block md:hidden space-y-4">
        {filteredContacts.map(contact => (
          <div key={contact.id} className="card-elevated p-5 space-y-4 relative">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-800 text-base">{contact.fullName || '-'}</h3>
                {contact.age && <p className="text-xs text-slate-400 font-medium mt-0.5">{contact.age} tahun</p>}
              </div>
              <span className="font-bold text-emerald-600 text-sm">
                {formatIDR(getRevenue(contact))}
              </span>
            </div>
            
            <div className="text-xs text-slate-600 bg-background/50 p-2.5 rounded-xl border border-slate-100/50">
              <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[9px] block mb-1">WhatsApp</span> 
              <span className="font-semibold text-slate-700">{contact.whatsappNumber}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                <select 
                  value={contact.stageId || ''}
                  onChange={(e) => updateContactInline(contact.id, 'stageId', e.target.value || null)}
                  className="w-full border border-slate-200/80 rounded-xl px-2.5 py-1.5 bg-card text-xs text-slate-700 outline-none font-semibold cursor-pointer"
                >
                  <option value="" className="bg-card">Belum ada status</option>
                  {stages.map(stage => (
                    <option key={stage.id} value={stage.id} className="bg-card">{stage.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">FR (Agent)</label>
                <select 
                  value={contact.assignedAgentId || ''}
                  onChange={(e) => updateContactInline(contact.id, 'assignedAgentId', e.target.value || null)}
                  className="w-full border border-slate-200/80 rounded-xl px-2.5 py-1.5 bg-card text-xs text-slate-700 outline-none font-semibold cursor-pointer"
                >
                  <option value="" className="bg-card">Belum di-assign</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id} className="bg-card">{agent.fullName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100/60">
              <button 
                onClick={() => setSelectedContact(contact)}
                className="btn-primary px-4 py-1.5 text-xs font-bold shadow-sm"
              >
                Detail Pasien
              </button>
            </div>
          </div>
        ))}
        {filteredContacts.length === 0 && (
          <div className="card-elevated py-8 text-center text-slate-400 font-medium text-sm">
            Tidak ada data pasien yang ditemukan.
          </div>
        )}
      </div>

      <LeadDetailsSlideout 
        isOpen={!!selectedContact} 
        onClose={() => setSelectedContact(null)} 
        contact={selectedContact}
        onSaved={handleSavedContact}
      />
    </div>
  );
}
