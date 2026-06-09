import { Contact, Stage, ContactTag, Tag } from "@prisma/client";
import { UserCircle, MapPin, Calendar, Tag as TagIcon, FileText, Phone, Hash } from "lucide-react";

type ContactWithRelations = Contact & {
  stage: Stage | null;
  tags: (ContactTag & { tag: Tag })[];
};

export function PatientProfile({ contact }: { contact: ContactWithRelations }) {
  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header — Patient identity card */}
      <div className="p-6 border-b border-border">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-bold text-xl mb-3">
            {contact.fullName ? contact.fullName.charAt(0).toUpperCase() : '#'}
          </div>
          <h2 className="font-bold text-base text-foreground text-center">{contact.fullName || 'Unknown Patient'}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{contact.whatsappNumber}</p>
        </div>
        
        {/* Tags row */}
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {contact.stage && (
            <span 
              className="px-2.5 py-1 text-[10px] font-semibold rounded-md"
              style={{ backgroundColor: `${contact.stage.color}12`, color: contact.stage.color }}
            >
              {contact.stage.name}
            </span>
          )}
          {contact.tags?.map(ct => (
            <span key={ct.tagId} className="px-2.5 py-1 bg-muted text-muted-foreground text-[10px] font-medium rounded-md flex items-center gap-1">
              <TagIcon className="w-2.5 h-2.5" />
              {ct.tag.name}
            </span>
          ))}
        </div>
      </div>

      {/* Details sections */}
      <div className="p-5 space-y-5 flex-1 overflow-y-auto">
        {/* Patient Details Card */}
        <div className="card-flat p-4 space-y-3.5">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Detail Pasien</h3>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                <Hash className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium">MRN / ID</p>
                <p className="text-xs font-semibold text-foreground">{contact.id.substring(0,8)}...</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                <Phone className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium">WhatsApp</p>
                <p className="text-xs font-semibold text-foreground">{contact.whatsappNumber}</p>
              </div>
            </div>

            {contact.domicile && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">Alamat</p>
                  <p className="text-xs font-semibold text-foreground">{contact.domicile}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                <Calendar className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium">Terdaftar</p>
                <p className="text-xs font-semibold text-foreground">{new Date(contact.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                <UserCircle className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium">Sumber</p>
                <p className="text-xs font-semibold text-foreground capitalize">{(contact.source || 'manual').replace(/_/g, ' ')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Internal Notes */}
        <div className="card-flat p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Catatan Internal</h3>
            <button className="text-primary text-[10px] font-semibold hover:underline">Tambah</button>
          </div>
          {contact.notes ? (
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">{contact.notes}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Belum ada catatan untuk pasien ini.</p>
          )}
        </div>
      </div>
    </div>
  );
}
