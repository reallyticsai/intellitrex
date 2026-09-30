"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ChevronDown, Crown, LayoutDashboard, LogOut, Search, Settings, Sparkles, TrendingUp, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/currency", label: "Markets", icon: BarChart3 },
  { href: "/consultancy", label: "AI advisor", icon: Sparkles },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, isLoggedIn, isPremium, isAdmin, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="terminal-nav-shell">
      <nav className="terminal-nav" aria-label="Primary navigation">
        <Link href="/" className="terminal-brand" aria-label="Intellitrex overview">
          <span className="brand-mark"><TrendingUp className="h-4 w-4" /></span>
          <span className="brand-wordmark">INTELLITREX</span>
          <span className="brand-divider" />
          <span className="brand-product">MARKET DESK</span>
        </Link>

        <div className="terminal-nav-links">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (
              <Link key={link.href} href={link.href} className={cn("terminal-nav-link", active && "active")}>
                <Icon className="h-3.5 w-3.5" /> {link.label}
              </Link>
            );
          })}
        </div>

        <div className="terminal-nav-actions">
          <Link href="/currency" className="nav-search-link"><Search className="h-3.5 w-3.5" /><span>Search markets</span><kbd>/</kbd></Link>
          {isPremium && <span className="premium-chip"><Crown className="h-3 w-3" /> Premium</span>}
          <div className="profile-menu" ref={dropdownRef}>
            <button className="profile-trigger" onClick={() => setDropdownOpen((open) => !open)} aria-expanded={dropdownOpen} aria-label="Open account menu">
              {isLoggedIn && user?.name ? <span className="profile-initial">{user.name.slice(0, 1).toUpperCase()}</span> : <User className="h-4 w-4" />}
              <ChevronDown className="h-3 w-3" />
            </button>
            {dropdownOpen && <div className="profile-dropdown">
              {isLoggedIn ? <>
                <div className="profile-dropdown-heading"><b>{user?.name}</b><span>{user?.email}</span></div>
                <Link href="/profile" onClick={() => setDropdownOpen(false)}><User className="h-4 w-4" /> Profile</Link>
                {isAdmin && <Link href="/admin" onClick={() => setDropdownOpen(false)}><Settings className="h-4 w-4" /> Admin panel</Link>}
                <button onClick={() => { signOut(); setDropdownOpen(false); }}><LogOut className="h-4 w-4" /> Sign out</button>
              </> : <>
                <Link href="/profile" onClick={() => setDropdownOpen(false)}><User className="h-4 w-4" /> Sign in / Profile</Link>
                <Link href="/admin" onClick={() => setDropdownOpen(false)}><Settings className="h-4 w-4" /> Admin</Link>
              </>}
            </div>}
          </div>
        </div>
      </nav>
    </header>
  );
}
