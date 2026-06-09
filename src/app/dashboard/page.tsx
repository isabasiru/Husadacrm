import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { DashboardOverviewClient } from "@/components/dashboard/dashboard-overview";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  
  if (!session) {
    redirect("/login");
  }

  // Fetch active agents for the agent dropdown filter
  const agents = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      fullName: true
    },
    orderBy: { fullName: 'asc' }
  });

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <DashboardOverviewClient initialAgents={agents} />
    </div>
  );
}
