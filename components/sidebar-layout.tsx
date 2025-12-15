"use client"

import { Sidebar } from "@/components/sidebar"
import { useState, useEffect, useCallback } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CharacterInfo {
  id: string
  character_id: number
  character_name: string
  is_main: boolean
}

interface SessionData {
  authenticated: boolean
  user?: {
    id: string
    main_character_id: number
    main_character_name: string
    allowed: boolean
  }
  characters?: CharacterInfo[]
}

interface SidebarLayoutProps {
  children: React.ReactNode
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session")
      const data: SessionData = await response.json()
      setSession(data)
    } catch (error) {
      console.error("Failed to fetch session:", error)
      setSession({ authenticated: false })
    }
  }, [])

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setSession({ authenticated: false })
    window.location.href = "/"
  }, [])

  const handleMobileClose = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  // Hydrate on client
  useEffect(() => {
    setHydrated(true)
    fetchSession()
  }, [fetchSession])

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
  if (!hydrated) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="hidden md:block w-64 border-r border-border/40 bg-card/50" />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    )
  }

  const mainCharacter = session?.characters?.find(c => c.is_main) || session?.characters?.[0]

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
        allCharacters={session?.characters || []}
        onLogout={session?.authenticated ? handleLogout : undefined}
        onCharacterChange={fetchSession}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={handleMobileClose}
      />
      
      {/* Main content with top padding on mobile for header bar */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
    </div>
  )
}
