"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Search, Loader2, FlaskConical, Hammer } from "lucide-react"

interface BlueprintResult {
  blueprintTypeId: number
  blueprintName: string
  productTypeId: number
  productName: string
  isReaction: boolean
}

interface BlueprintSearchProps {
  onSelect: (blueprint: BlueprintResult) => void
  selectedBlueprint: BlueprintResult | null
}

export function BlueprintSearch({ onSelect, selectedBlueprint }: BlueprintSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<BlueprintResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const debounce = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/industry/blueprints/search?q=${encodeURIComponent(query)}`)
        if (response.ok) {
          const data = await response.json()
          setResults(data)
          setIsOpen(true)
        }
      } catch (error) {
        console.error("Search failed:", error)
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(debounce)
  }, [query])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (bp: BlueprintResult) => {
    onSelect(bp)
    setQuery("")
    setResults([])
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={selectedBlueprint ? selectedBlueprint.productName : "Search blueprints..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="pl-9 pr-9"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-auto rounded-md border bg-popover shadow-lg">
          {results.map((bp) => (
            <button
              key={bp.blueprintTypeId}
              onClick={() => handleSelect(bp)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors"
            >
              {bp.isReaction ? (
                <FlaskConical className="size-4 text-purple-500 shrink-0" />
              ) : (
                <Hammer className="size-4 text-blue-500 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-medium truncate">{bp.productName}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {bp.blueprintName}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedBlueprint && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-accent/50 px-3 py-2 text-sm">
          {selectedBlueprint.isReaction ? (
            <FlaskConical className="size-4 text-purple-500" />
          ) : (
            <Hammer className="size-4 text-blue-500" />
          )}
          <span className="font-medium">{selectedBlueprint.productName}</span>
          <button
            onClick={() => onSelect(null as unknown as BlueprintResult)}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

