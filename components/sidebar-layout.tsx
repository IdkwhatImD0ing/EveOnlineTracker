"use client"

import { Sidebar } from "@/components/sidebar"
import { useState, useEffect, useCallback } from "react"

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

  const handleLogout = useCallback(() => {
    localStorage.removeItem("eve_sso_tokens")
    setCharacterInfo(null)
    window.location.href = "/"
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

  // Show placeholder during SSR/hydration
  if (!hydrated) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="w-64 border-r border-border/40 bg-card/50" />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        characterName={characterInfo?.character_name}
        characterId={characterInfo?.character_id}
        onLogout={characterInfo ? handleLogout : undefined}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
