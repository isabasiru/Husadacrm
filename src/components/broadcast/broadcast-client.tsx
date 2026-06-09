'use client';

import { useState } from 'react';
import { Send, Users, AlertCircle, Loader2 } from 'lucide-react';

type Stage = { id: string; name: string };
type Agent = { id: string; fullName: string };

interface BroadcastClientProps {
  stages: Stage[];
  agents: Agent[];
  totalContacts: number;
}

export function BroadcastClient({ stages, agents, totalContacts }: BroadcastClientProps) {
  const [targetType, setTargetType] = useState('all');
  const [targetValue, setTargetValue] = useState('');
  const [message, setMessage] = useState('');
  const [delaySecs, setDelaySecs] = useState(3);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleSend = async () => {
    if (!message.trim()) {
      alert('Pesan tidak boleh kosong');
      return;
    }

    if (targetType !== 'all' && !targetValue) {
      alert('Silakan pilih target spesifik');
      return;
    }

    const confirmMsg = `Anda yakin ingin mengirim pesan broadcast ini?\n\nTarget: ${targetType}\nJeda antar pesan: ${delaySecs} detik`;
    if (!window.confirm(confirmMsg)) return;

    setIsSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetValue,
          message,
          delayMs: delaySecs * 1000
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        setResult({ success: true, message: data.message });
        setMessage(''); // Clear message on success
      } else {
        setResult({ success: false, message: data.error || 'Gagal mengirim broadcast' });
      }
    } catch (error) {
      console.error(error);
      setResult({ success: false, message: 'Terjadi kesalahan sistem' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <Send className="w-6 h-6 mr-3 text-[#1A56DB]" />
            Broadcast Message
          </h1>
          <p className="text-slate-500 mt-2">
            Kirim pesan massal ke banyak kontak sekaligus. Gunakan jeda pengiriman untuk menghindari pemblokiran nomor oleh WhatsApp.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Target Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center">
              <Users className="w-5 h-5 mr-2 text-slate-400" />
              Target Penerima
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Target</label>
                <select 
                  value={targetType}
                  onChange={(e) => {
                    setTargetType(e.target.value);
                    setTargetValue('');
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1A56DB] outline-none bg-white"
                >
                  <option value="all">Semua Kontak ({totalContacts})</option>
                  <option value="stage">Berdasarkan Status (Stage)</option>
                  <option value="agent">Berdasarkan Agent (FR)</option>
                </select>
              </div>

              {targetType === 'stage' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Status</label>
                  <select 
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1A56DB] outline-none bg-white"
                  >
                    <option value="">-- Pilih Status --</option>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {targetType === 'agent' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Agent</label>
                  <select 
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1A56DB] outline-none bg-white"
                  >
                    <option value="">-- Pilih Agent --</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.fullName}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Pengaturan Pesan</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Isi Pesan</label>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  placeholder="Ketik pesan broadcast di sini..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1A56DB] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jeda Antar Pesan (detik)</label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="number" 
                    min="0"
                    max="60"
                    value={delaySecs}
                    onChange={(e) => setDelaySecs(parseInt(e.target.value) || 0)}
                    className="w-24 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1A56DB] outline-none"
                  />
                  <span className="text-sm text-slate-500">Rekomendasi: 3-5 detik untuk menghindari blokir</span>
                </div>
              </div>
            </div>
          </div>

          {result && (
            <div className={`p-4 rounded-lg flex items-start ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
              <span>{result.message}</span>
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button 
              onClick={handleSend}
              disabled={isSending || (targetType !== 'all' && !targetValue)}
              className="bg-[#1A56DB] text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Memulai Broadcast...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Kirim Broadcast
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
