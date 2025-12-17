"use client"

import {
  Loader2,
  Package,
  Database,
  Globe,
  BarChart3,
  Check,
  Timer,
} from "lucide-react"
import { type ProgressState } from "@/types/market-seeder"

/**
 * Stage icons for progress indicator
 */
const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  // Analysis stages
  loading: Package,
  market_history: Database,
  structure_orders: Globe,
  jita_prices: Globe,
  analyzing: BarChart3,
  filtering: BarChart3,
  scoring: BarChart3,
  ranking: BarChart3,
  // Depletion stages
  starting: Timer,
  orders: Globe,
  items: Package,
  market: Database,
  sorting: BarChart3,
  summary: BarChart3,
  // Sell order generator stages
  assets: Package,
  structure: Globe,
  jita: Globe,
  vale: Database,
  calculating: BarChart3,
  complete: Check,
  // Capital efficiency stages
  characters: Globe,
  metadata: Package,
  market_data: Database,
}

export { STAGE_ICONS }

interface ProgressBarProps {
  progress: ProgressState
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const StageIcon = STAGE_ICONS[progress.stage] || Loader2

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <StageIcon className={`size-5 ${progress.percent < 100 ? "animate-pulse" : ""} text-primary`} />
        <span className="text-sm font-medium">{progress.message}</span>
        <span className="text-sm text-muted-foreground ml-auto">{progress.percent}%</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  )
}

