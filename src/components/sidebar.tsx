'use client';

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { MessageSquare, Users, LayoutDashboard, Settings, LogOut, Activity, Megaphone, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

export function Sidebar({ role = 'AGENT' }: { role?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const isAdminOrSuper = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', show: true },
    { href: '/dashboard/inbox', icon: MessageSquare, label: 'Inbox', show: true },
    { href: '/dashboard/leads', icon: Users, label: 'Leads', show: true },
    { href: '/dashboard/broadcast', icon: Megaphone, label: 'Broadcast', show: isAdminOrSuper },
  ];

  return (
    <div className={`${collapsed ? 'w-[72px]' : 'w-64'} bg-sidebar h-[calc(100vh-2rem)] m-4 flex flex-col justify-between shrink-0 overflow-hidden transition-all duration-300 ease-out card-elevated`}>
      {/* Logo area */}
      <div>
        <div className={`h-16 flex items-center ${collapsed ? 'justify-center' : 'px-5'} border-b border-sidebar-border`}>
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <div className="ml-3 overflow-hidden">
              <span className="font-extrabold text-base text-sidebar-foreground tracking-tight block leading-tight">Husada</span>
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">CRM System</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-2.5 space-y-1 mt-2">
          {navItems.filter(item => item.show).map(item => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group relative ${
                  active
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-sidebar-foreground/70 hover:bg-muted hover:text-sidebar-foreground'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                {/* Active indicator bar */}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <item.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="p-2.5 border-t border-sidebar-border space-y-1">
        {isAdminOrSuper && (
          <Link
            href="/dashboard/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group relative ${
              isActive('/dashboard/settings')
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-sidebar-foreground/70 hover:bg-muted hover:text-sidebar-foreground'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            {isActive('/dashboard/settings') && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
            )}
            <Settings className={`w-[18px] h-[18px] shrink-0 ${isActive('/dashboard/settings') ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
            {!collapsed && <span>Settings</span>}
          </Link>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-sidebar-foreground transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>

        {/* Logout */}
        <button 
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive/70 hover:bg-destructive/5 hover:text-destructive transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
}
