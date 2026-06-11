import { Contact, Stage, ContactTag, Tag, Message, MessageTemplate, User } from "@prisma/client";
import { Send, Paperclip, MoreVertical, Zap, RefreshCw, Trash2, Bot } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/hooks/use-socket";
import { format } from "date-fns";

type ContactWithRelations = Contact & {
  stage: Stage | null;
  tags: (ContactTag & { tag: Tag })[];
  conversations?: { id: string, lastRepliedById: string | null, lastRepliedBy: { fullName: string } | null }[];
};

type MessageWithRelations = Message & {
  sentBy?: { id: string; fullName: string } | null;
};

export function ChatArea({ 
  contact, 
  currentAgentName = "Agent",
  onContactUpdated,
  onSync,
  syncing = false
}: { 
  contact: ContactWithRelations,
  currentAgentName?: string,
  onContactUpdated?: (contact: Partial<ContactWithRelations>) => void,
  onSync?: () => void,
  syncing?: boolean
}) {
  const [messages, setMessages] = useState<MessageWithRelations[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [input, setInput] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const [agents, setAgents] = useState<User[]>([]);
  const [assignedAgentId, setAssignedAgentId] = useState<string | null>(contact.assignedAgentId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { socket, joinConversation, leaveConversation } = useSocket();
  const prevConversationIdRef = useRef<string | null>(null);

  const handleClearChat = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus seluruh riwayat obrolan untuk pasien ini dari CRM? Tindakan ini tidak dapat dibatalkan.")) {
      return;
    }
    
    setShowMenu(false);
    try {
      const res = await fetch(`/api/messages?contactId=${contact.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMessages([]);
        if (onContactUpdated) {
          onContactUpdated({
            id: contact.id,
            totalMessages: 0,
            lastInteractionAt: null,
          });
        }
      } else {
        alert("Gagal menghapus riwayat obrolan.");
      }
    } catch (err) {
      console.error("Failed to clear chat:", err);
      alert("Gagal menghapus riwayat obrolan.");
    }
  };

  const handleToggleChatbot = async () => {
    setShowMenu(false);
    const newChatbotState = contact.chatbotState === 'done' ? null : 'done';
    const actionText = contact.chatbotState === 'done' ? "mengaktifkan kembali" : "menonaktifkan";
    if (!confirm(`Apakah Anda yakin ingin ${actionText} chatbot untuk pasien ini?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbotState: newChatbotState }),
      });
      if (res.ok) {
        const data = await res.json();
        if (onContactUpdated && data.contact) {
          onContactUpdated(data.contact);
        }
      } else {
        alert("Gagal mengubah status chatbot.");
      }
    } catch (err) {
      console.error("Failed to toggle chatbot:", err);
      alert("Gagal mengubah status chatbot.");
    }
  };

  // Load agents and messages
  useEffect(() => {
    // Fetch agents list
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAgents(data);
        }
      })
      .catch(err => console.error("Failed to load agents", err));

    // Fetch messages & templates
    setIsLoading(true);
    Promise.all([
      fetch(`/api/messages?contactId=${contact.id}`).then(res => res.json()),
      fetch('/api/templates').then(res => res.json())
    ])
      .then(([messagesData, templatesData]) => {
        if (Array.isArray(messagesData)) {
          setMessages(messagesData);
        }
        if (Array.isArray(templatesData)) {
          setTemplates(templatesData);
        }
      })
      .finally(() => setIsLoading(false));
  }, [contact.id]);

  // Join/leave conversation room via shared socket
  useEffect(() => {
    if (!socket) return;

    const conversationId = contact.conversations?.[0]?.id;
    
    // Leave previous conversation room
    if (prevConversationIdRef.current && prevConversationIdRef.current !== conversationId) {
      leaveConversation(prevConversationIdRef.current);
    }

    // Join new conversation room
    if (conversationId) {
      joinConversation(conversationId);
      prevConversationIdRef.current = conversationId;
    }

    return () => {
      if (conversationId) {
        leaveConversation(conversationId);
      }
    };
  }, [socket, contact.conversations, joinConversation, leaveConversation]);

  // Listen for new messages via shared socket
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: { conversationId: string; message: MessageWithRelations }) => {
      if (data && data.message) {
        const msg = data.message;
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    const handleChatCleared = (data: { contactId: string }) => {
      if (data && data.contactId === contact.id) {
        setMessages([]);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('chat_cleared', handleChatCleared);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('chat_cleared', handleChatCleared);
    };
  }, [socket, contact.id]);

  // Update assignedAgentId when contact changes
  useEffect(() => {
    setAssignedAgentId(contact.assignedAgentId);
  }, [contact.assignedAgentId, contact.id]);

  // Scroll to bottom when messages list updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const content = input;
    const type = isNote ? 'NOTE' : 'TEXT';
    setInput("");

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          content: content,
          type: type
        })
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages(prev => {
          if (prev.find(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        
        // Notify parent list of the update
        if (onContactUpdated) {
          onContactUpdated({
            id: contact.id,
            updatedAt: new Date(),
            lastInteractionAt: new Date(),
          });
        }
      }
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  const handleAssignChange = async (newAgentId: string) => {
    try {
      const res = await fetch(`/api/contacts/${contact.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: newAgentId })
      });
      if (res.ok) {
        const data = await res.json();
        setAssignedAgentId(newAgentId);
        if (onContactUpdated) {
          onContactUpdated(data.contact);
        }
      }
    } catch (err) {
      console.error("Failed to reassign agent", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-secondary">
      {/* Header with Assignment Controls */}
      <div className="h-16 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
            {contact.fullName ? contact.fullName.charAt(0).toUpperCase() : '#'}
          </div>
          <div className="ml-3">
            <div className="flex items-center">
              <h2 className="font-semibold text-foreground text-sm">{contact.fullName || contact.whatsappNumber}</h2>
              {onSync && (
                <button 
                  onClick={onSync}
                  disabled={syncing}
                  className={`ml-2 p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors ${syncing ? 'animate-spin' : ''}`}
                  title="Sinkronisasi Pesan dengan WAHA"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{contact.whatsappNumber}</p>
          </div>
        </div>

        {/* Assignment Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground card-elevated px-3 py-1.5 rounded-lg">
            <span className="font-semibold text-foreground/70">Delegasi:</span>
            <select
              value={assignedAgentId || ''}
              onChange={(e) => handleAssignChange(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-foreground cursor-pointer text-xs"
            >
              <option value="">Belum Ditugaskan</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.fullName} ({agent.role})
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-surface border border-border shadow-xl rounded-xl overflow-hidden z-20 py-1">
                <button
                  onClick={handleToggleChatbot}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <Bot className="w-4 h-4 text-primary" />
                  {contact.chatbotState === 'done' ? 'Aktifkan Chatbot AI' : 'Nonaktifkan Chatbot AI'}
                </button>
                <button
                  onClick={handleClearChat}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-t border-border/50 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Riwayat Chat
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3" ref={scrollRef}>
        {isLoading && (
          <div className="flex justify-center text-muted-foreground text-sm py-8">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
              Memuat pesan...
            </div>
          </div>
        )}
        
        {messages.map((msg, i) => {
          const isOutbound = msg.direction === 'OUTBOUND';
          const isInternalNote = msg.isInternalNote || msg.type === 'INTERNAL_NOTE';
          
          return (
            <div key={msg.id || i} className={`flex ${isInternalNote ? 'justify-center my-3' : isOutbound ? 'justify-end' : 'justify-start'}`}>
              {isInternalNote ? (
                // Internal note — warm amber card
                <div className="bg-amber-50 border border-amber-200/60 text-amber-900 px-4 py-2.5 rounded-xl max-w-[85%] text-xs flex flex-col gap-1 shadow-sm">
                  <div className="flex items-center justify-between gap-6 font-bold text-amber-800 border-b border-amber-100 pb-1 mb-1">
                    <span>📌 Catatan Internal</span>
                    {msg.sentBy && (
                      <span className="text-[10px] bg-amber-100/80 px-1.5 py-0.5 rounded">
                        Oleh: {msg.sentBy.fullName}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <div className="text-[9px] text-amber-500 text-right">
                    {msg.sentAt && format(new Date(msg.sentAt), 'hh:mm a')}
                  </div>
                </div>
              ) : (
                // WhatsApp Message Bubble
                <div className={`${
                  isOutbound 
                    ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm' 
                    : 'bg-surface text-foreground rounded-2xl rounded-tl-sm border border-border'
                } p-3 max-w-[70%] flex flex-col gap-0.5 shadow-sm`}>
                  {/* Outbound Agent tag */}
                  {isOutbound && msg.sentBy && (
                    <div className="text-[9px] text-primary-foreground/60 font-extrabold pb-0.5">
                      {msg.sentBy.fullName}
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <div className={`text-[9px] mt-1 flex gap-1 justify-end items-center ${isOutbound ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>
                    {msg.sentAt && format(new Date(msg.sentAt), 'hh:mm a')}
                    {isOutbound && (
                      <span className="font-bold">
                        {msg.wahaStatus === 'READ' ? '✓✓' : msg.wahaStatus === 'DELIVERED' ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reply vs Internal Note Mode Selector */}
      <div className="flex border-t border-border bg-muted/30 px-4 text-xs select-none shrink-0">
        <button 
          onClick={() => setIsNote(false)}
          className={`py-2.5 px-4 border-b-2 font-bold transition-all ${
            !isNote 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          💬 Balas Pasien (WhatsApp)
        </button>
        <button 
          onClick={() => setIsNote(true)}
          className={`py-2.5 px-4 border-b-2 font-bold transition-all ${
            isNote 
              ? 'border-amber-500 text-amber-700 bg-amber-50/50' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          📌 Catatan Internal (Klinik)
        </button>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface border-t border-border shrink-0 relative">
        {showTemplates && (
          <div className="absolute bottom-full left-4 mb-2 w-72 bg-surface border border-border shadow-xl rounded-xl overflow-hidden z-20">
            <div className="p-3 bg-muted/50 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Templat Pesan</div>
            <div className="max-h-56 overflow-y-auto">
              {templates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">Belum ada templat</div>
              ) : (
                templates.map(tpl => (
                  <button 
                    key={tpl.id}
                    className="w-full text-left p-3.5 hover:bg-primary/5 border-b border-border/50 last:border-b-0 transition-colors"
                    onClick={() => {
                      let text = tpl.content;
                      text = text.replace(/{{nama}}/g, contact.fullName?.split(' ')[0] || contact.whatsappNumber);
                      text = text.replace(/{{agent_name}}/g, currentAgentName);
                      setInput(text);
                      setShowTemplates(false);
                    }}
                  >
                    <div className="text-xs font-bold text-foreground">{tpl.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate mt-1">{tpl.content}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        <div className={`flex items-end input-field p-2 transition-all ${
          isNote ? 'bg-amber-50/30 border-amber-200' : ''
        }`}>
          <button 
            className={`p-2 transition-colors rounded-lg ${
              showTemplates 
                ? 'text-primary bg-primary/10' 
                : isNote 
                  ? 'text-amber-600 hover:bg-amber-50' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            onClick={() => setShowTemplates(!showTemplates)}
            title="Templat Balasan"
          >
            <Zap className="w-5 h-5" />
          </button>
          <button className={`p-2 transition-colors rounded-lg ${isNote ? 'text-amber-600 hover:bg-amber-50' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
            <Paperclip className="w-5 h-5" />
          </button>
          <textarea 
            placeholder={isNote ? "Ketik catatan internal..." : "Ketik pesan balasan..."}
            className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 min-h-[40px] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          ></textarea>
          <button 
            onClick={handleSend} 
            className={`p-2.5 rounded-xl transition-all ${
              isNote 
                ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                : 'btn-primary'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
