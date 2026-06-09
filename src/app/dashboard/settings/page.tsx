import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/settings/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();

  // Protect page: Only ADMIN and SUPER_ADMIN can access settings
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  // Fetch initial templates
  const templates = await prisma.messageTemplate.findMany({
    orderBy: { createdAt: "desc" }
  });

  // Fetch initial users (now includes whatsappNumber)
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      whatsappNumber: true,
      createdAt: true,
    },
    orderBy: { fullName: "asc" }
  });

  // Fetch products
  const products = await prisma.product.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return (
    <SettingsClient
      initialTemplates={templates}
      initialUsers={users}
      initialProducts={products}
    />
  );
}
