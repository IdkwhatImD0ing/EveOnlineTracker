"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { MapPin, Loader2 } from "lucide-react"

interface SolarSystem {
  id: number
  name: string
  security: number
}

interface SystemSearchProps {
  value: string
  onChange: (systemName: string, security: number | null) => void
}

// Security status color coding
function getSecurityColor(security: number): string {
  if (security >= 0.5) return "text-green-500"
  if (security > 0) return "text-amber-500"
  return "text-red-500"
}

function formatSecurity(security: number): string {
  return security.toFixed(1)
}

export function SystemSearch({ value, onChange }: SystemSearchProps) {
  const [systems, setSystems] = useState<SolarSystem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load solar systems on mount
  useEffect(() => {
    async function loadSystems() {
      try {
        const response = await fetch("/solar-systems.json")
        if (response.ok) {
          const data = await response.json()
          setSystems(data)
        }
      } catch (error) {
        console.error("Failed to load solar systems:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadSystems()
  }, [])

  // Filter systems based on query
  const filteredSystems = useMemo(() => {
    if (!query || query.length < 2) return []
    
    const lowerQuery = query.toLowerCase()
    const matches = systems.filter(s => 
      s.name.toLowerCase().includes(lowerQuery)
    )
    
    // Sort: exact matches first, then starts with, then contains
    matches.sort((a, b) => {
      const aLower = a.name.toLowerCase()
      const bLower = b.name.toLowerCase()
      const aExact = aLower === lowerQuery
      const bExact = bLower === lowerQuery
      const aStarts = aLower.startsWith(lowerQuery)
      const bStarts = bLower.startsWith(lowerQuery)
      
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      return a.name.localeCompare(b.name)
    })
    
    return matches.slice(0, 50) // Limit to 50 results
  }, [query, systems])

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (system: SolarSystem) => {
    setQuery(system.name)
    onChange(system.name, system.security)
    setIsOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setQuery(newValue)
    // Try to find matching system for security
    const matchingSystem = systems.find(s => s.name.toLowerCase() === newValue.toLowerCase())
    onChange(newValue, matchingSystem?.security ?? null)
    setIsOpen(true)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={isLoading ? "Loading systems..." : "Search system..."}
          value={query}
          onChange={handleInputChange}
          onFocus={() => filteredSystems.length > 0 && setIsOpen(true)}
          className="pl-9"
          disabled={isLoading}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && filteredSystems.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-md border bg-popover shadow-lg">
          {filteredSystems.map((system) => (
            <button
              key={system.id}
              onClick={() => handleSelect(system)}
              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent transition-colors"
            >
              <span className="font-medium">{system.name}</span>
              <span className={`text-sm tabular-nums ${getSecurityColor(system.security)}`}>
                {formatSecurity(system.security)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

