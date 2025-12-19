"use client"

import { Sidebar } from "@/components/sidebar"
import { useSession } from "@/components/auth-gate"
import { useState, useEffect, useCallback } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SidebarLayoutProps {
  children: React.ReactNode
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const { session, refreshSession } = useSession()
  const [hydrated, setHydrated] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/"
  }, [])

  const handleMobileClose = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  // Hydrate on client
  useEffect(() => {
    setHydrated(true)
  }, [])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  // Show placeholder during SSR/hydration
  if (!hydrated || !session?.user) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="hidden md:block w-64 border-r border-border/40 bg-card/50" />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    )
  }

  const mainCharacter = session.characters?.find(c => c.is_main) || session.characters?.[0]
  const role = session.user.role

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile Header Bar */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center h-14 px-4 border-b border-border/40 bg-card/95 backdrop-blur-sm md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(true)}
          className="size-10 -ml-2"
        >
          <Menu className="size-5" />
        </Button>
        <div className="flex items-center gap-2 ml-2">
          <div className="size-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <span className="text-white font-bold text-xs">EVE</span>
          </div>
          <span className="font-semibold text-foreground text-sm">Tracker</span>
        </div>
        {mainCharacter && (
          <img
            src={`https://images.evetech.net/characters/${mainCharacter.character_id}/portrait?size=64`}
            alt={mainCharacter.character_name}
            className="size-8 rounded-full ring-2 ring-primary/20 ml-auto"
          />
        )}
      </div>

      <Sidebar
        mainCharacter={mainCharacter || null}
        allCharacters={session.characters || []}
        role={role}
        onLogout={handleLogout}
        onCharacterChange={refreshSession}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={handleMobileClose}
      />
      
      {/* Main content with top padding on mobile for header bar */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
    </div>
  )
}
