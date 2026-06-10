'use client';

import { useState, useRef, useCallback } from 'react';
import { User, Phone, Calendar, GripVertical, ChevronRight, TrendingUp, Users } from 'lucide-react';
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

interface LeadsPipelineProps {
  initialContacts: Contact[];
  stages: Stage[];
  agents: Agent[];
}

// Stag color hex to Tailwind-compatible style
function stageStyle(color: string) {
  return {
    backgroundColor: `${color}18`,
    borderColor: `${color}40`,
    color: color,
  };
}

function getRevenue(contact: Contact): number {
  const revField = contact.customFields?.find(f => f.fieldKey === 'revenue');
  return revField ? parseFloat(revField.fieldValue) || 0 : 0;
}

function formatIDR(val: number): string {
  if (val === 0) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    notation: val >= 1_000_000 ? 'compact' : 'standard',
  }).format(val);
}

function formatDate(date: Date | null): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(date));
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

// ─── Kanban Card ─────────────────────────────────────────────────────────────

interface KanbanCardProps {
  contact: Contact;
  stages: Stage[];
  onDragStart: (e: React.DragEvent, contactId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onClick: (contact: Contact) => void;
  isDragging: boolean;
}

function KanbanCard({ contact, onDragStart, onDragEnd, onClick, isDragging }: KanbanCardProps) {
  const revenue = getRevenue(contact);
  const agent = contact.assignedAgent;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, contact.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(contact)}
      className={`
        group bg-white border border-slate-200/80 rounded-2xl p-4 cursor-grab active:cursor-grabbing
        shadow-sm hover:shadow-md hover:-translate-y-0.5
        transition-all duration-150 select-none
        ${isDragging ? 'opacity-40 scale-95 rotate-1' : 'opacity-100'}
      `}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
            {getInitials(contact.fullName)}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate leading-tight">
              {contact.fullName || 'Tanpa Nama'}
            </p>
            {contact.age && (
              <p className="text-xs text-slate-400 font-medium">{contact.age} thn</p>
            )}
          </div>
        </div>
        <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-400 shrink-0 mt-0.5 transition-colors" />
      </div>

      {/* Chief Complaint */}
      {contact.chiefComplaint && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed bg-slate-50 rounded-xl px-2.5 py-2 border border-slate-100">
          {contact.chiefComplaint}
        </p>
      )}

      {/* Meta Row */}
      <div className="flex items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <Phone className="w-3 h-3 shrink-0" />
          <span className="font-medium truncate">{contact.whatsappNumber.slice(-8)}</span>
        </div>

        {revenue > 0 && (
          <div className="flex items-center gap-1 text-emerald-600 font-bold">
            <TrendingUp className="w-3 h-3" />
            <span>{formatIDR(revenue)}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {agent ? (
            <>
              <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0">
                {getInitials(agent.fullName)}
              </div>
              <span className="text-xs text-slate-500 font-medium truncate">{agent.fullName}</span>
            </>
          ) : (
            <>
              <User className="w-3.5 h-3.5 text-slate-300" />
              <span className="text-xs text-slate-300 font-medium">Belum di-assign</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 text-slate-300 shrink-0">
          <Calendar className="w-3 h-3" />
          <span className="text-[10px] font-medium">{formatDate(contact.lastInteractionAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  stage: Stage;
  contacts: Contact[];
  stages: Stage[];
  dragOverColumnId: string | null;
  draggingContactId: string | null;
  onDragStart: (e: React.DragEvent, contactId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, stageId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onCardClick: (contact: Contact) => void;
}

function KanbanColumn({
  stage,
  contacts,
  stages,
  dragOverColumnId,
  draggingContactId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardClick,
}: KanbanColumnProps) {
  const isOver = dragOverColumnId === stage.id;
  const totalRevenue = contacts.reduce((sum, c) => sum + getRevenue(c), 0);

  return (
    <div
      className="flex flex-col min-w-[280px] max-w-[310px] w-full shrink-0"
      onDragOver={(e) => onDragOver(e, stage.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      {/* Column Header */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-2xl mb-3 border"
        style={stageStyle(stage.color)}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full shadow-sm"
            style={{ backgroundColor: stage.color }}
          />
          <span className="font-extrabold text-sm" style={{ color: stage.color }}>
            {stage.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalRevenue > 0 && (
            <span className="text-[10px] font-bold opacity-70">
              {formatIDR(totalRevenue)}
            </span>
          )}
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black text-white shadow-sm"
            style={{ backgroundColor: stage.color }}
          >
            {contacts.length}
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`
          flex-1 flex flex-col gap-3 rounded-2xl p-2 min-h-[120px] transition-all duration-150
          ${isOver
            ? 'bg-primary/5 border-2 border-dashed border-primary/40 shadow-inner'
            : 'bg-slate-100/50 border-2 border-transparent'
          }
        `}
      >
        {contacts.map(contact => (
          <KanbanCard
            key={contact.id}
            contact={contact}
            stages={stages}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onCardClick}
            isDragging={draggingContactId === contact.id}
          />
        ))}

        {/* Empty state hint while dragging over */}
        {contacts.length === 0 && (
          <div className={`
            flex-1 flex flex-col items-center justify-center py-8 gap-2 text-center
            ${isOver ? 'text-primary' : 'text-slate-300'}
            transition-colors duration-150
          `}>
            <ChevronRight className="w-6 h-6 mx-auto opacity-50" />
            <p className="text-xs font-semibold">
              {isOver ? 'Lepaskan di sini' : 'Tidak ada pasien'}
            </p>
          </div>
        )}

        {/* Drop indicator when dragging over non-empty column */}
        {isOver && contacts.length > 0 && (
          <div className="h-1.5 w-full rounded-full bg-primary/30 animate-pulse mx-auto" />
        )}
      </div>
    </div>
  );
}

// ─── Unassigned Column ────────────────────────────────────────────────────────

interface UnassignedColumnProps {
  contacts: Contact[];
  stages: Stage[];
  dragOverColumnId: string | null;
  draggingContactId: string | null;
  onDragStart: (e: React.DragEvent, contactId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, stageId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onCardClick: (contact: Contact) => void;
}

function UnassignedColumn(props: UnassignedColumnProps) {
  const UNASSIGNED_ID = '__unassigned__';
  const isOver = props.dragOverColumnId === UNASSIGNED_ID;

  return (
    <div
      className="flex flex-col min-w-[280px] max-w-[310px] w-full shrink-0"
      onDragOver={(e) => props.onDragOver(e, UNASSIGNED_ID)}
      onDragLeave={props.onDragLeave}
      onDrop={(e) => props.onDrop(e, UNASSIGNED_ID)}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl mb-3 border bg-slate-100 border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          <span className="font-extrabold text-sm text-slate-500">Belum Ada Stage</span>
        </div>
        <div className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center text-[11px] font-black text-white">
          {props.contacts.length}
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`
          flex-1 flex flex-col gap-3 rounded-2xl p-2 min-h-[120px] transition-all duration-150
          ${isOver
            ? 'bg-slate-200/50 border-2 border-dashed border-slate-400/50 shadow-inner'
            : 'bg-slate-100/50 border-2 border-transparent'
          }
        `}
      >
        {props.contacts.map(contact => (
          <KanbanCard
            key={contact.id}
            contact={contact}
            stages={props.stages}
            onDragStart={props.onDragStart}
            onDragEnd={props.onDragEnd}
            onClick={props.onCardClick}
            isDragging={props.draggingContactId === contact.id}
          />
        ))}
        {props.contacts.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-slate-300 text-xs font-semibold gap-2">
            <Users className="w-6 h-6 opacity-50" />
            <span>{isOver ? 'Lepaskan di sini' : 'Tidak ada pasien'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LeadsPipelineClient({ initialContacts, stages }: LeadsPipelineProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [draggingContactId, setDraggingContactId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [savingContactId, setSavingContactId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const dragLeaveTimer = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Auto-save stage change to database
  const saveStageChange = useCallback(async (contactId: string, newStageId: string | null) => {
    setSavingContactId(contactId);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId: newStageId === null ? 'null' : newStageId }),
      });
      if (!res.ok) throw new Error('Save failed');
      showToast('Status pasien diperbarui ✓');
    } catch {
      showToast('Gagal menyimpan perubahan', 'error');
      // Revert optimistic update on failure
      setContacts(initialContacts);
    } finally {
      setSavingContactId(null);
    }
  }, [initialContacts, showToast]);

  // ── Drag handlers ──
  const handleDragStart = useCallback((e: React.DragEvent, contactId: string) => {
    setDraggingContactId(contactId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', contactId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingContactId(null);
    setDragOverColumnId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragLeaveTimer.current) clearTimeout(dragLeaveTimer.current);
    setDragOverColumnId(stageId);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragLeaveTimer.current = setTimeout(() => {
      setDragOverColumnId(null);
    }, 80);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    const contactId = e.dataTransfer.getData('text/plain');
    if (!contactId) return;

    const UNASSIGNED_ID = '__unassigned__';
    const newStageId = targetStageId === UNASSIGNED_ID ? null : targetStageId;

    // Find the contact being dragged
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    // Skip if dropped in same column
    const currentStageId = contact.stageId;
    if (currentStageId === newStageId) {
      setDraggingContactId(null);
      setDragOverColumnId(null);
      return;
    }

    // Optimistic update
    setContacts(prev => prev.map(c =>
      c.id === contactId
        ? {
            ...c,
            stageId: newStageId,
            stage: newStageId ? stages.find(s => s.id === newStageId) || null : null
          }
        : c
    ));

    setDraggingContactId(null);
    setDragOverColumnId(null);

    // Save to DB in background
    saveStageChange(contactId, newStageId);
  }, [contacts, stages, saveStageChange]);

  // ── Handle slide out save ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSavedContact = useCallback((updatedContact: any) => {
    setContacts(prev => prev.map(c => c.id === updatedContact.id ? { ...c, ...updatedContact } : c));
  }, []);

  // ── Group contacts by stage ──
  const UNASSIGNED_ID = '__unassigned__';
  const contactsByStage: Record<string, Contact[]> = {};

  // Init all stage buckets
  for (const stage of stages) {
    contactsByStage[stage.id] = [];
  }
  contactsByStage[UNASSIGNED_ID] = [];

  // Fill buckets
  for (const contact of contacts) {
    if (contact.stageId && contactsByStage[contact.stageId]) {
      contactsByStage[contact.stageId].push(contact);
    } else {
      contactsByStage[UNASSIGNED_ID].push(contact);
    }
  }

  const totalContacts = contacts.length;
  const totalRevenue = contacts.reduce((sum, c) => sum + getRevenue(c), 0);

  return (
    <div className="flex flex-col h-full bg-slate-50/40 p-4 md:p-6 lg:p-8 overflow-hidden">
      {/* Summary Stats */}
      <div className="flex items-center gap-4 mb-5 text-sm text-slate-500 font-medium">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-primary" />
          <span><strong className="text-slate-700">{totalContacts}</strong> pasien</span>
        </div>
        {totalRevenue > 0 && (
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span>Total: <strong className="text-emerald-600">{formatIDR(totalRevenue)}</strong></span>
          </div>
        )}
        {savingContactId && (
          <div className="flex items-center gap-1.5 text-primary animate-pulse ml-auto">
            <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-xs font-semibold">Menyimpan...</span>
          </div>
        )}
      </div>

      {/* Kanban Board — horizontally scrollable */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-4 h-full items-start" style={{ minWidth: `${(stages.length + 1) * 310}px` }}>
          {/* Render stage columns */}
          {stages.map(stage => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              contacts={contactsByStage[stage.id] || []}
              stages={stages}
              dragOverColumnId={dragOverColumnId}
              draggingContactId={draggingContactId}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onCardClick={setSelectedContact}
            />
          ))}

          {/* Unassigned column */}
          {contactsByStage[UNASSIGNED_ID].length > 0 && (
            <UnassignedColumn
              contacts={contactsByStage[UNASSIGNED_ID]}
              stages={stages}
              dragOverColumnId={dragOverColumnId}
              draggingContactId={draggingContactId}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onCardClick={setSelectedContact}
            />
          )}
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`
          fixed bottom-6 right-6 z-50
          px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold
          animate-in slide-in-from-bottom-4 duration-300
          ${toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
          }
        `}>
          {toast.message}
        </div>
      )}

      {/* Lead detail slideout */}
      <LeadDetailsSlideout
        isOpen={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        contact={selectedContact}
        onSaved={handleSavedContact}
      />
    </div>
  );
}
