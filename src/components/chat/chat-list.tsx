import { useState } from "react";
import { Search, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { Contact, Stage, ContactTag, Tag } from "@prisma/client";

type ContactWithRelations = Contact & {
  stage: Stage | null;
  tags: (ContactTag & { tag: Tag })[];
  conversations?: { id: string, lastRepliedById: string | null, lastRepliedBy: { fullName: string } | null }[];
  slaWarning?: boolean;
};

export function ChatList({ 
  contacts, 
  selectedId, 
  onSelect,
  stages = []
}: { 
  contacts: ContactWithRelations[],
  selectedId: string | null,
  onSelect: (id: string) => void,
  stages: Stage[]
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStage, setActiveStage] = useState<string | null>(null);

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = (contact.fullName || contact.whatsappNumber).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = activeStage ? contact.stage?.name === activeStage : true;
    return matchesSearch && matchesStage;
  });

  // Check if contact needs reply (no agent has replied yet)
  const needsReply = (contact: ContactWithRelations) => {
    return contact.conversations?.[0] && contact.conversations[0].lastRepliedById === null;
  };

  return (
    <div className="flex flex-col h-full bg-surface select-none">
      {/* Search & Filter Header */}
      <div className="p-4 border-b border-border">
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Cari kontak..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 input-field text-sm text-foreground"
          />
        </div>
        
        {/* Stage Filter Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
          <button 
            onClick={() => setActiveStage(null)}
            className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
              !activeStage 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            Semua
          </button>
          {stages.map(stage => (
            <button
              key={stage.id}
              onClick={() => setActiveStage(stage.name)}
              className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                activeStage === stage.name 
                  ? 'text-white shadow-sm' 
                  : 'bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
              style={
                activeStage === stage.name 
                  ? { backgroundColor: stage.color } 
                  : undefined
              }
            >
              {stage.name}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Kontak tidak ditemukan.</div>
        ) : (
          filteredContacts.map(contact => {
            const hasSlaWarning = contact.slaWarning;
            const isUnreplied = needsReply(contact);
            const isSelected = selectedId === contact.id;
            
            return (
              <div 
                key={contact.id}
                onClick={() => onSelect(contact.id)}
                className={`px-4 py-3.5 border-b border-border/50 cursor-pointer transition-all flex items-start gap-3 relative ${
                  isSelected 
                    ? 'bg-primary/5 border-l-[3px] border-l-primary' 
                    : 'hover:bg-muted/50'
                }`}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  isUnreplied 
                    ? 'bg-primary/15 text-primary' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {contact.fullName ? contact.fullName.charAt(0).toUpperCase() : '#'}
                  {/* Unread dot */}
                  {isUnreplied && (
                    <div className="absolute top-3 left-[52px] w-2.5 h-2.5 bg-primary rounded-full border-2 border-surface" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Name & Time */}
                  <div className="flex justify-between items-start gap-2">
                    <h3 className={`truncate text-sm ${isUnreplied ? 'font-bold text-foreground' : 'font-medium text-foreground/80'}`}>
                      {contact.fullName || contact.whatsappNumber}
                    </h3>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0" suppressHydrationWarning>
                      {contact.lastInteractionAt 
                        ? formatDistanceToNow(new Date(contact.lastInteractionAt), { addSuffix: true, locale: id })
                        : formatDistanceToNow(new Date(contact.updatedAt), { addSuffix: true, locale: id })
                      }
                    </span>
                  </div>

                  {/* Sub-details */}
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap max-w-[80%]">
                      {contact.stage && (
                        <span 
                          className="text-[10px] px-2 py-0.5 rounded font-semibold"
                          style={{ backgroundColor: `${contact.stage.color}12`, color: contact.stage.color }}
                        >
                          {contact.stage.name}
                        </span>
                      )}

                      {/* Attribution Tag */}
                      {contact.conversations?.[0]?.lastRepliedBy ? (
                        <span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded font-medium">
                          {contact.conversations[0].lastRepliedBy.fullName.split(' ')[0]}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 bg-primary/8 text-primary rounded font-semibold">
                          Perlu Balasan
                        </span>
                      )}
                    </div>

                    {/* SLA Warning Badge */}
                    {hasSlaWarning && (
                      <div className="flex items-center gap-0.5 bg-destructive text-destructive-foreground text-[9px] font-extrabold px-1.5 py-0.5 rounded-md animate-pulse-subtle shadow-sm">
                        <AlertCircle className="w-2.5 h-2.5" />
                        <span>SLA</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
