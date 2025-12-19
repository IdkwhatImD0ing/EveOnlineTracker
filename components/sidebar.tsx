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
  UserPlus,
  Star,
  Trash2,
  Users,
  Shield,
} from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UserRole } from "@/types/auth"
import { canAccessNav } from "@/lib/permissions"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
}

const allNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: Home,
    description: "Overview and account info",
  },
  {
    title: "Fit Availability",
    href: "/public-market-seeding",
    icon: Package,
    description: "Check fit stock at 3T7",
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
    title: "API Explorer",
    href: "/callback",
    icon: KeyRound,
    description: "Debug ESI endpoints",
  },
  {
    title: "Admin",
    href: "/admin",
    icon: Shield,
    description: "User management",
  },
]

interface CharacterInfo {
  id: string
  character_id: number
  character_name: string
  is_main: boolean
}

interface SidebarProps {
  mainCharacter: CharacterInfo | null
  allCharacters: CharacterInfo[]
  role: UserRole
  onLogout?: () => void
  onCharacterChange?: () => void
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ 
  mainCharacter, 
  allCharacters,
  role,
  onLogout,
  onCharacterChange,
  isMobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Filter nav items based on user role
  const navItems = useMemo(() => {
    return allNavItems.filter(item => canAccessNav(role, item.href))
  }, [role])

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

  const handleAddAlt = () => {
    window.location.href = "/api/auth/eve/add-alt"
  }

  const handleSetMain = async (characterId: number) => {
    try {
      const response = await fetch(`/api/characters/${characterId}/main`, {
        method: "POST",
      })
      if (response.ok && onCharacterChange) {
        onCharacterChange()
      }
    } catch (error) {
      console.error("Failed to set main character:", error)
    }
  }

  const handleRemoveCharacter = async (characterId: number) => {
    if (!confirm("Are you sure you want to remove this character?")) return
    
    try {
      const response = await fetch("/api/characters", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character_id: characterId }),
      })
      if (response.ok && onCharacterChange) {
        onCharacterChange()
      }
    } catch (error) {
      console.error("Failed to remove character:", error)
    }
  }

  const characterCount = allCharacters.length

  // Character section component
  const CharacterSection = ({ isCollapsed = false }: { isCollapsed?: boolean }) => {
    if (!mainCharacter) return null

    return (
      <div
        className={cn(
          "border-b border-border/40 p-4",
          isCollapsed && "flex flex-col items-center gap-2"
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-3 w-full text-left rounded-lg p-1 -m-1 hover:bg-accent/50 transition-colors",
                isCollapsed && "justify-center"
              )}
            >
              <div className="relative">
                <img
                  src={`https://images.evetech.net/characters/${mainCharacter.character_id}/portrait?size=64`}
                  alt={mainCharacter.character_name}
                  className="size-10 rounded-full ring-2 ring-primary/20"
                />
                {characterCount > 1 && (
                  <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {characterCount}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{mainCharacter.character_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {characterCount > 1 ? `${characterCount} characters` : "1 character"}
                  </p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="flex items-center gap-2">
              <Users className="size-4" />
              Your Characters
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allCharacters.map((char) => (
              <DropdownMenuItem
                key={char.character_id}
                className="flex items-center gap-3 p-2"
                onSelect={(e) => e.preventDefault()}
              >
                <img
                  src={`https://images.evetech.net/characters/${char.character_id}/portrait?size=32`}
                  alt={char.character_name}
                  className="size-8 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{char.character_name}</p>
                  {char.is_main && (
                    <p className="text-xs text-primary flex items-center gap-1">
                      <Star className="size-3 fill-primary" /> Main
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  {!char.is_main && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => handleSetMain(char.character_id)}
                        title="Set as main"
                      >
                        <Star className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveCharacter(char.character_id)}
                        title="Remove character"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleAddAlt} className="gap-2">
              <UserPlus className="size-4" />
              Add Alt Character
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {onLogout && (
          <Button
            variant="ghost"
            size={isCollapsed ? "icon" : "sm"}
            onClick={onLogout}
            className={cn(
              "text-muted-foreground hover:text-destructive",
              isCollapsed ? "size-8" : "w-full mt-2"
            )}
            title="Logout"
          >
            <LogOut className="size-4" />
            {!isCollapsed && <span className="ml-2">Logout</span>}
          </Button>
        )}
      </div>
    )
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
      <CharacterSection isCollapsed={collapsed} />

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
        <CharacterSection isCollapsed={false} />

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
