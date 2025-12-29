"use client"

import { cn } from "@/lib/utils"

interface ProjectProgressProps {
  progress?: number
  className?: string
}

// Helper function to get colors based on progress thresholds
// Red: 0-50%, Orange: 51-80%, Green: 81-100%
export function getProgressColors(progress: number) {
  if (progress <= 50) {
    return {
      fill: "bg-red-500/25 dark:bg-red-500/35",
      paleFill: "bg-red-500/10 dark:bg-red-500/15",
      verticalBorder: "border-r-red-500 dark:border-r-red-400",
      cardBorder: "border-red-500 dark:border-red-400"
    }
  } else if (progress <= 80) {
    return {
      fill: "bg-orange-500/25 dark:bg-orange-500/35",
      paleFill: "bg-orange-500/10 dark:bg-orange-500/15",
      verticalBorder: "border-r-orange-500 dark:border-r-orange-400",
      cardBorder: "border-orange-500 dark:border-orange-400"
    }
  } else {
    return {
      fill: "bg-green-500/25 dark:bg-green-500/35",
      paleFill: "bg-green-500/10 dark:bg-green-500/15",
      verticalBorder: "border-r-green-500 dark:border-r-green-400",
      cardBorder: "border-green-500 dark:border-green-400"
    }
  }
}

// Get card border class based on progress
export function getProgressCardBorder(progress: number = 0) {
  return getProgressColors(progress).cardBorder
}

export function ProjectProgressOverlay({ progress = 0, className }: ProjectProgressProps) {
  const colors = getProgressColors(progress)
  const fillWidth = Math.min(100, Math.max(0, progress))

  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none rounded-lg overflow-hidden",
        colors.paleFill,
        className
      )}
    >
      <div
        className={cn(
          "h-full transition-all duration-300 ease-out border-r-2",
          colors.fill,
          colors.verticalBorder
        )}
        style={{ width: `${fillWidth}%` }}
      />
    </div>
  )
}

