"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Home,
  Package,
  Calculator,
  TrendingUp,
  KeyRound,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
} from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: Home,
    description: "Overview and account info",
  },
  {
    title: "Market Seeder",
    href: "/market-seeder",
    icon: ShoppingCart,
    description: "Find profitable imports",
  },
  {
    title: "Jita Opportunities",
    href: "/jita-opportunities",
    icon: TrendingUp,
    description: "Sell + market opportunities",
  },
  {
    title: "Projects",
    href: "/projects",
    icon: Package,
    description: "Manufacturing tracker",
  },
  {
    title: "Industry",
    href: "/industry",
    icon: Calculator,
    description: "Blueprint calculator",
  },
  {
    title: "EVE SSO",
    href: "/callback",
    icon: KeyRound,
    description: "Login & API tokens",
  },
]

interface SidebarProps {
  characterName?: string | null
  characterId?: number | null
  onLogout?: () => void
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ 
  characterName, 
  characterId, 
  onLogout,
  isMobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Load collapsed state from localStorage (desktop only)
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved !== null) {
      setCollapsed(saved === "true")
    }
  }, [])

  // Save collapsed state (desktop only)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("sidebar-collapsed", String(collapsed))
    }
  }, [collapsed, mounted])

  // Close mobile menu on navigation
  useEffect(() => {
    if (isMobileOpen && onMobileClose) {
      onMobileClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href)
  }

  const handleNavClick = () => {
    if (onMobileClose) {
      onMobileClose()
    }
  }

  // Desktop sidebar (hidden on mobile)
  const desktopSidebar = (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-border/40 bg-card/50 backdrop-blur-sm transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-border/40 px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">EVE</span>
            </div>
            <span className="font-semibold text-foreground">Tracker</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("size-8", collapsed && "mx-auto")}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </div>

      {/* Character Info */}
      {characterName && characterId && (
        <div
          className={cn(
            "border-b border-border/40 p-4",
            collapsed && "flex flex-col items-center gap-2"
          )}
        >
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <img
              src={`https://images.evetech.net/characters/${characterId}/portrait?size=64`}
              alt={characterName}
              className="size-10 rounded-full ring-2 ring-primary/20"
            />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{characterName}</p>
                <p className="text-xs text-muted-foreground">Logged in</p>
              </div>
            )}
          </div>
          {onLogout && (
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              onClick={onLogout}
              className={cn(
                "text-muted-foreground hover:text-destructive",
                collapsed ? "size-8" : "w-full mt-2"
              )}
              title="Logout"
            >
              <LogOut className="size-4" />
              {!collapsed && <span className="ml-2">Logout</span>}
            </Button>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.title : undefined}
            >
              <item.icon className={cn("size-5 shrink-0", active && "text-primary")} />
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{item.title}</span>
                  {item.description && (
                    <span className="block text-xs text-muted-foreground truncate">
                      {item.description}
                    </span>
                  )}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-border/40 p-4">
          <p className="text-xs text-muted-foreground text-center">
            EVE Online Tracker
          </p>
        </div>
      )}
    </aside>
  )

  // Mobile sidebar overlay
  const mobileSidebar = (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity md:hidden",
          isMobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onMobileClose}
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-card border-r border-border/40 transition-transform duration-300 ease-out md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border/40 px-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">EVE</span>
            </div>
            <span className="font-semibold text-foreground">Tracker</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileClose}
            className="size-10"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Character Info */}
        {characterName && characterId && (
          <div className="border-b border-border/40 p-4">
            <div className="flex items-center gap-3">
              <img
                src={`https://images.evetech.net/characters/${characterId}/portrait?size=64`}
                alt={characterName}
                className="size-12 rounded-full ring-2 ring-primary/20"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{characterName}</p>
                <p className="text-xs text-muted-foreground">Logged in</p>
              </div>
            </div>
            {onLogout && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="w-full mt-3 text-muted-foreground hover:text-destructive"
              >
                <LogOut className="size-4 mr-2" />
                Logout
              </Button>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("size-5 shrink-0", active && "text-primary")} />
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{item.title}</span>
                  {item.description && (
                    <span className="block text-xs text-muted-foreground truncate">
                      {item.description}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/40 p-4">
          <p className="text-xs text-muted-foreground text-center">
            EVE Online Tracker
          </p>
        </div>
      </aside>
    </>
  )

  return (
    <>
      {desktopSidebar}
      {mobileSidebar}
    </>
  )
}
