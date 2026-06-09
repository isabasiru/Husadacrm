"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatList } from "./chat-list";
import { ChatArea } from "./chat-area";
import { PatientProfile } from "./patient-profile";
import { Contact, Stage, ContactTag, Tag } from "@prisma/client";
import { useSocket } from "@/hooks/use-socket";

type ContactWithRelations = Contact & {
  stage: Stage | null;
  tags: (ContactTag & { tag: Tag })[];
  conversations?: { id: string, lastRepliedById: string | null, lastRepliedBy: { fullName: string } | null }[];
  slaWarning?: boolean;
};

const playAlertSound = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
    
    setTimeout(() => {
      const osc2 = audioCtx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc2.connect(gainNode);
      osc2.start();
      osc2.stop(audioCtx.currentTime + 0.25);
    }, 150);
  } catch {
    console.warn("Audio chime play blocked by autoplay settings");
  }
};

const playIncomingSound = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gainNode.connect(audioCtx.destination);

    // Triple-tone ascending for incoming message
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 — pleasant major chord
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.connect(gainNode);
      osc.start(audioCtx.currentTime + i * 0.1);
      osc.stop(audioCtx.currentTime + i * 0.1 + 0.15);
    });
  } catch {
    console.warn("Audio chime play blocked by autoplay settings");
  }
};

// Fetch with retry (1 retry after delay)
async function fetchWithRetry(url: string, retries = 1, delayMs = 500): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok && retries > 0) {
    await new Promise(r => setTimeout(r, delayMs));
    return fetchWithRetry(url, retries - 1, delayMs);
  }
  return res;
}

export function InboxClient({ 
  initialContacts,
  currentAgentName = "Agent",
  stages = [],
  currentUser = { id: "", role: "AGENT" }
}: { 
  initialContacts: ContactWithRelations[],
  currentAgentName?: string,
  stages: Stage[],
  currentUser?: { id: string, role: string }
}) {
  const [contacts, setContacts] = useState<ContactWithRelations[]>(initialContacts);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { socket, isConnected } = useSocket();

  const selectedContact = contacts.find(c => c.id === selectedContactId) || null;

  const [wahaStatus, setWahaStatus] = useState<"CONNECTED" | "SYNCING" | "DISCONNECTED">("CONNECTED");
  const [syncingContactId, setSyncingContactId] = useState<string | null>(null);

  // Reconcile function (sync missing messages)
  const reconcileChat = useCallback(async (contactId: string) => {
    setSyncingContactId(contactId);
    try {
      const res = await fetch('/api/waha/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId })
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`[WAHA Auto-Reconcile] Synced ${data.syncedCount} messages`);
      }
    } catch (err) {
      console.error("[WAHA Sync Error]:", err);
    } finally {
      setSyncingContactId(null);
    }
  }, []);


  // Request notification permissions on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
  }, []);

  // Load initial WAHA session status
  useEffect(() => {
    fetch('/api/waha/status')
      .then(res => res.json())
      .then(data => {
        if (data && data.status) {
          setWahaStatus(data.status);
        }
      })
      .catch(err => console.error("Failed to load WAHA status:", err));
  }, []);

  // Auto-sync on window focus
  useEffect(() => {
    const handleFocus = () => {
      if (selectedContactId) {
        reconcileChat(selectedContactId);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [selectedContactId, reconcileChat]);

  // Auto-sync on socket reconnect
  useEffect(() => {
    if (isConnected && selectedContactId) {
      reconcileChat(selectedContactId);
    }
  }, [isConnected, selectedContactId, reconcileChat]);

  // Auto-sync when active contact is selected
  useEffect(() => {
    if (selectedContactId) {
      reconcileChat(selectedContactId);
    }
  }, [selectedContactId, reconcileChat]);


  const showSlaNotification = useCallback((patientName: string) => {
    playAlertSound();
    
    // Web notifications
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("SLA Warning - Husada CRM", {
        body: `Pasien ${patientName} belum dibalas lebih dari 5 menit!`,
        icon: "/favicon.ico"
      });
    }
    
    // UI Toast
    setToastMessage(`⚠️ SLA: ${patientName} belum dibalas > 5 menit!`);
    setTimeout(() => setToastMessage(null), 5000);
  }, []);

  const showIncomingNotification = useCallback((contactName: string) => {
    playIncomingSound();
    
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("Pesan Masuk - Husada CRM", {
        body: `Pesan baru dari ${contactName}`,
        icon: "/favicon.ico"
      });
    }
  }, []);

  // 1. Real-time updates & Handovers (Socket.io)
  useEffect(() => {
    if (!socket) return;

    // Handles incoming/outgoing message listing updates
    const handleInboxUpdate = async (data: { 
      contactId: string, 
      lastMessage: string, 
      lastMessageAt: string, 
      senderName?: string, 
      direction?: string,
      contact?: ContactWithRelations
    }) => {
      // Play incoming sound for INBOUND messages
      if (!data.senderName && data.direction !== 'OUTBOUND') {
        const existingContact = contacts.find(c => c.id === data.contactId);
        if (existingContact) {
          showIncomingNotification(existingContact.fullName || existingContact.whatsappNumber);
        }
      }

      // 1. If full contact data is directly sent in the socket event, update synchronously
      if (data.contact) {
        const updatedContact = data.contact;
        setContacts(prev => {
          // Prevent older data from overwriting newer state
          const existing = prev.find(c => c.id === data.contactId);
          if (existing && new Date(existing.updatedAt).getTime() > new Date(updatedContact.updatedAt).getTime()) {
            return prev;
          }
          const filtered = prev.filter(c => c.id !== data.contactId);
          if (currentUser.role === 'AGENT' && updatedContact.assignedAgentId !== currentUser.id) {
            return filtered;
          }
          return [updatedContact, ...filtered].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        });
        return;
      }

      // 2. Fallback: HTTP fetch with race condition protection
      try {
        const res = await fetch(`/api/contacts/${data.contactId}`);
        if (res.ok) {
          const resData = await res.json();
          const updatedContact = resData?.contact;
          
          if (updatedContact && updatedContact.id) {
            setContacts(prev => {
              const existing = prev.find(c => c.id === data.contactId);
              if (existing && new Date(existing.updatedAt).getTime() > new Date(updatedContact.updatedAt).getTime()) {
                return prev;
              }
              const filtered = prev.filter(c => c.id !== data.contactId);
              if (currentUser.role === 'AGENT' && updatedContact.assignedAgentId !== currentUser.id) {
                return filtered;
              }
              return [updatedContact, ...filtered].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            });
          }
        }
      } catch (err) {
        console.error("Failed to refetch updated contact on inbox_update:", err);
      }
    };

    // Handles live escalation/re-assignment
    const handleContactAssigned = (data: { contactId: string, fromAgentId: string | null, toAgentId: string, assignedTo: string, assignedBy: string, contact: ContactWithRelations }) => {
      // Role checks for security and access layout
      if (currentUser.role === "AGENT") {
        if (data.toAgentId !== currentUser.id) {
          // If assigned to someone else, remove it from our sidebar list
          setContacts(prev => prev.filter(c => c.id !== data.contactId));
          if (selectedContactId === data.contactId) {
            setSelectedContactId(null);
            setToastMessage(`Obrolan ini telah dipindahkan ke agen ${data.assignedTo}`);
            setTimeout(() => setToastMessage(null), 5000);
          }
        } else {
          // If assigned to us, add it and toast alert
          setContacts(prev => {
            if (prev.some(c => c.id === data.contactId)) return prev;
            return [data.contact, ...prev];
          });
          playAlertSound();
          setToastMessage(`Pasien ${data.contact.fullName || data.contact.whatsappNumber} ditugaskan kepada Anda oleh ${data.assignedBy}!`);
          setTimeout(() => setToastMessage(null), 5000);
        }
      } else {
        // ADMIN / SUPER_ADMIN see everything, just update the assignedAgentId in the local state
        setContacts(prev => prev.map(c => {
          if (c.id === data.contactId) {
            return {
              ...c,
              assignedAgentId: data.toAgentId
            };
          }
          return c;
        }));
        setToastMessage(`Pasien ${data.contact.fullName || data.contact.whatsappNumber} dipindahkan ke ${data.assignedTo}`);
        setTimeout(() => setToastMessage(null), 4000);
      }
    };

    const handleWahaSessionStatus = (data: { status: "CONNECTED" | "SYNCING" | "DISCONNECTED" }) => {
      if (data && data.status) {
        setWahaStatus(data.status);
      }
    };

    socket.on("inbox_update", handleInboxUpdate);
    socket.on("contact_assigned", handleContactAssigned);
    socket.on("waha_session_status", handleWahaSessionStatus);

    return () => {
      socket.off("inbox_update", handleInboxUpdate);
      socket.off("contact_assigned", handleContactAssigned);
      socket.off("waha_session_status", handleWahaSessionStatus);
    };
  }, [socket, currentUser, selectedContactId, contacts, showIncomingNotification]);

  // 2. SLA Background Timer Alert (5 mins)
  useEffect(() => {
    const runSlaChecks = () => {
      const now = new Date().getTime();
      setContacts(prev => {
        let changed = false;
        const updated = prev.map(c => {
          const activeConv = c.conversations?.[0];
          // Check if conversation is OPEN and lastRepliedById is null (waiting for response from agent)
          const isPendingAgentResponse = activeConv && activeConv.lastRepliedById === null;
          const waitTime = c.lastInteractionAt ? now - new Date(c.lastInteractionAt).getTime() : 0;
          const isViolatingSLA = isPendingAgentResponse && waitTime > 5 * 60 * 1000; // 5 mins

          if (!!c.slaWarning !== !!isViolatingSLA) {
            changed = true;
            if (isViolatingSLA) {
              showSlaNotification(c.fullName || c.whatsappNumber);
            }
            return { ...c, slaWarning: isViolatingSLA };
          }
          return c;
        });
        return changed ? updated : prev;
      });
    };

    const interval = setInterval(runSlaChecks, 30000); // every 30s
    runSlaChecks();

    return () => clearInterval(interval);
  }, [contacts, showSlaNotification]);

  return (
    <div className="flex flex-1 w-full h-full overflow-hidden relative p-4 gap-4 bg-background pt-10">
      {/* WAHA Session Status Banner */}
      {wahaStatus === 'DISCONNECTED' && (
        <div className="absolute top-0 left-0 right-0 bg-rose-500 text-white text-center py-2 text-xs font-bold z-40 animate-in slide-in-from-top-4 duration-200">
          ⚠️ WhatsApp Terputus! Silakan periksa koneksi WhatsApp di menu Pengaturan / VPS Anda agar chat dapat masuk.
        </div>
      )}
      {wahaStatus === 'SYNCING' && (
        <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-center py-2 text-xs font-bold z-40 animate-in slide-in-from-top-4 duration-200">
          🔄 WhatsApp sedang sinkronisasi data dengan server... Mohon tunggu sebentar.
        </div>
      )}

      {/* Connection Status Indicator */}
      {!isConnected && (
        <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 text-xs font-semibold">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          Menghubungkan ulang...
        </div>
      )}

      {/* Toast Alert Popups */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 transform -translate-x-1/2 bg-foreground text-background px-5 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2 border border-border/20 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Column 1: Chat List */}
      <div className="w-1/3 min-w-[300px] max-w-[400px] flex flex-col card-elevated overflow-hidden">
        <ChatList 
          contacts={contacts} 
          selectedId={selectedContactId} 
          onSelect={setSelectedContactId}
          stages={stages}
        />
      </div>

      {/* Column 2: Chat Area */}
      <div className="flex-1 flex flex-col card-elevated overflow-hidden">
        {selectedContact ? (
          <ChatArea 
            contact={selectedContact} 
            currentAgentName={currentAgentName} 
            onContactUpdated={(updated) => {
              setContacts(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
            }}
            onSync={() => reconcileChat(selectedContact.id)}
            syncing={syncingContactId === selectedContact.id}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 bg-surface-secondary">
            <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-medium">Pilih percakapan untuk mulai</p>
          </div>
        )}
      </div>

      {/* Column 3: Patient Profile */}
      {selectedContact && (
        <div className="w-1/4 min-w-[250px] max-w-[350px] flex flex-col card-elevated overflow-y-auto">
          <PatientProfile contact={selectedContact} />
        </div>
      )}
    </div>
  );
}
