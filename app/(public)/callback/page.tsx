"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, AlertCircle, UserPlus } from "lucide-react"

type CallbackStatus = "loading" | "success" | "error" | "add_alt_success"

interface CallbackResult {
  success?: boolean
  mode?: "login" | "add_alt"
  user?: {
    id: string
    main_character_name: string
    allowed: boolean
  }
  character?: {
    character_id: number
    character_name: string
  }
  is_new?: boolean
  error?: string
}

function LoadingCard() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-transparent to-transparent" />
      <Card className="relative w-full max-w-md border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="size-12 animate-spin text-blue-400 mb-4" />
          <p className="text-zinc-300 text-lg">Loading...</p>
        </CardContent>
      </Card>
    </div>
  )
}

function CallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<CallbackStatus>("loading")
  const [result, setResult] = useState<CallbackResult | null>(null)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const errorParam = searchParams.get("error")
    const errorDescription = searchParams.get("error_description")

    if (errorParam) {
      setError(errorDescription || errorParam)
      setStatus("error")
      return
    }

    if (!code) {
      // No code, redirect to home
      router.push("/")
      return
    }

    async function exchangeTokens() {
      try {
        const response = await fetch("/api/auth/eve/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        })

        const data: CallbackResult = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to complete authentication")
        }

        setResult(data)

        if (data.mode === "add_alt") {
          setStatus("add_alt_success")
        } else {
          setStatus("success")
          // Redirect after short delay to show success
          setTimeout(() => {
            router.push("/")
          }, 1500)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred")
        setStatus("error")
      }
    }

    exchangeTokens()
  }, [searchParams, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-transparent to-transparent" />

      {status === "loading" && (
        <Card className="relative w-full max-w-md border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="size-12 animate-spin text-blue-400 mb-4" />
            <p className="text-zinc-300 text-lg">Authenticating...</p>
            <p className="text-zinc-500 text-sm mt-2">Exchanging authorization code</p>
          </CardContent>
        </Card>
      )}

      {status === "error" && (
        <Card className="relative w-full max-w-md border-red-800/50 bg-zinc-950/80 backdrop-blur-sm">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/30">
              <AlertCircle className="size-8 text-red-400" />
            </div>
            <CardTitle className="text-xl font-bold text-zinc-100">
              Authentication Failed
            </CardTitle>
            <CardDescription className="text-red-400">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="border-zinc-700"
            >
              Return Home
            </Button>
          </CardContent>
        </Card>
      )}

      {status === "success" && result && (
        <Card className="relative w-full max-w-md border-emerald-800/50 bg-zinc-950/80 backdrop-blur-sm">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
              <CheckCircle className="size-8 text-emerald-400" />
            </div>
            <CardTitle className="text-xl font-bold text-zinc-100">
              {result.is_new ? "Account Created!" : "Welcome Back!"}
            </CardTitle>
            <CardDescription className="text-emerald-400">
              Logged in as {result.user?.main_character_name}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Loader2 className="size-5 animate-spin text-zinc-500" />
            <p className="text-zinc-500 text-sm">Redirecting to dashboard...</p>
          </CardContent>
        </Card>
      )}

      {status === "add_alt_success" && result && (
        <Card className="relative w-full max-w-md border-blue-800/50 bg-zinc-950/80 backdrop-blur-sm">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-blue-500/10 ring-1 ring-blue-500/30">
              <UserPlus className="size-8 text-blue-400" />
            </div>
            <CardTitle className="text-xl font-bold text-zinc-100">
              Alt Character Added!
            </CardTitle>
            <CardDescription className="text-blue-400">
              {result.character?.character_name} has been linked to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button
              onClick={() => router.push("/")}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <CallbackContent />
    </Suspense>
  )
}
