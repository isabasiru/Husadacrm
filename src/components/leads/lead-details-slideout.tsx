'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';

interface Contact {
  id: string;
  fullName: string | null;
  whatsappNumber: string;
  age: number | null;
  domicile: string | null;
  chiefComplaint: string | null;
  initialQuestion: string | null;
  medicalSupportData: string | null;
  notes: string | null;
  stageId: string | null;
  assignedAgentId: string | null;
}

interface LeadDetailsSlideoutProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
  onSaved: (updatedContact: Contact) => void;
}

export function LeadDetailsSlideout({ isOpen, onClose, contact, onSaved }: LeadDetailsSlideoutProps) {
  const [formData, setFormData] = useState<Partial<Contact>>({});
  const [revenue, setRevenue] = useState('');
  const [clientType, setClientType] = useState('B2C');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (contact) {
      setFormData({
        fullName: contact.fullName || '',
        whatsappNumber: contact.whatsappNumber || '',
        age: contact.age || null,
        domicile: contact.domicile || '',
        chiefComplaint: contact.chiefComplaint || '',
        initialQuestion: contact.initialQuestion || '',
        medicalSupportData: contact.medicalSupportData || '',
        notes: contact.notes || '',
      });

      // Reset custom fields first
      setRevenue('');
      setClientType('B2C');

      // Fetch fresh details with custom fields
      fetch(`/api/contacts/${contact.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.contact) {
            const customFields = data.contact.customFields || [];
            const revField = customFields.find((f: { fieldKey: string; fieldValue: string }) => f.fieldKey === 'revenue');
            const typeField = customFields.find((f: { fieldKey: string; fieldValue: string }) => f.fieldKey === 'client_type');
            setRevenue(revField ? revField.fieldValue : '');
            setClientType(typeField ? typeField.fieldValue : 'B2C');
          }
        })
        .catch(err => console.error('Failed to fetch contact custom fields:', err));
    }
  }, [contact]);

  if (!isOpen || !contact) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        revenue: revenue ? parseFloat(revenue) : 0,
        client_type: clientType,
      };

      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSaved(data.contact);
        onClose();
      } else {
        alert('Gagal menyimpan: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat menyimpan.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/35 z-40 transition-opacity backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-card border-l border-border/80 shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
        <div className="flex items-center justify-between p-4 border-b border-border/60 bg-slate-50/20">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">Detail Pasien</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100/50 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/10">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Nama Pasien <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="fullName"
                value={formData.fullName || ''} 
                onChange={handleChange}
                className="w-full input-field focus:outline-none px-3.5 py-2.5 text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">No WhatsApp <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="whatsappNumber"
                value={formData.whatsappNumber || ''} 
                onChange={handleChange}
                className="w-full input-field focus:outline-none px-3.5 py-2.5 text-sm text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Usia</label>
              <input 
                type="number" 
                name="age"
                value={formData.age || ''} 
                onChange={handleChange}
                className="w-full input-field focus:outline-none px-3.5 py-2.5 text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Domisili</label>
              <input 
                type="text" 
                name="domicile"
                value={formData.domicile || ''} 
                onChange={handleChange}
                className="w-full input-field focus:outline-none px-3.5 py-2.5 text-sm text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Estimasi Pendapatan (Revenue)</label>
              <input 
                type="number" 
                value={revenue} 
                onChange={(e) => setRevenue(e.target.value)}
                placeholder="Misal: 15000000"
                className="w-full input-field focus:outline-none px-3.5 py-2.5 text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Tipe Transaksi (B2C / B2B)</label>
              <select 
                value={clientType} 
                onChange={(e) => setClientType(e.target.value)}
                className="w-full border border-slate-200/80 rounded-xl px-3 py-2.5 bg-card focus:ring-2 focus:ring-primary/40 outline-none text-sm font-semibold text-slate-700 cursor-pointer shadow-sm"
              >
                <option value="B2C" className="bg-card">B2C</option>
                <option value="B2B" className="bg-card">B2B</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Keluhan</label>
            <textarea 
              name="chiefComplaint"
              value={formData.chiefComplaint || ''} 
              onChange={handleChange}
              rows={3}
              className="w-full input-field focus:outline-none px-3.5 py-2.5 text-sm text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Pertanyaan</label>
            <textarea 
              name="initialQuestion"
              value={formData.initialQuestion || ''} 
              onChange={handleChange}
              rows={3}
              className="w-full input-field focus:outline-none px-3.5 py-2.5 text-sm text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Data Penunjang (Link/Catatan)</label>
            <textarea 
              name="medicalSupportData"
              value={formData.medicalSupportData || ''} 
              onChange={handleChange}
              rows={2}
              className="w-full input-field focus:outline-none px-3.5 py-2.5 text-sm text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Catatan Internal</label>
            <textarea 
              name="notes"
              value={formData.notes || ''} 
              onChange={handleChange}
              rows={3}
              className="w-full input-field focus:outline-none px-3.5 py-2.5 text-sm text-slate-800"
            />
          </div>
        </div>

        <div className="p-4 border-t border-border/60 flex justify-end space-x-3 bg-slate-50/20">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100/50 rounded-xl transition-all cursor-pointer"
            disabled={isSaving}
          >
            Batal
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary px-5 py-2 text-sm font-bold shadow-sm flex items-center cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Simpan
          </button>
        </div>
      </div>
    </>
  );
}
