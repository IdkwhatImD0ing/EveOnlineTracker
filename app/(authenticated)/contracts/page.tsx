"use client"

import { useState, useCallback } from "react"
import { FileText, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ContractsTable } from "@/components/contracts/contracts-table"
import { ProgressBar } from "@/components/market-seeder/progress-bar"
import { formatIskShort } from "@/components/market-seeder/utils"
import type {
  ContractOpportunity,
  ContractAnalyzeResponse,
  ContractAnalysisProgress,
} from "@/types/contracts"
import { CONTRACT_REGIONS, CONTRACT_ANALYSIS_DEFAULTS } from "@/types/contracts"

export default function ContractsPage() {
  // Region selection
  const [regionId, setRegionId] = useState<number>(CONTRACT_ANALYSIS_DEFAULTS.REGION_ID)

  // Analysis state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ContractAnalyzeResponse | null>(null)
  const [progress, setProgress] = useState<ContractAnalysisProgress | null>(null)

  // Run analysis
  const runAnalysis = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setProgress({ stage: 'connecting', message: 'Connecting to server...', percent: 0 })

    try {
      const params = new URLSearchParams({
        region_id: String(regionId),
        min_profit: String(CONTRACT_ANALYSIS_DEFAULTS.MIN_PROFIT),
        min_margin: String(CONTRACT_ANALYSIS_DEFAULTS.MIN_MARGIN),
        stream: 'true',
      })

      const response = await fetch(`/api/contracts/analyze?${params}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Analysis failed')
      }

      const contentType = response.headers.get('content-type')

      if (contentType?.includes('text/event-stream')) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let currentEventType = ''
        let currentEventData = ''

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEventType = line.slice(7).trim()
              } else if (line.startsWith('data: ')) {
                currentEventData = line.slice(6)
              } else if (line === '') {
                if (currentEventType && currentEventData) {
                  try {
                    const data = JSON.parse(currentEventData)

                    if (currentEventType === 'progress') {
                      setProgress({
                        stage: data.stage,
                        message: data.message,
                        percent: data.percent,
                        current: data.current,
                        total: data.total,
                      })
                    } else if (currentEventType === 'complete') {
                      setResult(data)
                      setProgress(null)
                    } else if (currentEventType === 'error') {
                      throw new Error(data.message)
                    }
                  } catch (e) {
                    if (e instanceof SyntaxError) {
                      console.warn('Failed to parse SSE data:', currentEventData)
                    } else {
                      throw e
                    }
                  }
                }
                currentEventType = ''
                currentEventData = ''
              }
            }
          }

          // Handle any remaining data
          if (currentEventType && currentEventData) {
            try {
              const data = JSON.parse(currentEventData)
              if (currentEventType === 'complete') {
                setResult(data)
                setProgress(null)
              }
            } catch {
              console.warn('Failed to parse final SSE data')
            }
          }
        }
      } else {
        const data = await response.json()
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze contracts')
    } finally {
      setIsLoading(false)
      setProgress(null)
    }
  }, [regionId])

  // Get selected region info
  const selectedRegion = CONTRACT_REGIONS.find(r => r.id === regionId)

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 md:gap-3">
              <FileText className="size-6 md:size-8" />
              Contract Seeding
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Find profitable public contracts to flip
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Region</label>
              <Select
                value={String(regionId)}
                onValueChange={(value) => setRegionId(parseInt(value))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_REGIONS.map((region) => (
                    <SelectItem key={region.id} value={String(region.id)}>
                      {region.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Contract Analysis</CardTitle>
                <CardDescription>
                  Analyze public contracts in {selectedRegion?.name || 'selected region'} to find
                  profitable opportunities
                </CardDescription>
              </div>
              <Button
                onClick={runAnalysis}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Analyzing...' : 'Analyze Contracts'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Bar */}
            {progress && (
              <ProgressBar progress={progress} />
            )}

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                {error}
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Analyzed</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {result.summary.contracts_analyzed.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        of {result.summary.total_contracts_fetched.toLocaleString()} contracts
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Profitable</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {result.summary.profitable_contracts.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        contracts found
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Avg Margin</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {result.summary.avg_profit_margin.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        profit margin
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Profit</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {formatIskShort(result.summary.total_potential_profit)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        potential ISK
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Contracts Table */}
                {result.opportunities.length > 0 ? (
                  <ContractsTable opportunities={result.opportunities} />
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                    No profitable contracts found matching the criteria.
                    <br />
                    Try adjusting filters or selecting a different region.
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {!result && !isLoading && !error && (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                Click &quot;Analyze Contracts&quot; to find profitable public contracts
                in {selectedRegion?.name || 'the selected region'}.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

