"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  Loader2, 
  Ship, 
  Plus, 
  RefreshCw, 
  Trash2, 
  AlertCircle,
  Check,
  ChevronLeft,
  AlertTriangle,
  Copy,
  Anchor
} from "lucide-react"
import Link from "next/link"
import type { AllianceFit } from "@/types/fits"

export default function AllianceFitsPage() {
  const [fits, setFits] = useState<AllianceFit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [eftText, setEftText] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)
  const [unresolvedItems, setUnresolvedItems] = useState<string[]>([])
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [selectedFit, setSelectedFit] = useState<AllianceFit | null>(null)

  const fetchFits = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/fits')
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch fits')
      }
      const data = await response.json()
      setFits(data.fits)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch fits')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFits()
  }, [fetchFits])

  const handleCreate = async () => {
    if (!eftText.trim()) {
      setCreateError('Please paste an EFT fit')
      return
    }

    setIsCreating(true)
    setCreateError(null)
    setUnresolvedItems([])

    try {
      const response = await fetch('/api/admin/fits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_eft: eftText }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create fit')
      }

      // Add the new fit to the list
      setFits(prev => [data.fit, ...prev])
      
      // Show unresolved items warning if any
      if (data.unresolved_items && data.unresolved_items.length > 0) {
        setUnresolvedItems(data.unresolved_items)
      }

      // Show success and close dialog
      setSuccessMessage(`Added "${data.fit.fit_name}" for ${data.fit.ship_name}`)
      setTimeout(() => setSuccessMessage(null), 3000)
      
      setShowAddDialog(false)
      setEftText("")
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create fit')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (fitId: string, fitName: string) => {
    if (!confirm(`Are you sure you want to delete "${fitName}"?`)) return

    setDeletingId(fitId)
    setError(null)

    try {
      const response = await fetch(`/api/admin/fits?id=${fitId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete fit')
      }

      setFits(prev => prev.filter(f => f.id !== fitId))
      setSuccessMessage(`Deleted "${fitName}"`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete fit')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCopyEFT = async (rawEft: string) => {
    try {
      await navigator.clipboard.writeText(rawEft)
      setSuccessMessage("Copied to clipboard")
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch {
      setError("Failed to copy to clipboard")
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Count items by slot type
  const getSlotCounts = (fit: AllianceFit) => {
    const counts = { high: 0, mid: 0, low: 0, rig: 0, drone: 0, cargo: 0 }
    for (const item of fit.items) {
      if (item.slot in counts) {
        counts[item.slot as keyof typeof counts] += item.quantity
      }
    }
    return counts
  }

  // Group items by slot type for detail view
  const getItemsBySlot = (fit: AllianceFit) => {
    const grouped: Record<string, typeof fit.items> = {
      high: [],
      mid: [],
      low: [],
      rig: [],
      drone: [],
      cargo: []
    }
    for (const item of fit.items) {
      if (item.slot in grouped) {
        grouped[item.slot].push(item)
      }
    }
    return grouped
  }

  const slotConfig = {
    high: { label: 'High Slots', textColor: 'text-red-400', dotColor: 'bg-red-500' },
    mid: { label: 'Mid Slots', textColor: 'text-blue-400', dotColor: 'bg-blue-500' },
    low: { label: 'Low Slots', textColor: 'text-amber-400', dotColor: 'bg-amber-500' },
    rig: { label: 'Rigs', textColor: 'text-purple-400', dotColor: 'bg-purple-500' },
    drone: { label: 'Drones', textColor: 'text-emerald-400', dotColor: 'bg-emerald-500' },
    cargo: { label: 'Cargo', textColor: 'text-zinc-400', dotColor: 'bg-zinc-500' }
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6 md:space-y-8">
        {/* Header Card */}
        <Card className="bg-gradient-to-r from-card to-card/50 border-cyan-500/20">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-4 sm:p-6">
            <Link 
              href="/admin" 
              className="absolute sm:relative -ml-2 sm:ml-0 p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-5" />
            </Link>
            <div className="size-14 sm:size-16 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ml-6 sm:ml-0">
              <Ship className="size-7 sm:size-8 text-white" />
            </div>
            <div className="flex-1 space-y-1">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Alliance Fits
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Manage alliance ship fittings and doctrine setups
              </p>
              <div className="flex items-center gap-4 pt-1">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Anchor className="size-3.5" />
                  <span className="font-medium text-foreground">{fits.length}</span> fittings
                </span>
              </div>
            </div>
            <div className="flex gap-2 self-end sm:self-auto">
              <Button 
                variant="outline" 
                onClick={fetchFits}
                disabled={isLoading}
              >
                <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-md">
                    <Plus className="size-4 mr-2" />
                    Add Fit
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md">
                        <Ship className="size-5 text-white" />
                      </div>
                      <div>
                        <DialogTitle>Add Alliance Fit</DialogTitle>
                        <DialogDescription>
                          Paste an EFT-formatted ship fitting below
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Textarea
                      placeholder={`[Redeemer, SLYCE Defender BOFF 2023]

Heat Sink II
Heat Sink II
Damage Control II
...`}
                      value={eftText}
                      onChange={(e) => setEftText(e.target.value)}
                      className="min-h-[300px] font-mono text-sm bg-muted/30 border-border/50 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                    />
                    {createError && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        <AlertCircle className="size-4 shrink-0" />
                        {createError}
                      </div>
                    )}
                    {unresolvedItems.length > 0 && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
                        <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">Some items could not be resolved:</p>
                          <ul className="list-disc list-inside mt-1 text-amber-400/80">
                            {unresolvedItems.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreate} 
                      disabled={isCreating}
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Parsing...
                        </>
                      ) : (
                        <>
                          <Plus className="size-4 mr-2" />
                          Add Fit
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Success Message */}
        {successMessage && (
          <Card className="border-emerald-500/50 bg-emerald-500/10">
            <CardContent className="p-4 flex items-center gap-2 text-emerald-400">
              <div className="size-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="size-3" />
              </div>
              {successMessage}
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <Card className="border-red-500/50 bg-red-500/10">
            <CardContent className="p-4 flex items-center gap-2 text-red-400">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </CardContent>
          </Card>
        )}

        {/* Fits Table */}
        <Card className="border-primary/10">
          <CardHeader className="border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md">
                <Anchor className="size-5 text-white" />
              </div>
              <div>
                <CardTitle>Fittings ({fits.length})</CardTitle>
                <CardDescription>
                  Click copy to get the EFT format for in-game import
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="size-8 animate-spin text-cyan-500" />
                  <p className="text-sm text-muted-foreground">Loading fittings...</p>
                </div>
              </div>
            ) : fits.length === 0 ? (
              <div className="text-center py-16">
                <div className="size-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center">
                  <Ship className="size-10 text-cyan-500/50" />
                </div>
                <p className="text-lg font-medium text-muted-foreground">No alliance fits yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Click &quot;Add Fit&quot; to add your first fitting</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left py-3 px-4 md:px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ship</th>
                      <th className="text-left py-3 px-4 md:px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fit Name</th>
                      <th className="text-left py-3 px-4 md:px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Slots</th>
                      <th className="text-left py-3 px-4 md:px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Created</th>
                      <th className="text-right py-3 px-4 md:px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {fits.map(fit => {
                      const slots = getSlotCounts(fit)
                      return (
                        <tr 
                          key={fit.id} 
                          className="hover:bg-muted/20 transition-colors group cursor-pointer"
                          onClick={() => setSelectedFit(fit)}
                        >
                          <td className="py-4 px-4 md:px-6">
                            <div className="flex items-center gap-3 md:gap-4">
                              <img
                                src={`https://images.evetech.net/types/${fit.ship_type_id}/icon?size=64`}
                                alt={fit.ship_name}
                                className="size-10 md:size-12 rounded-lg ring-2 ring-cyan-500/20 shadow-md group-hover:ring-cyan-500/40 transition-all"
                              />
                              <div className="min-w-0">
                                <span className="font-semibold text-sm md:text-base block truncate">{fit.ship_name}</span>
                                <span className="text-xs text-muted-foreground md:hidden">
                                  {formatDate(fit.created_at)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 md:px-6">
                            <span className="text-cyan-400 font-medium">{fit.fit_name}</span>
                            {/* Mobile slots */}
                            <div className="flex gap-1 flex-wrap mt-1 md:hidden">
                              {slots.high > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-400 border-red-500/30">
                                  H:{slots.high}
                                </Badge>
                              )}
                              {slots.mid > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/30">
                                  M:{slots.mid}
                                </Badge>
                              )}
                              {slots.low > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/30">
                                  L:{slots.low}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 md:px-6 hidden md:table-cell">
                            <div className="flex gap-1.5 flex-wrap">
                              {slots.high > 0 && (
                                <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30 shadow-sm">
                                  H:{slots.high}
                                </Badge>
                              )}
                              {slots.mid > 0 && (
                                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-sm">
                                  M:{slots.mid}
                                </Badge>
                              )}
                              {slots.low > 0 && (
                                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-sm">
                                  L:{slots.low}
                                </Badge>
                              )}
                              {slots.rig > 0 && (
                                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30 shadow-sm">
                                  R:{slots.rig}
                                </Badge>
                              )}
                              {slots.drone > 0 && (
                                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm">
                                  D:{slots.drone}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 md:px-6 text-sm text-muted-foreground hidden lg:table-cell">
                            {formatDate(fit.created_at)}
                          </td>
                          <td className="py-4 px-4 md:px-6">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); handleCopyEFT(fit.raw_eft) }}
                                title="Copy EFT"
                                className="size-9 hover:bg-cyan-500/10 hover:text-cyan-400"
                              >
                                <Copy className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); handleDelete(fit.id, fit.fit_name) }}
                                disabled={deletingId === fit.id}
                                className="size-9 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                title="Delete fit"
                              >
                                {deletingId === fit.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fit Detail Modal */}
        <Dialog open={!!selectedFit} onOpenChange={(open) => !open && setSelectedFit(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col data-[state=open]:!slide-in-from-left-0 data-[state=open]:!slide-in-from-top-0 data-[state=closed]:!slide-out-to-left-0 data-[state=closed]:!slide-out-to-top-0">
            {selectedFit && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-4">
                    <img
                      src={`https://images.evetech.net/types/${selectedFit.ship_type_id}/icon?size=64`}
                      alt={selectedFit.ship_name}
                      className="size-14 rounded-lg ring-2 ring-cyan-500/30 shadow-lg"
                    />
                    <div>
                      <DialogTitle className="text-xl">{selectedFit.ship_name}</DialogTitle>
                      <DialogDescription className="text-cyan-400 font-medium">
                        {selectedFit.fit_name}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                  {/* EFT Block */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">EFT Format</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyEFT(selectedFit.raw_eft)}
                        className="text-xs hover:bg-cyan-500/10 hover:text-cyan-400"
                      >
                        <Copy className="size-3 mr-1.5" />
                        Copy
                      </Button>
                    </div>
                    <pre className="text-xs font-mono bg-muted/30 border border-border/50 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap custom-scrollbar">
                      {selectedFit.raw_eft}
                    </pre>
                  </div>

                  {/* Items by Slot */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Items Breakdown</h4>
                    {Object.entries(getItemsBySlot(selectedFit)).map(([slot, items]) => {
                      if (items.length === 0) return null
                      const config = slotConfig[slot as keyof typeof slotConfig]
                      return (
                        <div key={slot} className="space-y-1.5">
                          <div className={`text-xs font-semibold ${config.textColor} flex items-center gap-2`}>
                            <span className={`size-2 rounded-full ${config.dotColor}`}></span>
                            {config.label} ({items.length})
                          </div>
                          <div className="grid gap-1">
                            {items.map((item, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-3 p-2 rounded-md bg-muted/20 hover:bg-muted/30 transition-colors"
                              >
                                {item.type_id && (
                                  <img
                                    src={`https://images.evetech.net/types/${item.type_id}/icon?size=32`}
                                    alt={item.name}
                                    className="size-6 rounded"
                                  />
                                )}
                                <span className="flex-1 text-sm">{item.name}</span>
                                {item.quantity > 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    x{item.quantity}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <DialogFooter className="pt-4 border-t border-border/50">
                  <Button variant="outline" onClick={() => setSelectedFit(null)}>
                    Close
                  </Button>
                  <Button
                    onClick={() => handleCopyEFT(selectedFit.raw_eft)}
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                  >
                    <Copy className="size-4 mr-2" />
                    Copy EFT
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
