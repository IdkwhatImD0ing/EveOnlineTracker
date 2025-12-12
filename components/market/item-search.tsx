"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Search, Loader2, Plus } from "lucide-react"
import { EveItemIcon } from "@/components/eve-item-icon"

export interface TradeableItem {
  typeId: number
  name: string
  groupId: number
  groupName: string
  categoryId: number
  categoryName: string
  volume: number
  marketGroupId: number
}

interface ItemSearchProps {
  onSelect: (item: TradeableItem) => void
  placeholder?: string
  disabled?: boolean
  existingTypeIds?: Set<number>
}

export function ItemSearch({ onSelect, placeholder = "Search items...", disabled = false, existingTypeIds }: ItemSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<TradeableItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Search with debounce using API
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    const debounce = setTimeout(async () => {
      try {
        const response = await fetch(`/api/items/search?q=${encodeURIComponent(query)}&limit=30`)
        if (response.ok) {
          const items: TradeableItem[] = await response.json()
          // Filter out existing items client-side
          const filtered = existingTypeIds
            ? items.filter(item => !existingTypeIds.has(item.typeId))
            : items
          setResults(filtered.slice(0, 20))
          setIsOpen(filtered.length > 0)
        }
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setIsLoading(false)
      }
    }, 200)

    return () => clearTimeout(debounce)
  }, [query, existingTypeIds])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = useCallback((item: TradeableItem) => {
    onSelect(item)
    // Remove the just-added item from results immediately
    setResults(prev => {
      const updated = prev.filter(r => r.typeId !== item.typeId)
      // Close dropdown if no more results
      if (updated.length === 0) {
        setIsOpen(false)
      }
      return updated
    })
    // Keep dropdown open and query intact for multi-add
    inputRef.current?.focus()
  }, [onSelect])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="pl-9 pr-9"
          disabled={disabled}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-auto rounded-md border bg-popover shadow-lg">
          {results.map((item) => (
              <button
                key={item.typeId}
                onClick={() => handleSelect(item)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors group"
              >
                <EveItemIcon typeId={item.typeId} size={32} className="size-6 shrink-0 rounded" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{item.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.categoryName} • {item.groupName}
                  </div>
                </div>
                <Plus className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
          ))}
        </div>
      )}

      {query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover p-3 text-center text-sm text-muted-foreground shadow-lg">
          No items found
        </div>
      )}
    </div>
  )
}

