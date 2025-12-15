"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ExternalLink, Clock, ShieldCheck } from "lucide-react"

interface SessionData {
  authenticated: boolean
  user?: {
    id: string
    main_character_id: number
    main_character_name: string
    allowed: boolean
  }
  characters?: {
    id: string
    character_id: number
    character_name: string
    is_main: boolean
  }[]
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const response = await fetch("/api/auth/session")
      const data: SessionData = await response.json()
      setSession(data)
    } catch (error) {
      console.error("Failed to check session:", error)
      setSession({ authenticated: false })
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading spinner while checking session
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  // Not authenticated - show login screen
  if (!session?.authenticated || !session.user) {
    return <LoginScreen />
  }

  // Authenticated but not allowed - show pending approval screen
  if (!session.user.allowed) {
    return <PendingApprovalScreen characterName={session.user.main_character_name} />
  }

  // Authenticated and allowed - show the app
  return <>{children}</>
}

function LoginScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-transparent to-transparent" />

      <Card className="relative w-full max-w-md border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <ShieldCheck className="size-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-zinc-100">
            EVE Online Tracker
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Login with your EVE Online account to access the tracker
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            className="w-full h-12 text-base font-medium"
            onClick={() => window.location.href = "/api/auth/eve/login"}
          >
            <ExternalLink className="size-4 mr-2" />
            Login with EVE SSO
          </Button>
          <p className="text-xs text-center text-zinc-500">
            You&apos;ll be redirected to EVE Online to authorize this application
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function PendingApprovalScreen({ characterName }: { characterName: string }) {
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.reload()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-transparent" />

      <Card className="relative w-full max-w-md border-amber-800/50 bg-zinc-950/80 backdrop-blur-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/30">
            <Clock className="size-8 text-amber-400" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-zinc-100">
            Pending Approval
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Your account is awaiting administrator approval
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
            <p className="text-sm text-zinc-400">Logged in as</p>
            <p className="text-lg font-semibold text-amber-400">{characterName}</p>
          </div>
          
          <p className="text-sm text-zinc-500 text-center">
            Once approved, you&apos;ll have full access to the EVE Online Tracker.
            Please contact an administrator if you need immediate access.
          </p>

          <Button
            variant="outline"
            className="w-full border-zinc-700 hover:bg-zinc-800"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
