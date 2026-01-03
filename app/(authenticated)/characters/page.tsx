"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Loader2,
  Users,
  UserPlus,
  Star,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Crown,
  Wallet,
  BookOpen,
  MapPin,
  Building2,
  CircleDot,
  Clock,
} from "lucide-react"
import { useRouter } from "next/navigation"
import type { ScopeLevel } from "@/types/auth"

interface CharacterData {
  id: string
  character_id: number
  character_name: string
  is_main: boolean
  scope_level: ScopeLevel
  created_at: string
}

interface CharacterDetails {
  character_id: number
  character_name: string
  wallet_balance: number | null
  wallet_balance_formatted: string | null
  total_sp: number | null
  total_sp_formatted: string | null
  unallocated_sp: number | null
  current_training: {
    skill_name: string
    finish_date: string
    time_remaining: string
  } | null
  online: boolean | null
  last_login: string | null
  last_logout: string | null
  solar_system_id: number | null
  solar_system_name: string | null
  corporation_id: number | null
  corporation_name: string | null
  alliance_id: number | null
  alliance_name: string | null
  requires_full_access: boolean
  errors: string[]
}

interface DetailsResponse {
  characters: CharacterDetails[]
  totals: {
    wallet_balance: number
    wallet_balance_formatted: string
    total_sp: number
    total_sp_formatted: string
  }
}

export default function CharactersPage() {
  const router = useRouter()
  const [characters, setCharacters] = useState<CharacterData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  
  // Character details state
  const [details, setDetails] = useState<Map<number, CharacterDetails>>(new Map())
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [totals, setTotals] = useState<DetailsResponse['totals'] | null>(null)
  
  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<CharacterData | null>(null)
  
  // Full access request modal
  const [fullAccessTarget, setFullAccessTarget] = useState<CharacterData | null>(null)

  const fetchCharacters = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/characters")
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to fetch characters")
      }
      const data = await response.json()
      setCharacters(data.characters)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load characters")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchDetails = useCallback(async () => {
    try {
      setDetailsLoading(true)
      const response = await fetch("/api/characters/details")
      if (!response.ok) {
        // Don't throw - details are optional enhancement
        console.error("Failed to fetch character details")
        return
      }
      const data: DetailsResponse = await response.json()
      
      // Convert to map for easy lookup
      const detailsMap = new Map<number, CharacterDetails>()
      for (const char of data.characters) {
        detailsMap.set(char.character_id, char)
      }
      setDetails(detailsMap)
      setTotals(data.totals)
    } catch (err) {
      console.error("Failed to fetch character details:", err)
    } finally {
      setDetailsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCharacters()
  }, [fetchCharacters])

  // Fetch details after characters are loaded
  useEffect(() => {
    if (characters.length > 0) {
      fetchDetails()
    }
  }, [characters.length, fetchDetails])

  const handleSetMain = async (character: CharacterData) => {
    setActionLoading(character.character_id)
    try {
      const response = await fetch(`/api/characters/${character.character_id}/main`, {
        method: "POST",
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to set main character")
      }
      await fetchCharacters()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set main character")
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setActionLoading(deleteTarget.character_id)
    try {
      const response = await fetch("/api/characters", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character_id: deleteTarget.character_id }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to remove character")
      }
      await fetchCharacters()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove character")
    } finally {
      setActionLoading(null)
      setDeleteTarget(null)
    }
  }

  const handleAddAlt = () => {
    router.push("/api/auth/eve/add-alt")
  }

  const handleRequestFullAccess = () => {
    // Navigate to full access request
    router.push("/api/auth/eve/request-full-access")
  }

  const handleRefreshAll = async () => {
    await fetchCharacters()
    await fetchDetails()
  }

  const mainCharacter = characters.find(c => c.is_main)
  const altCharacters = characters.filter(c => !c.is_main)

  // Count by scope level
  const fullAccessCount = characters.filter(c => c.scope_level === "full").length
  const minimalAccessCount = characters.filter(c => c.scope_level === "minimal").length

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
              <Users className="size-7 md:size-8" />
              Characters
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Manage your linked EVE Online characters and permissions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={loading || detailsLoading}>
              <RefreshCw className={`size-4 mr-2 ${(loading || detailsLoading) ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={handleAddAlt}>
              <UserPlus className="size-4 mr-2" />
              Add Character
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="border-red-500/50 bg-red-500/10">
            <CardContent className="py-4">
              <p className="text-red-400 text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="text-2xl font-bold">{characters.length}</div>
              <div className="text-xs text-muted-foreground">Total Characters</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-emerald-400">{fullAccessCount}</div>
              <div className="text-xs text-muted-foreground">Full Access</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-amber-400">{minimalAccessCount}</div>
              <div className="text-xs text-muted-foreground">Limited Access</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-2xl font-bold">{altCharacters.length}</div>
              <div className="text-xs text-muted-foreground">Alt Characters</div>
            </CardContent>
          </Card>
        </div>

        {/* Totals Summary (if we have details) */}
        {totals && (
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardContent className="py-4 flex items-center gap-3">
                <Wallet className="size-5 text-emerald-400" />
                <div>
                  <div className="text-lg font-bold text-emerald-400">{totals.wallet_balance_formatted} ISK</div>
                  <div className="text-xs text-muted-foreground">Total Wallet Balance</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="py-4 flex items-center gap-3">
                <BookOpen className="size-5 text-blue-400" />
                <div>
                  <div className="text-lg font-bold text-blue-400">{totals.total_sp_formatted}</div>
                  <div className="text-xs text-muted-foreground">Total Skill Points</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Character Section */}
        {mainCharacter && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Crown className="size-5 text-amber-400" />
              Main Character
            </h2>
            <CharacterCard
              character={mainCharacter}
              details={details.get(mainCharacter.character_id)}
              detailsLoading={detailsLoading}
              isMain
              actionLoading={actionLoading}
              onSetMain={handleSetMain}
              onDelete={setDeleteTarget}
              onRequestFullAccess={setFullAccessTarget}
            />
          </div>
        )}

        {/* Alt Characters Section */}
        {altCharacters.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="size-5" />
              Alt Characters ({altCharacters.length})
            </h2>
            <div className="grid gap-4">
              {altCharacters.map(character => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  details={details.get(character.character_id)}
                  detailsLoading={detailsLoading}
                  isMain={false}
                  actionLoading={actionLoading}
                  onSetMain={handleSetMain}
                  onDelete={setDeleteTarget}
                  onRequestFullAccess={setFullAccessTarget}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {characters.length === 0 && !loading && (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Characters Linked</h3>
              <p className="text-muted-foreground text-center mb-4 max-w-md">
                Add your EVE Online characters to get started with the application.
              </p>
              <Button onClick={handleAddAlt}>
                <UserPlus className="size-4 mr-2" />
                Add Character
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Permission Legend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Permission Levels</CardTitle>
            <CardDescription>
              Characters can have different ESI permission levels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0">
                <ShieldCheck className="size-3 mr-1" />
                Full Access
              </Badge>
              <p className="text-sm text-muted-foreground">
                All ESI scopes (60+). Required for wallet, orders, assets, undercut checking, and other advanced features.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 shrink-0">
                <ShieldAlert className="size-3 mr-1" />
                Limited Access
              </Badge>
              <p className="text-sm text-muted-foreground">
                Minimal scopes (4). Only structure market access. Upgrade to Full Access to use all features.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Character?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteTarget?.character_name}</strong> from your account?
              This will revoke all ESI access for this character.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Character
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full Access Request Modal */}
      <Dialog open={!!fullAccessTarget} onOpenChange={(open) => !open && setFullAccessTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Full Access</DialogTitle>
            <DialogDescription>
              Upgrade <strong>{fullAccessTarget?.character_name}</strong> to full ESI access?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 text-sm text-muted-foreground">
            <p>
              Full access grants 60+ ESI scopes including wallet, orders, assets, industry jobs, and more.
            </p>
            <p>
              <strong>Important:</strong> Please contact <span className="text-primary">darkislife zhang</span> in-game
              before requesting full access.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFullAccessTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRequestFullAccess}>
              Request Full Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface CharacterCardProps {
  character: CharacterData
  details?: CharacterDetails
  detailsLoading: boolean
  isMain: boolean
  actionLoading: number | null
  onSetMain: (character: CharacterData) => void
  onDelete: (character: CharacterData) => void
  onRequestFullAccess: (character: CharacterData) => void
}

function CharacterCard({
  character,
  details,
  detailsLoading,
  isMain,
  actionLoading,
  onSetMain,
  onDelete,
  onRequestFullAccess,
}: CharacterCardProps) {
  const isLoading = actionLoading === character.character_id
  const isFullAccess = character.scope_level === "full"

  return (
    <Card className={isMain ? "border-amber-500/30 bg-amber-500/5" : ""}>
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          {/* Character Portrait */}
          <div className="relative">
            <img
              src={`https://images.evetech.net/characters/${character.character_id}/portrait?size=64`}
              alt={character.character_name}
              className="size-16 rounded-lg ring-2 ring-border"
            />
            {/* Online indicator */}
            {details && details.online !== null && (
              <div 
                className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-background ${
                  details.online ? 'bg-green-500' : 'bg-gray-500'
                }`}
                title={details.online ? 'Online' : 'Offline'}
              />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Character Name & Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{character.character_name}</h3>
              {isMain && (
                <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                  <Star className="size-3 mr-1" />
                  Main
                </Badge>
              )}
            </div>

            {/* Corporation & Alliance */}
            {details?.corporation_name && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <Building2 className="size-3" />
                <span className="truncate">
                  {details.corporation_name}
                  {details.alliance_name && (
                    <span className="text-xs"> [{details.alliance_name}]</span>
                  )}
                </span>
              </div>
            )}

            {/* Scope Level Badge */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {isFullAccess ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  <ShieldCheck className="size-3 mr-1" />
                  Full Access
                </Badge>
              ) : (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  <ShieldAlert className="size-3 mr-1" />
                  Limited Access
                </Badge>
              )}
            </div>

            {/* Details Grid */}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {/* Wallet */}
              <div className="flex items-center gap-1.5">
                <Wallet className="size-3.5 text-emerald-400" />
                {detailsLoading ? (
                  <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                ) : details?.wallet_balance_formatted ? (
                  <span className="text-emerald-400 font-medium">{details.wallet_balance_formatted}</span>
                ) : isFullAccess ? (
                  <span className="text-muted-foreground">--</span>
                ) : (
                  <span className="text-muted-foreground/50 text-xs">Upgrade</span>
                )}
              </div>

              {/* Skill Points */}
              <div className="flex items-center gap-1.5">
                <BookOpen className="size-3.5 text-blue-400" />
                {detailsLoading ? (
                  <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                ) : details?.total_sp_formatted ? (
                  <span className="text-blue-400 font-medium">{details.total_sp_formatted}</span>
                ) : isFullAccess ? (
                  <span className="text-muted-foreground">--</span>
                ) : (
                  <span className="text-muted-foreground/50 text-xs">Upgrade</span>
                )}
              </div>

              {/* Location */}
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-orange-400" />
                {detailsLoading ? (
                  <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                ) : details?.solar_system_name ? (
                  <span className="text-orange-400 truncate" title={details.solar_system_name}>
                    {details.solar_system_name}
                  </span>
                ) : isFullAccess ? (
                  <span className="text-muted-foreground">--</span>
                ) : (
                  <span className="text-muted-foreground/50 text-xs">Upgrade</span>
                )}
              </div>

              {/* Online Status */}
              <div className="flex items-center gap-1.5">
                <CircleDot className={`size-3.5 ${details?.online ? 'text-green-400' : 'text-gray-400'}`} />
                {detailsLoading ? (
                  <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                ) : details && details.online !== null ? (
                  <span className={details.online ? 'text-green-400' : 'text-gray-400'}>
                    {details.online ? 'Online' : 'Offline'}
                  </span>
                ) : isFullAccess ? (
                  <span className="text-muted-foreground">--</span>
                ) : (
                  <span className="text-muted-foreground/50 text-xs">Upgrade</span>
                )}
              </div>
            </div>

            {/* Current Training */}
            {details?.current_training && (
              <div className="mt-2 flex items-center gap-1.5 text-sm">
                <Clock className="size-3.5 text-purple-400" />
                <span className="text-purple-400">
                  {details.current_training.skill_name}
                </span>
                <span className="text-muted-foreground">
                  - {details.current_training.time_remaining}
                </span>
              </div>
            )}

            {/* Character ID */}
            <p className="text-xs text-muted-foreground mt-2">
              ID: {character.character_id}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {!isMain && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSetMain(character)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Star className="size-4" />
                )}
              </Button>
            )}
            {!isFullAccess && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRequestFullAccess(character)}
                disabled={isLoading}
                className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <Shield className="size-4" />
              </Button>
            )}
            {!isMain && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(character)}
                disabled={isLoading}
                className="text-red-400 border-red-500/30 hover:bg-red-500/10"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
