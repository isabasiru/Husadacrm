import { Sidebar } from "@/components/sidebar"
import { getSession } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession();
  const role = session?.role || 'AGENT'; // Default to least privileged

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar role={role} />
      <main className="flex-1 flex flex-col min-w-0 my-4 mr-4 bg-surface border border-border rounded-2xl shadow-md overflow-hidden">
        {children}
      </main>
    </div>
  )
}
