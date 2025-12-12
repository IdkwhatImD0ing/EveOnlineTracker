"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle, AlertCircle, Copy, Check, Play, ChevronDown, ChevronRight } from "lucide-react"

interface TokenData {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

interface CharacterInfo {
  character_id: number
  character_name: string
}

interface ApiResponse {
  status: number
  statusText: string
  body: unknown
  duration: number
}

interface RouteConfig {
  id: string
  method: "GET" | "POST" | "PUT" | "DELETE"
  path: string
  title: string
  description: string
  requiresAuth: boolean
  parameters?: {
    name: string
    type: string
    description: string
    default?: string
    required?: boolean
  }[]
}

// Parse JWT to get character info
function parseJWT(token: string): CharacterInfo | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const payload = JSON.parse(jsonPayload)
    const characterId = parseInt(payload.sub.split(':')[2])
    return {
      character_id: characterId,
      character_name: payload.name,
    }
  } catch {
    return null
  }
}

const METHOD_COLORS = {
  GET: "bg-emerald-600",
  POST: "bg-blue-600",
  PUT: "bg-amber-600",
  DELETE: "bg-red-600",
}

export default function CallbackPage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error" | "idle">("idle")
  const [tokens, setTokens] = useState<TokenData | null>(null)
  const [error, setError] = useState<string>("")
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [characterInfo, setCharacterInfo] = useState<CharacterInfo | null>(null)
  
  // Route states
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null)
  const [routeParams, setRouteParams] = useState<Record<string, Record<string, string>>>({})
  const [routeResponses, setRouteResponses] = useState<Record<string, ApiResponse>>({})
  const [loadingRoute, setLoadingRoute] = useState<string | null>(null)

  // Define routes
  const routes: RouteConfig[] = [
    {
      id: "market-history-raw",
      method: "GET",
      path: "/api/esi/market-history-raw",
      title: "Raw Market History (Debug)",
      description: "Fetches raw market history for an item in a region directly from ESI. Does NOT store to database - pure debugging tool. Useful for testing if items have trade data in specific regions like Vale of the Silent.",
      requiresAuth: false,
      parameters: [
        { name: "type_id", type: "integer", description: "Item type ID (e.g., 45610 for Legion subsystem)", default: "", required: true },
        { name: "region_id", type: "integer", description: "Region ID (10000002=Jita, 10000003=Vale, 10000043=Amarr)", default: "10000002", required: false },
        { name: "days", type: "integer", description: "Number of recent days to return", default: "30", required: false },
      ],
    },
    {
      id: "keepstar-3t7",
      method: "GET",
      path: "/api/esi/keepstar-3t7",
      title: "Get Keepstar Structure ID in 3T7-M8",
      description: "Searches for structures and returns any Keepstar in 3T7-M8 (structure_id: 1051567430261). Requires esi-search.search_structures.v1 and esi-universe.read_structures.v1 scopes.",
      requiresAuth: true,
      parameters: [
        { name: "character_id", type: "integer", description: "Your character ID", default: "", required: true },
        { name: "search", type: "string", description: "Search term (min 3 chars)", default: "3T7-M8", required: true },
      ],
    },
    {
      id: "structure-orders",
      method: "GET",
      path: "/api/esi/structure-orders",
      title: "Top 5 Most Expensive Items in Structure",
      description: "Fetches all market orders from a structure and returns the top 5 most expensive items. Requires esi-markets.structure_markets.v1 scope.",
      requiresAuth: true,
      parameters: [
        { name: "structure_id", type: "integer", description: "Structure ID (e.g., 1051567430261 for 3T7 Keepstar)", default: "", required: true },
        { name: "buy_orders", type: "boolean", description: "Set to 'true' for buy orders, default is sell orders", default: "false", required: false },
      ],
    },
  ]

  useEffect(() => {
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const errorParam = searchParams.get("error")
    const errorDescription = searchParams.get("error_description")

    // Check for saved tokens first
    const savedTokens = localStorage.getItem("eve_sso_tokens")
    if (savedTokens) {
      try {
        const parsed = JSON.parse(savedTokens) as TokenData
        setTokens(parsed)
        setStatus("success")
        const charInfo = parseJWT(parsed.access_token)
        if (charInfo) {
          setCharacterInfo(charInfo)
          // Initialize character_id params
          initializeCharacterParams(charInfo.character_id)
        }
        if (code) {
          window.history.replaceState({}, "", "/callback")
        }
        return
      } catch {
        localStorage.removeItem("eve_sso_tokens")
      }
    }

    if (!code && !errorParam) {
      setStatus("idle")
      return
    }

    if (errorParam) {
      setError(errorDescription || errorParam)
      setStatus("error")
      return
    }

    if (!code) {
      setStatus("idle")
      return
    }

    setStatus("loading")

    async function exchangeTokens() {
      try {
        const response = await fetch("/api/auth/eve/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to exchange tokens")
        }

        localStorage.setItem("eve_sso_tokens", JSON.stringify(data))
        setTokens(data)
        setStatus("success")
        window.history.replaceState({}, "", "/callback")
        
        const charInfo = parseJWT(data.access_token)
        if (charInfo) {
          setCharacterInfo(charInfo)
          initializeCharacterParams(charInfo.character_id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred")
        setStatus("error")
      }
    }

    exchangeTokens()
  }, [searchParams])

  const initializeCharacterParams = (characterId: number) => {
    const charRoutes = ["keepstar-3t7"]
    const newParams: Record<string, Record<string, string>> = {}
    charRoutes.forEach(routeId => {
      newParams[routeId] = { character_id: characterId.toString() }
    })
    setRouteParams(prev => ({ ...prev, ...newParams }))
  }

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      console.error("Failed to copy to clipboard")
    }
  }

  const getParamValue = (routeId: string, paramName: string, defaultValue: string) => {
    return routeParams[routeId]?.[paramName] ?? defaultValue
  }

  const setParamValue = (routeId: string, paramName: string, value: string) => {
    setRouteParams(prev => ({
      ...prev,
      [routeId]: {
        ...prev[routeId],
        [paramName]: value,
      },
    }))
  }

  const buildUrl = (route: RouteConfig): string => {
    let url = route.path
    
    // Replace path parameters
    route.parameters?.forEach(param => {
      const value = getParamValue(route.id, param.name, param.default || "")
      if (url.includes(`{${param.name}}`)) {
        url = url.replace(`{${param.name}}`, value)
      }
    })

    // Add query parameters for our custom API
    if (route.path.startsWith("/api/")) {
      const queryParams = new URLSearchParams()
      route.parameters?.forEach(param => {
        const value = getParamValue(route.id, param.name, param.default || "")
        if (value && !route.path.includes(`{${param.name}}`)) {
          queryParams.set(param.name, value)
        }
      })
      const queryString = queryParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    return url
  }

  const executeRoute = async (route: RouteConfig) => {
    setLoadingRoute(route.id)
    const startTime = Date.now()
    
    try {
      const url = buildUrl(route)
      const headers: HeadersInit = {
        "Accept": "application/json",
      }

      if (!route.path.startsWith("/api/")) {
        headers["X-Compatibility-Date"] = "2025-11-06"
      }

      // Add auth header for both ESI and our custom API routes that need it
      if (route.requiresAuth && tokens) {
        headers["Authorization"] = `Bearer ${tokens.access_token}`
      }

      const fetchOptions: RequestInit = {
        method: route.method,
        headers,
      }

      // Handle POST body
      if (route.method === "POST") {
        const namesParam = getParamValue(route.id, "names", "")
        if (namesParam) {
          headers["Content-Type"] = "application/json"
          fetchOptions.body = namesParam
        }
      }

      const response = await fetch(url, fetchOptions)
      const duration = Date.now() - startTime

      let body: unknown
      const contentType = response.headers.get("content-type")
      if (contentType?.includes("application/json")) {
        body = await response.json()
      } else {
        body = await response.text()
      }

      setRouteResponses(prev => ({
        ...prev,
        [route.id]: {
          status: response.status,
          statusText: response.statusText,
          body,
          duration,
        },
      }))
    } catch (err) {
      const duration = Date.now() - startTime
      setRouteResponses(prev => ({
        ...prev,
        [route.id]: {
          status: 0,
          statusText: "Error",
          body: { error: err instanceof Error ? err.message : "Request failed" },
          duration,
        },
      }))
    } finally {
      setLoadingRoute(null)
    }
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-emerald-400 bg-emerald-950/50 border-emerald-700"
    if (status >= 300 && status < 400) return "text-blue-400 bg-blue-950/50 border-blue-700"
    if (status >= 400 && status < 500) return "text-amber-400 bg-amber-950/50 border-amber-700"
    return "text-red-400 bg-red-950/50 border-red-700"
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">ESI API Explorer</h1>
              <p className="text-sm text-zinc-400">Test EVE Online ESI endpoints</p>
            </div>
            <div className="flex items-center gap-4">
              {characterInfo && (
                <div className="text-sm">
                  Logged in as <span className="text-emerald-400 font-medium">{characterInfo.character_name}</span>
                </div>
              )}
              {tokens ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem("eve_sso_tokens")
                    setTokens(null)
                    setCharacterInfo(null)
                    setStatus("idle")
                  }}
                  className="text-red-400 border-red-800 hover:bg-red-950/50"
                >
                  Logout
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = "/api/auth/eve/login"}
                >
                  Login with EVE SSO
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => window.location.href = "/"}>
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        {/* Auth Status */}
        {status === "loading" && (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-blue-400 mr-2" />
              <span>Exchanging authorization code...</span>
            </CardContent>
          </Card>
        )}

        {status === "error" && (
          <Alert variant="destructive" className="border-red-800/50 bg-red-950/30">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {status === "success" && tokens && (
          <Card className="border-emerald-800/50 bg-emerald-950/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-4 text-emerald-400" />
                <CardTitle className="text-sm text-emerald-400">Authentication Successful</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label className="text-xs text-emerald-400">Refresh Token (save this!)</Label>
                <div className="relative mt-1">
                  <code className="block rounded border border-emerald-800/50 bg-emerald-950/30 p-2 pr-10 text-xs break-all font-mono">
                    {tokens.refresh_token}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-6 w-6 p-0"
                    onClick={() => copyToClipboard(tokens.refresh_token, "refresh")}
                  >
                    {copiedField === "refresh" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Routes */}
        <div className="space-y-2">
          {routes.map((route) => {
            const isExpanded = expandedRoute === route.id
            const response = routeResponses[route.id]
            const isLoading = loadingRoute === route.id

            return (
              <Card key={route.id} className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
                {/* Route Header */}
                <button
                  onClick={() => setExpandedRoute(isExpanded ? null : route.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-zinc-800/50 transition-colors"
                >
                  <span className={`${METHOD_COLORS[route.method]} text-white text-xs font-bold px-2 py-1 rounded min-w-[52px] text-center`}>
                    {route.method}
                  </span>
                  <span className="font-mono text-sm text-zinc-300 flex-1">{route.path}</span>
                  <span className="text-sm text-zinc-400 hidden md:block">{route.title}</span>
                  {route.requiresAuth && (
                    <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded">Auth</span>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="size-4 text-zinc-500" />
                  ) : (
                    <ChevronRight className="size-4 text-zinc-500" />
                  )}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-zinc-800">
                    {/* Description */}
                    <div className="px-4 py-3 bg-zinc-900/30">
                      <p className="text-sm text-zinc-400">{route.description}</p>
                    </div>

                    {/* Parameters */}
                    {route.parameters && route.parameters.length > 0 && (
                      <div className="px-4 py-3 border-t border-zinc-800/50">
                        <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-3">Parameters</h4>
                        <div className="space-y-3">
                          {route.parameters.map((param) => (
                            <div key={param.name} className="flex items-start gap-4">
                              <div className="w-32 shrink-0">
                                <code className="text-sm text-blue-400">{param.name}</code>
                                {param.required && <span className="text-red-400 ml-1">*</span>}
                                <div className="text-xs text-zinc-500">{param.type}</div>
                              </div>
                              <div className="flex-1">
                                <Input
                                  value={getParamValue(route.id, param.name, param.default || "")}
                                  onChange={(e) => setParamValue(route.id, param.name, e.target.value)}
                                  placeholder={param.default || param.description}
                                  className="font-mono text-sm bg-zinc-950 border-zinc-700 h-8"
                                />
                                <p className="text-xs text-zinc-500 mt-1">{param.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Execute Button */}
                    <div className="px-4 py-3 border-t border-zinc-800/50 bg-zinc-900/30">
                      <Button
                        onClick={() => executeRoute(route)}
                        disabled={isLoading || (route.requiresAuth && !tokens)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isLoading ? (
                          <Loader2 className="size-4 animate-spin mr-2" />
                        ) : (
                          <Play className="size-4 mr-2" />
                        )}
                        Execute
                      </Button>
                      {route.requiresAuth && !tokens && (
                        <span className="ml-3 text-sm text-amber-400">Login required</span>
                      )}
                    </div>

                    {/* Response */}
                    {response && (
                      <div className="border-t border-zinc-800">
                        <div className="px-4 py-3 flex items-center justify-between bg-zinc-900/30">
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded border text-sm font-mono ${getStatusColor(response.status)}`}>
                              {response.status} {response.statusText}
                            </span>
                            <span className="text-sm text-zinc-500">{response.duration}ms</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(JSON.stringify(response.body, null, 2), `response-${route.id}`)}
                          >
                            {copiedField === `response-${route.id}` ? (
                              <Check className="size-4 text-emerald-400" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </Button>
                        </div>
                        <pre className="p-4 font-mono text-xs overflow-auto max-h-96 bg-zinc-950 text-zinc-300">
                          {JSON.stringify(response.body, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
