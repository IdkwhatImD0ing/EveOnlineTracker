"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { BlueprintSearch } from "@/components/industry/blueprint-search"
import { SystemSearch } from "@/components/industry/system-search"
import { GroupedMaterials } from "@/components/industry/grouped-materials"
import { ComponentsList } from "@/components/industry/components-list"
import { BuildSteps } from "@/components/industry/build-steps"
import { CostSummary } from "@/components/industry/cost-summary"
import { ArrowLeft, Calculator, Loader2, Factory, FlaskConical, FolderPlus, ShoppingCart, Hammer } from "lucide-react"
import type { CalculateResponse, MaterialWithPrice } from "@/app/api/industry/calculate/route"

interface BlueprintResult {
  blueprintTypeId: number
  blueprintName: string
  productTypeId: number
  productName: string
  isReaction: boolean
}

const STRUCTURE_OPTIONS = [
  { value: "npc_station", label: "NPC Station" },
  { value: "raitaru", label: "Raitaru (1% ME, 15% TE)" },
  { value: "azbel", label: "Azbel (1% ME, 20% TE)" },
  { value: "sotiyo", label: "Sotiyo (1% ME, 30% TE)" },
]

const REACTION_STRUCTURE_OPTIONS = [
  { value: "athanor", label: "Athanor (0% TE)" },
  { value: "tatara", label: "Tatara (25% TE)" },
]

const RIG_OPTIONS = [
  { value: "none", label: "No Rig" },
  { value: "t1", label: "T1 Rig (2% ME, 20% TE)" },
  { value: "t2", label: "T2 Rig (2.4% ME, 24% TE)" },
]

// Convert security value to type
function getSecurityType(security: number | null): 'highsec' | 'lowsec' | 'nullsec' {
  if (security === null) return 'highsec'
  if (security >= 0.5) return 'highsec'
  if (security > 0) return 'lowsec'
  return 'nullsec'
}

function getSecurityLabel(security: number | null): string {
  if (security === null) return 'Unknown'
  const type = getSecurityType(security)
  const secStr = security.toFixed(1)
  if (type === 'highsec') return `Highsec (${secStr})`
  if (type === 'lowsec') return `Lowsec (${secStr})`
  return `Nullsec (${secStr})`
}

export default function IndustryCalculatorPage() {
  const router = useRouter()
  const [selectedBlueprint, setSelectedBlueprint] = useState<BlueprintResult | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [runs, setRuns] = useState(1)
  const [blueprintMe, setBlueprintMe] = useState(0)
  const [blueprintTe, setBlueprintTe] = useState(0)
  const [systemName, setSystemName] = useState("3t7-m8")
  const [systemSecurity, setSystemSecurity] = useState<number | null>(-0.5)
  const [facilityTax, setFacilityTax] = useState(0)
  const [structureType, setStructureType] = useState("sotiyo")
  const [rigType, setRigType] = useState("t1")
  const [reactionStructure, setReactionStructure] = useState("tatara")
  const [reactionRig, setReactionRig] = useState("t1")
  const [showBuyRecommendations, setShowBuyRecommendations] = useState(false)
  
  const [isCalculating, setIsCalculating] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [result, setResult] = useState<CalculateResponse | null>(null)
  const [error, setError] = useState("")

  const handleCalculate = async () => {
    if (!selectedBlueprint) return

    setIsCalculating(true)
    setError("")
    setResult(null)

    try {
      const response = await fetch("/api/industry/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blueprintTypeId: selectedBlueprint.blueprintTypeId,
          quantity,
          runs,
          blueprintMe,
          blueprintTe,
          systemName,
          facilityTax,
          structureType: selectedBlueprint.isReaction ? reactionStructure : structureType,
          rigType: selectedBlueprint.isReaction ? reactionRig : rigType,
          securityType: getSecurityType(systemSecurity),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Calculation failed")
      }

      const data: CalculateResponse = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculation failed")
    } finally {
      setIsCalculating(false)
    }
  }

  const handleCreateProject = async () => {
    if (!result) return

    setIsCreatingProject(true)
    setError("")

    try {
      const response = await fetch("/api/projects/from-calculation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calculation: result,
          quantity,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create project")
      }

      const data = await response.json()
      router.push(`/projects/${data.project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project")
    } finally {
      setIsCreatingProject(false)
    }
  }

  const isReaction = selectedBlueprint?.isReaction || false

  // Check if there are any buy recommendations available
  const hasBuyRecommendations = useMemo(() => {
    if (!result?.components) return false
    return result.components.some(c => c.shouldBuy)
  }, [result?.components])

  // Calculate adjusted materials when buy mode is active
  // Subtracts materials needed for components that should be bought
  const adjustedMaterials = useMemo((): MaterialWithPrice[] => {
    if (!result?.materials || !showBuyRecommendations || !result.components) {
      return result?.materials || []
    }

    // Create a map of material adjustments from components that should be bought
    const materialsToSubtract = new Map<number, number>()
    
    for (const component of result.components) {
      if (component.shouldBuy && component.materialsBreakdown) {
        for (const mat of component.materialsBreakdown) {
          const current = materialsToSubtract.get(mat.typeId) || 0
          materialsToSubtract.set(mat.typeId, current + mat.quantity)
        }
      }
    }

    // Subtract from raw materials
    return result.materials
      .map(mat => {
        const subtractQty = materialsToSubtract.get(mat.typeId) || 0
        const newQty = Math.max(0, mat.quantity - subtractQty)
        
        if (newQty === 0) return null
        
        return {
          ...mat,
          quantity: newQty,
          volume: (mat.volume / mat.quantity) * newQty,
          totalBuyPrice: mat.buyPrice * newQty,
          totalSellPrice: mat.sellPrice * newQty,
        }
      })
      .filter((mat): mat is MaterialWithPrice => mat !== null)
  }, [result?.materials, result?.components, showBuyRecommendations])

  return (
    <div className="min-h-screen bg-background">
      {/* Background pattern */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />
      
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        {/* Header */}
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Calculator className="size-8 text-primary" />
              Industry Calculator
            </h1>
            <p className="text-muted-foreground">
              Calculate manufacturing costs and material requirements
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          {/* Settings Panel */}
          <div className="space-y-4">
            {/* Blueprint Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {isReaction ? (
                    <FlaskConical className="size-4 text-purple-500" />
                  ) : (
                    <Factory className="size-4 text-blue-500" />
                  )}
                  Blueprint
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <BlueprintSearch
                  selectedBlueprint={selectedBlueprint}
                  onSelect={setSelectedBlueprint}
                />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="runs">Runs/BPC</Label>
                    <Input
                      id="runs"
                      type="number"
                      min={1}
                      value={runs}
                      onChange={(e) => setRuns(Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder="∞"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="me">Base ME</Label>
                    <Input
                      id="me"
                      type="number"
                      min={0}
                      max={10}
                      value={blueprintMe}
                      onChange={(e) => setBlueprintMe(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="te">Base TE</Label>
                    <Input
                      id="te"
                      type="number"
                      min={0}
                      max={20}
                      value={blueprintTe}
                      onChange={(e) => setBlueprintTe(Math.min(20, Math.max(0, parseInt(e.target.value) || 0)))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Location & Costs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="system">System</Label>
                  <SystemSearch
                    value={systemName}
                    onChange={(name, security) => {
                      setSystemName(name)
                      setSystemSecurity(security)
                    }}
                  />
                  {systemSecurity !== null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Security: <span className={
                        systemSecurity >= 0.5 ? "text-green-500" :
                        systemSecurity > 0 ? "text-amber-500" : "text-red-500"
                      }>{getSecurityLabel(systemSecurity)}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="facilityTax">Facility Tax %</Label>
                  <Input
                    id="facilityTax"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={facilityTax}
                    onChange={(e) => setFacilityTax(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Structure Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Structure & Rig Setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isReaction ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="structure">Industry Structure</Label>
                      <Select
                        id="structure"
                        value={structureType}
                        onChange={(e) => setStructureType(e.target.value)}
                        options={STRUCTURE_OPTIONS}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rig">Industry Rig</Label>
                      <Select
                        id="rig"
                        value={rigType}
                        onChange={(e) => setRigType(e.target.value)}
                        options={RIG_OPTIONS}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="reactionStructure">Reaction Structure</Label>
                      <Select
                        id="reactionStructure"
                        value={reactionStructure}
                        onChange={(e) => setReactionStructure(e.target.value)}
                        options={REACTION_STRUCTURE_OPTIONS}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reactionRig">Reaction Rig</Label>
                      <Select
                        id="reactionRig"
                        value={reactionRig}
                        onChange={(e) => setReactionRig(e.target.value)}
                        options={RIG_OPTIONS}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Calculate Button */}
            <Button
              onClick={handleCalculate}
              disabled={!selectedBlueprint || isCalculating}
              className="w-full h-12 text-lg font-semibold"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator className="size-5" />
                  Calculate Recipe
                </>
              )}
            </Button>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          {/* Results Panel */}
          <div className="space-y-4">
            {result ? (
              <>
                {/* Action Bar */}
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold">
                    {quantity === 1 ? result.blueprint.productName : `${quantity}x ${result.blueprint.productName}`}
                  </h2>
                  <div className="flex items-center gap-3">
                    {/* Buy Mode Toggle - only show if there are buy recommendations */}
                    {hasBuyRecommendations && (
                      <Button
                        variant={showBuyRecommendations ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowBuyRecommendations(!showBuyRecommendations)}
                        className="gap-2"
                      >
                        {showBuyRecommendations ? (
                          <>
                            <ShoppingCart className="size-4" />
                            Buy Mode
                          </>
                        ) : (
                          <>
                            <Hammer className="size-4" />
                            Build All
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      onClick={handleCreateProject}
                      disabled={isCreatingProject}
                      className="gap-2"
                    >
                      {isCreatingProject ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <FolderPlus className="size-4" />
                          Create Project
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Cost Summary */}
                <CostSummary
                  costs={result.costs}
                  systemCostIndex={result.systemCostIndex}
                  quantity={quantity}
                />

                {/* Output Products */}
                {result.outputs.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Output Products</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 font-medium">Item</th>
                              <th className="pb-2 font-medium text-right">Quantity</th>
                              <th className="pb-2 font-medium text-right">Buy Price</th>
                              <th className="pb-2 font-medium text-right">Sell Price</th>
                              <th className="pb-2 font-medium text-right">Total (sell)</th>
                              <th className="pb-2 font-medium text-right">Duration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.outputs.map((o) => (
                              <tr key={o.typeId} className="hover:bg-accent/30">
                                <td className="py-2 font-medium">{o.name}</td>
                                <td className="py-2 text-right tabular-nums">{o.quantity.toLocaleString()}</td>
                                <td className="py-2 text-right tabular-nums">
                                  ISK {o.buyPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td className="py-2 text-right tabular-nums">
                                  ISK {o.sellPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td className="py-2 text-right tabular-nums font-medium text-green-600">
                                  ISK {o.totalSellPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td className="py-2 text-right tabular-nums text-muted-foreground">
                                  {o.duration}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Raw Materials (cannot be built) */}
                <GroupedMaterials
                  title="Raw Materials"
                  materials={adjustedMaterials}
                  isAdjusted={showBuyRecommendations && hasBuyRecommendations}
                />

                {/* Components (intermediate items that are built) */}
                {result.components && result.components.length > 0 && (
                  <ComponentsList
                    title="Components"
                    components={result.components}
                    showBuyRecommendations={showBuyRecommendations}
                  />
                )}

                {/* Excess Materials */}
                {result.excessMaterials.length > 0 && (
                  <GroupedMaterials
                    title="Excess Materials"
                    materials={result.excessMaterials}
                  />
                )}

                {/* Build Steps */}
                <BuildSteps steps={result.buildSteps} />
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Calculator className="size-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Calculation Yet</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    Select a blueprint and configure your settings, then click &quot;Calculate Recipe&quot; to see the full material breakdown and cost analysis.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

