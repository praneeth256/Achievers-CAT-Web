"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Target,
  BookOpen,
  CheckSquare,
  FileText,
  BarChart3,
  Library,
  Trophy,
  ArrowRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Logo from "./Logo";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Daily Targets", href: "/daily", icon: Target },
  { label: "Learn", href: "/learn", icon: BookOpen },
  { label: "Practice", href: "/practice", icon: CheckSquare },
  { label: "Sectional Mocks", href: "/sectional", icon: FileText },
  { label: "Full Mocks", href: "/mocks", icon: BarChart3 },
  { label: "Materials", href: "/materials", icon: Library },
  { label: "My Performance", href: "/performance", icon: Trophy },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${open ? "visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`sidebar ${open ? "open" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}>
        {/* Logo + collapse button */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-border">
          {!collapsed && (
            <Link href="/" onClick={onClose}>
              <Logo />
            </Link>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="sidebar-collapse-btn"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={`sidebar-item ${active ? "active" : ""} ${collapsed ? "sidebar-item-collapsed" : ""}`}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Motivational CTA card — hidden when collapsed */}
        {!collapsed && (
          <div className="sidebar-cta mx-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🏆</span>
              <div>
                <p className="text-[12px] font-bold text-brand-darker leading-tight">Your CAT Success</p>
                <p className="text-[12px] font-bold text-brand-darker leading-tight">Journey Starts Here.</p>
              </div>
            </div>
            <Link
              href="/mocks"
              onClick={onClose}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-darker hover:text-brand-dark"
            >
              Keep Going <ArrowRight size={12} />
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
