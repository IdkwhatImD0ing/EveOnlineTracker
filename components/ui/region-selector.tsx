"use client"

import * as React from "react"
import { MapPin, Percent } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  VOLUME_REGIONS, 
  DEFAULT_VOLUME_REGION_ID, 
  type RegionId,
  HUB_FACTOR_PRESETS,
  DEFAULT_HUB_FACTOR,
  type HubFactorValue,
} from "@/types/market-seeder"

const REGION_STORAGE_KEY = "eve-tracker-volume-region"
const HUB_FACTOR_STORAGE_KEY = "eve-tracker-hub-factor"

// Keep old key for backwards compatibility
const STORAGE_KEY = REGION_STORAGE_KEY

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

// ============================================================================
// Hub Factor Selector
// ============================================================================

/**
 * Get the saved hub factor from localStorage, or return default
 */
export function getSavedHubFactor(): number {
  if (typeof window === "undefined") return DEFAULT_HUB_FACTOR
  
  const saved = localStorage.getItem(HUB_FACTOR_STORAGE_KEY)
  if (saved) {
    const parsed = parseFloat(saved)
    if (HUB_FACTOR_PRESETS.some(p => p.value === parsed)) {
      return parsed
    }
  }
  return DEFAULT_HUB_FACTOR
}

/**
 * Save the hub factor to localStorage
 */
export function saveHubFactor(hubFactor: number): void {
  if (typeof window === "undefined") return
  localStorage.setItem(HUB_FACTOR_STORAGE_KEY, String(hubFactor))
}

/**
 * Get hub factor preset info by value
 */
export function getHubFactorInfo(hubFactor: number) {
  return HUB_FACTOR_PRESETS.find(p => p.value === hubFactor) ?? HUB_FACTOR_PRESETS[2] // Default to 5%
}

/**
 * Format hub factor as percentage string
 */
export function formatHubFactorPercent(hubFactor: number): string {
  return `${(hubFactor * 100).toFixed(0)}%`
}

/**
 * Hook to manage hub factor state with localStorage persistence
 */
export function useHubFactor(initialValue?: number) {
  const [hubFactor, setHubFactor] = React.useState<number>(
    initialValue ?? DEFAULT_HUB_FACTOR
  )
  const [isInitialized, setIsInitialized] = React.useState(false)

  // Load from localStorage on mount
  React.useEffect(() => {
    const saved = getSavedHubFactor()
    setHubFactor(saved)
    setIsInitialized(true)
  }, [])

  const setAndSaveHubFactor = React.useCallback((newHubFactor: number) => {
    setHubFactor(newHubFactor)
    saveHubFactor(newHubFactor)
  }, [])

  return {
    hubFactor,
    setHubFactor: setAndSaveHubFactor,
    isInitialized,
    hubFactorInfo: getHubFactorInfo(hubFactor),
    hubFactorPercent: formatHubFactorPercent(hubFactor),
  }
}

interface HubFactorSelectorProps {
  value?: number
  onChange?: (hubFactor: number) => void
  className?: string
  size?: "sm" | "default"
  showIcon?: boolean
  label?: string
}

/**
 * Hub factor selector dropdown for choosing what percentage of regional volume to use
 */
export function HubFactorSelector({
  value,
  onChange,
  className,
  size = "default",
  showIcon = true,
  label,
}: HubFactorSelectorProps) {
  const handleChange = (newValue: string) => {
    const hubFactor = parseFloat(newValue)
    onChange?.(hubFactor)
  }

  const currentHubFactor = getHubFactorInfo(value ?? DEFAULT_HUB_FACTOR)

  return (
    <div className={className}>
      {label && (
        <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      )}
      <Select value={String(value ?? DEFAULT_HUB_FACTOR)} onValueChange={handleChange}>
        <SelectTrigger size={size} className="min-w-[100px]">
          <SelectValue>
            <span className="flex items-center gap-2">
              {showIcon && <Percent className="size-3.5 text-muted-foreground" />}
              <span>{currentHubFactor.label}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {HUB_FACTOR_PRESETS.map((preset) => (
            <SelectItem key={preset.value} value={String(preset.value)}>
              <div className="flex flex-col">
                <span className="font-medium">{preset.label}</span>
                <span className="text-xs text-muted-foreground">{preset.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ============================================================================
// Combined Volume Settings Selector
// ============================================================================

interface VolumeSettingsSelectorProps {
  regionId?: RegionId
  hubFactor?: number
  onRegionChange?: (regionId: RegionId) => void
  onHubFactorChange?: (hubFactor: number) => void
  className?: string
  size?: "sm" | "default"
}

/**
 * Combined selector for both region and hub factor percentage
 */
export function VolumeSettingsSelector({
  regionId,
  hubFactor,
  onRegionChange,
  onHubFactorChange,
  className,
  size = "default",
}: VolumeSettingsSelectorProps) {
  return (
    <div className={`flex items-end gap-2 ${className ?? ''}`}>
      <RegionSelector
        value={regionId}
        onChange={onRegionChange}
        size={size}
        label="Volume Region"
      />
      <HubFactorSelector
        value={hubFactor}
        onChange={onHubFactorChange}
        size={size}
        label="Hub Factor"
      />
    </div>
  )
}

