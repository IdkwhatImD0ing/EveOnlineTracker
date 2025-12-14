"use client"

import { Sidebar } from "@/components/sidebar"
import { useState, useEffect, useCallback } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CharacterInfo {
  character_id: number
  character_name: string
}

// Parse JWT to get character info
function parseJWT(token: string): CharacterInfo | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const payload = JSON.parse(jsonPayload)
    const characterId = parseInt(payload.sub.split(':')[2])
    return {
      character_id: characterId,
      character_name: payload.name,
    }
  } catch {
    return null
  }
}

// Get initial character info from localStorage
function getInitialCharacterInfo(): CharacterInfo | null {
  if (typeof window === "undefined") return null
  
  try {
    const storedTokens = localStorage.getItem("eve_sso_tokens")
    if (storedTokens) {
      const tokens = JSON.parse(storedTokens)
      if (tokens.access_token) {
        return parseJWT(tokens.access_token)
      }
    }
  } catch {
    // Invalid JSON or SSR
  }
  return null
}

interface SidebarLayoutProps {
  children: React.ReactNode
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const [characterInfo, setCharacterInfo] = useState<CharacterInfo | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = useCallback(() => {
    localStorage.removeItem("eve_sso_tokens")
    setCharacterInfo(null)
    window.location.href = "/"
  }, [])

  const handleMobileClose = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  // Hydrate on client
  useEffect(() => {
    setHydrated(true)
    setCharacterInfo(getInitialCharacterInfo())
  }, [])

  // Listen for storage changes (e.g., login in another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "eve_sso_tokens") {
        setCharacterInfo(getInitialCharacterInfo())
      }
    }
    
    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
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
  if (!hydrated) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="hidden md:block w-64 border-r border-border/40 bg-card/50" />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    )
  }

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
        {characterInfo && (
          <img
            src={`https://images.evetech.net/characters/${characterInfo.character_id}/portrait?size=64`}
            alt={characterInfo.character_name}
            className="size-8 rounded-full ring-2 ring-primary/20 ml-auto"
          />
        )}
      </div>

      <Sidebar
        characterName={characterInfo?.character_name}
        characterId={characterInfo?.character_id}
        onLogout={characterInfo ? handleLogout : undefined}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={handleMobileClose}
      />
      
      {/* Main content with top padding on mobile for header bar */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
    </div>
  )
}
