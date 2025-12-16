"use client"

import * as React from "react"
import { MapPin } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { VOLUME_REGIONS, DEFAULT_VOLUME_REGION_ID, type RegionId } from "@/types/market-seeder"

const STORAGE_KEY = "eve-tracker-volume-region"

interface RegionSelectorProps {
  value?: RegionId
  onChange?: (regionId: RegionId) => void
  className?: string
  size?: "sm" | "default"
  showIcon?: boolean
  label?: string
}

/**
 * Get the saved region from localStorage, or return default
 */
export function getSavedVolumeRegion(): RegionId {
  if (typeof window === "undefined") return DEFAULT_VOLUME_REGION_ID
  
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    const parsed = parseInt(saved, 10)
    if (VOLUME_REGIONS.some(r => r.id === parsed)) {
      return parsed as RegionId
    }
  }
  return DEFAULT_VOLUME_REGION_ID
}

/**
 * Save the region to localStorage
 */
export function saveVolumeRegion(regionId: RegionId): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, String(regionId))
}

/**
 * Get region info by ID
 */
export function getRegionInfo(regionId: RegionId) {
  return VOLUME_REGIONS.find(r => r.id === regionId) ?? VOLUME_REGIONS[0]
}

/**
 * Hook to manage volume region state with localStorage persistence
 */
export function useVolumeRegion(initialValue?: RegionId) {
  const [regionId, setRegionId] = React.useState<RegionId>(
    initialValue ?? DEFAULT_VOLUME_REGION_ID
  )
  const [isInitialized, setIsInitialized] = React.useState(false)

  // Load from localStorage on mount
  React.useEffect(() => {
    const saved = getSavedVolumeRegion()
    setRegionId(saved)
    setIsInitialized(true)
  }, [])

  const setAndSaveRegion = React.useCallback((newRegionId: RegionId) => {
    setRegionId(newRegionId)
    saveVolumeRegion(newRegionId)
  }, [])

  return {
    regionId,
    setRegionId: setAndSaveRegion,
    isInitialized,
    regionInfo: getRegionInfo(regionId),
  }
}

/**
 * Region selector dropdown for choosing which region's volume data to use
 */
export function RegionSelector({
  value,
  onChange,
  className,
  size = "default",
  showIcon = true,
  label,
}: RegionSelectorProps) {
  const handleChange = (newValue: string) => {
    const regionId = parseInt(newValue, 10) as RegionId
    onChange?.(regionId)
  }

  const currentRegion = getRegionInfo(value ?? DEFAULT_VOLUME_REGION_ID)

  return (
    <div className={className}>
      {label && (
        <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      )}
      <Select value={String(value ?? DEFAULT_VOLUME_REGION_ID)} onValueChange={handleChange}>
        <SelectTrigger size={size} className="min-w-[140px]">
          <SelectValue>
            <span className="flex items-center gap-2">
              {showIcon && <MapPin className="size-3.5 text-muted-foreground" />}
              <span>{currentRegion.shortName}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {VOLUME_REGIONS.map((region) => (
            <SelectItem key={region.id} value={String(region.id)}>
              <div className="flex flex-col">
                <span className="font-medium">{region.name}</span>
                <span className="text-xs text-muted-foreground">{region.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

