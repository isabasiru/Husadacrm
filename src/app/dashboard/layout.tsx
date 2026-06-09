import { Sidebar } from "@/components/sidebar"
import { getSession } from "@/lib/auth"
import prisma from "@/lib/prisma"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession();
  
  let currentUser = null;
  if (session?.userId) {
    currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { fullName: true, role: true, avatarUrl: true }
    });
  }

  const role = currentUser?.role || 'AGENT';

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar role={role} user={currentUser} />
      <main className="flex-1 flex flex-col min-w-0 my-4 mr-4 bg-surface border border-border rounded-2xl shadow-md overflow-hidden">
        {children}
      </main>
    </div>
  )
}
