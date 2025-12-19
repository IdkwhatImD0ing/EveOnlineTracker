"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Copy, Check, Play, ChevronDown, ChevronRight } from "lucide-react"

interface CharacterInfo {
  id: string
  character_id: number
  character_name: string
  is_main: boolean
}

interface SessionData {
  authenticated: boolean
  user?: {
    id: string
    main_character_id: number
    main_character_name: string
    allowed: boolean
  }
  characters?: CharacterInfo[]
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
  parameters?: {
    name: string
    type: string
    description: string
    default?: string
    required?: boolean
  }[]
}

const METHOD_COLORS = {
  GET: "bg-emerald-600",
  POST: "bg-blue-600",
  PUT: "bg-amber-600",
  DELETE: "bg-red-600",
}

// Define routes for testing
const routes: RouteConfig[] = [
  {
    id: "market-history-raw",
    method: "GET",
    path: "/api/esi/market-history-raw",
    title: "Raw Market History (Debug)",
    description: "Fetches raw market history for an item in a region directly from ESI. Does NOT store to database - pure debugging tool. Useful for testing if items have trade data in specific regions.",
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
    title: "Get Keepstar Structure ID",
    description: "Searches for structures and returns any Keepstar in the specified system. Requires docking access to the structure.",
    parameters: [
      { name: "search", type: "string", description: "Search term (min 3 chars)", default: "3T7-M8", required: false },
      { name: "system_name", type: "string", description: "System name to search in (e.g., 3T7-M8, Jita, 1DQ1-A)", default: "3T7-M8", required: false },
    ],
  },
  {
    id: "structure-orders",
    method: "GET",
    path: "/api/esi/structure-orders",
    title: "Get Market Orders from Structure",
    description: "Fetches market orders from a structure. Returns top items by price.",
    parameters: [
      { name: "structure_id", type: "integer", description: "Structure ID (e.g., 1051567430261 for 3T7 Keepstar)", default: "", required: true },
      { name: "buy_orders", type: "boolean", description: "Set to 'true' for buy orders, default is sell orders", default: "false", required: false },
    ],
  },
  {
    id: "character-assets",
    method: "GET",
    path: "/api/esi/character-assets",
    title: "Get Character Assets",
    description: "Fetches all assets for your character across all locations.",
    parameters: [],
  },
  {
    id: "character-orders",
    method: "GET",
    path: "/api/esi/character-orders",
    title: "Get Character Market Orders",
    description: "Fetches all active market orders for your character.",
    parameters: [],
  },
  {
    id: "wallet",
    method: "GET",
    path: "/api/esi/wallet",
    title: "Get Wallet Balance",
    description: "Fetches your character's wallet balance.",
    parameters: [],
  },
  {
    id: "undercut-check",
    method: "GET",
    path: "/api/esi/undercut-check",
    title: "Check for Undercuts",
    description: "Checks if any of your sell orders have been undercut.",
    parameters: [
      { name: "structure_id", type: "integer", description: "Structure ID to check orders in", default: "", required: true },
    ],
  },
  {
    id: "capital-efficiency",
    method: "GET",
    path: "/api/esi/capital-efficiency",
    title: "Capital Efficiency Analysis",
    description: "Analyzes how efficiently your capital is deployed in market orders.",
    parameters: [
      { name: "structure_id", type: "integer", description: "Structure ID", default: "", required: true },
    ],
  },
]

export default function ApiExplorerPage() {
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [copiedField, setCopiedField] = useState<string | null>(null)
  
  // Route states
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null)
  const [routeParams, setRouteParams] = useState<Record<string, Record<string, string>>>({})
  const [routeResponses, setRouteResponses] = useState<Record<string, ApiResponse>>({})
  const [loadingRoute, setLoadingRoute] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch("/api/auth/session")
        const data: SessionData = await response.json()
        setSession(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch session")
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [])

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
    
    // Add query parameters
    const queryParams = new URLSearchParams()
    route.parameters?.forEach(param => {
      const value = getParamValue(route.id, param.name, param.default || "")
      if (value) {
        queryParams.set(param.name, value)
      }
    })
    const queryString = queryParams.toString()
    if (queryString) {
      url += `?${queryString}`
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

      const fetchOptions: RequestInit = {
        method: route.method,
        headers,
        credentials: "include", // Include session cookie
      }

      // Handle POST body
      if (route.method === "POST") {
        const bodyParam = route.parameters?.find(p => p.name === "body")
        if (bodyParam) {
          const bodyValue = getParamValue(route.id, "body", "")
          if (bodyValue) {
            headers["Content-Type"] = "application/json"
            fetchOptions.body = bodyValue
          }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto mt-8">
        <AlertCircle className="size-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  const mainCharacter = session?.characters?.find(c => c.is_main)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">ESI API Explorer</h1>
          <p className="text-muted-foreground">Test EVE Online ESI endpoints</p>
        </div>
        {mainCharacter && (
          <div className="flex items-center gap-3">
            <img
              src={`https://images.evetech.net/characters/${mainCharacter.character_id}/portrait?size=32`}
              alt={mainCharacter.character_name}
              className="size-8 rounded-full ring-2 ring-primary/20"
            />
            <span className="text-sm">
              Testing as <span className="text-primary font-medium">{mainCharacter.character_name}</span>
            </span>
          </div>
        )}
      </div>

      {/* Routes */}
      <div className="space-y-2">
        {routes.map((route) => {
          const isExpanded = expandedRoute === route.id
          const response = routeResponses[route.id]
          const isLoading = loadingRoute === route.id

          return (
            <Card key={route.id} className="overflow-hidden">
              {/* Route Header */}
              <button
                onClick={() => setExpandedRoute(isExpanded ? null : route.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/50 transition-colors"
              >
                <span className={`${METHOD_COLORS[route.method]} text-white text-xs font-bold px-2 py-1 rounded min-w-[52px] text-center`}>
                  {route.method}
                </span>
                <span className="font-mono text-sm flex-1">{route.path}</span>
                <span className="text-sm text-muted-foreground hidden md:block">{route.title}</span>
                {isExpanded ? (
                  <ChevronDown className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground" />
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t">
                  {/* Description */}
                  <div className="px-4 py-3 bg-muted/30">
                    <p className="text-sm text-muted-foreground">{route.description}</p>
                  </div>

                  {/* Parameters */}
                  {route.parameters && route.parameters.length > 0 && (
                    <div className="px-4 py-3 border-t">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Parameters</h4>
                      <div className="space-y-3">
                        {route.parameters.map((param) => (
                          <div key={param.name} className="flex items-start gap-4">
                            <div className="w-32 shrink-0">
                              <code className="text-sm text-primary">{param.name}</code>
                              {param.required && <span className="text-destructive ml-1">*</span>}
                              <div className="text-xs text-muted-foreground">{param.type}</div>
                            </div>
                            <div className="flex-1">
                              <Input
                                value={getParamValue(route.id, param.name, param.default || "")}
                                onChange={(e) => setParamValue(route.id, param.name, e.target.value)}
                                placeholder={param.default || param.description}
                                className="font-mono text-sm h-8"
                              />
                              <p className="text-xs text-muted-foreground mt-1">{param.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Execute Button */}
                  <div className="px-4 py-3 border-t bg-muted/30">
                    <Button
                      onClick={() => executeRoute(route)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="size-4 animate-spin mr-2" />
                      ) : (
                        <Play className="size-4 mr-2" />
                      )}
                      Execute
                    </Button>
                  </div>

                  {/* Response */}
                  {response && (
                    <div className="border-t">
                      <div className="px-4 py-3 flex items-center justify-between bg-muted/30">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded border text-sm font-mono ${getStatusColor(response.status)}`}>
                            {response.status} {response.statusText}
                          </span>
                          <span className="text-sm text-muted-foreground">{response.duration}ms</span>
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
                      <pre className="p-4 font-mono text-xs overflow-auto max-h-96 bg-card">
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
  )
}

