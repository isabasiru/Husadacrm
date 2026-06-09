'use client';

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { 
  MessageSquare, 
  Users, 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Activity, 
  Megaphone, 
  ChevronLeft, 
  ChevronRight,
  Kanban,
  UserCheck
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  role?: string;
  user?: {
    fullName: string;
    role: string;
    avatarUrl?: string | null;
  } | null;
}

export function Sidebar({ role = 'AGENT', user }: SidebarProps) {
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

  // Check if current path matches
  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'US';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const groups = [
    {
      label: 'Utama',
      items: [
        { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', show: true },
        { href: '/dashboard/inbox', icon: MessageSquare, label: 'Inbox', show: true },
      ]
    },
    {
      label: 'Penjualan',
      items: [
        { href: '/dashboard/leads?view=pipeline', icon: Kanban, label: 'Pipeline', show: true },
        { href: '/dashboard/leads', icon: Users, label: 'Kontak & Lead', show: true },
      ]
    },
    {
      label: 'Komunikasi',
      items: [
        { href: '/dashboard/broadcast', icon: Megaphone, label: 'Broadcast', show: isAdminOrSuper },
      ]
    },
    {
      label: 'Insight',
      items: [
        { href: '/dashboard/analytics', icon: Activity, label: 'Analitik', show: true },
        { href: '/dashboard/team', icon: UserCheck, label: 'Tim & Agent', show: isAdminOrSuper },
      ]
    }
  ];

  return (
    <div className={`${collapsed ? 'w-[76px]' : 'w-64'} bg-sidebar h-[calc(100vh-2rem)] m-4 flex flex-col justify-between shrink-0 overflow-hidden transition-all duration-300 ease-out card-elevated z-20`}>
      {/* Logo area */}
      <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar">
        <div className={`h-16 flex items-center ${collapsed ? 'justify-center' : 'px-5'} border-b border-sidebar-border shrink-0`}>
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

        {/* Navigation Grouped */}
        <div className="p-3 space-y-4 flex-1">
          {groups.map((group, gIdx) => {
            const visibleItems = group.items.filter(item => item.show);
            if (visibleItems.length === 0) return null;

            return (
              <div key={gIdx} className="space-y-1">
                {!collapsed && (
                  <h4 className="text-[10px] uppercase font-extrabold text-muted-foreground/60 tracking-wider px-3 mb-1.5 select-none">
                    {group.label}
                  </h4>
                )}
                {visibleItems.map(item => {
                  const active = isActive(item.href.split('?')[0]);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all duration-150 group relative ${
                        active
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'text-sidebar-foreground/75 hover:bg-muted hover:text-sidebar-foreground'
                      } ${collapsed ? 'justify-center' : ''}`}
                    >
                      {/* Active indicator bar */}
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                      )}
                      <item.icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
                      {!collapsed && <span className="font-semibold">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom section */}
      <div className="p-3 border-t border-sidebar-border space-y-3 shrink-0 bg-sidebar">
        {/* User profile card */}
        {user && (
          <div className={`flex items-center gap-3 p-2 rounded-xl bg-muted/40 border border-sidebar-border/30 ${collapsed ? 'justify-center' : ''}`}>
            {user.avatarUrl ? (
              <img 
                src={user.avatarUrl} 
                alt={user.fullName} 
                className="w-8 h-8 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-extrabold text-xs flex items-center justify-center shrink-0">
                {getInitials(user.fullName)}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-sidebar-foreground truncate leading-tight" title={user.fullName}>
                  {user.fullName}
                </p>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
                  {user.role.replace('_', ' ')}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-1">
          {isAdminOrSuper && (
            <Link
              href="/dashboard/settings"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all duration-150 group relative ${
                isActive('/dashboard/settings')
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-sidebar-foreground/75 hover:bg-muted hover:text-sidebar-foreground'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              {isActive('/dashboard/settings') && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
              )}
              <Settings className={`w-4 h-4 shrink-0 ${isActive('/dashboard/settings') ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground'}`} />
              {!collapsed && <span className="font-semibold">Settings</span>}
            </Link>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-[10px] font-bold text-muted-foreground/80 hover:bg-muted hover:text-sidebar-foreground transition-all ${collapsed ? 'justify-center' : ''}`}
          >
            {collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronLeft className="w-4 h-4 shrink-0" />}
            {!collapsed && <span>Collapse Sidebar</span>}
          </button>

          {/* Logout */}
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-destructive/80 hover:bg-destructive/5 hover:text-destructive transition-all ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="font-bold">Logout</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
