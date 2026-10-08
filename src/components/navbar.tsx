"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Moon, User, Crown, LogOut, Settings, Menu, X } from "lucide-react";
import { useTheme } from "./theme-provider";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/currency", label: "Currency" },
  { href: "/consultancy", label: "Consultancy" },
];

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { user, isLoggedIn, isPremium, isAdmin, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (dropdownOpen) profileButtonRef.current?.focus();
      else if (mobileMenuOpen) menuButtonRef.current?.focus();
      setDropdownOpen(false);
      setMobileMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen, mobileMenuOpen]);

  return (
    <nav ref={navRef} aria-label="Main navigation" className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-4 [&_a]:focus-visible:outline-primary [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-primary">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">*</span>
          </div>
          <span className="font-semibold text-lg text-foreground">Intellitrex</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={cn(
                "text-sm font-medium transition-colors",
                pathname === link.href
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1 sm:gap-3">
          {isPremium && (
            <span className="flex items-center gap-1 px-1.5 py-1 sm:px-2.5 bg-yellow-500/10 text-yellow-600 rounded-full text-xs font-medium">
              <Crown className="w-3 h-3" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Premium</span>
            </span>
          )}
          <button
            onClick={toggle}
            type="button"
            className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-muted"
            aria-label="Toggle theme"
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Sun className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {/* Profile button with dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              ref={profileButtonRef}
              type="button"
              aria-label="Account menu"
              aria-expanded={dropdownOpen}
              aria-controls="account-menu"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex size-11 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted"
            >
              {isLoggedIn && user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full" />
              ) : (
                <User className="w-5 h-5 text-muted-foreground mx-0.5" />
              )}
            </button>

            {dropdownOpen && (
              <div id="account-menu" className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50">
                {isLoggedIn ? (
                  <>
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <User className="w-4 h-4" /> Profile
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <Settings className="w-4 h-4" /> Admin Panel
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        signOut();
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <User className="w-4 h-4" /> Sign In
                    </Link>
                    <Link
                      href="/admin"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <Settings className="w-4 h-4" /> Admin
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted md:hidden"
          >
            {mobileMenuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div id="mobile-navigation" className="border-t border-border px-4 py-2 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
              className={cn("block rounded-lg px-3 py-3 text-sm font-medium transition-colors", pathname === link.href ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
