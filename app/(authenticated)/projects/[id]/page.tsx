"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ItemList } from "@/components/item-list"
import { GroupedItemList } from "@/components/grouped-item-list"
import { PriceSummary } from "@/components/price-summary"
import { AdditionalCosts } from "@/components/additional-costs"
import { TotalCost } from "@/components/total-cost"
import { InventoryImport } from "@/components/inventory-import"
import { ArrowLeft, Loader2, AlertCircle, Trash2, ShoppingCart, Hammer, CheckCircle2, Circle, ChevronDown, ChevronUp, Database, ArrowUp, ArrowDown } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { EveItemIcon } from "@/components/eve-item-icon"
import { getGroupName } from "@/lib/sde"
import type { ProjectWithDetails, AdditionalCost, RawMaterial, Component, ComponentMaterialBreakdown } from "@/types/database"

// Helper type for aggregated materials
interface AggregatedMaterial {
  typeId: number
  name: string
  quantity: number
  groupName: string
}

// Helper function to aggregate materials from multiple components
function aggregateMaterials(components: Component[]): AggregatedMaterial[] {
  const materialsMap = new Map<number, AggregatedMaterial>()
  
  for (const comp of components) {
    if (comp.materials_breakdown) {
      for (const mat of comp.materials_breakdown) {
        const existing = materialsMap.get(mat.typeId)
        if (existing) {
          existing.quantity += mat.quantity * (comp.quantity - comp.quantity_made)
        } else {
          materialsMap.set(mat.typeId, {
            typeId: mat.typeId,
            name: mat.name,
            quantity: mat.quantity * (comp.quantity - comp.quantity_made),
            groupName: getGroupName(mat.typeId) || "Unknown",
          })
        }
      }
    }
  }
  
  // Filter out zero quantities and sort by name
  return Array.from(materialsMap.values())
    .filter(m => m.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Sort types for aggregated materials table
type MaterialSortField = "name" | "type" | "quantity"
type MaterialSortDirection = "asc" | "desc"

// Component to display aggregated materials as a sortable table
function AggregatedMaterialsCard({ 
  title, 
  materials 
}: { 
  title: string
  materials: AggregatedMaterial[] 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [sortField, setSortField] = useState<MaterialSortField>("name")
  const [sortDirection, setSortDirection] = useState<MaterialSortDirection>("asc")

  const handleSort = (field: MaterialSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const sortedMaterials = useMemo(() => {
    return [...materials].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "type":
          comparison = a.groupName.localeCompare(b.groupName)
          break
        case "quantity":
          comparison = a.quantity - b.quantity
          break
      }
      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [materials, sortField, sortDirection])

  // Early return must be AFTER all hooks to satisfy Rules of Hooks
  if (materials.length === 0) return null

  const SortIndicator = ({ field }: { field: MaterialSortField }) => {
    if (sortField !== field) return null
    return sortDirection === "asc" 
      ? <ArrowUp className="size-3 ml-1" /> 
      : <ArrowDown className="size-3 ml-1" />
  }
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {title} ({materials.length} items)
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="size-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Table Header */}
            <div className="flex items-center gap-3 px-2 py-2 border-b border-border/50 mb-1">
              <div className="w-8 shrink-0" /> {/* Icon column */}
              <button
                onClick={(e) => { e.stopPropagation(); handleSort("name") }}
                className="flex-1 flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
              >
                Name <SortIndicator field="name" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleSort("type") }}
                className="w-32 shrink-0 flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
              >
                Type <SortIndicator field="type" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleSort("quantity") }}
                className="w-24 shrink-0 flex items-center justify-end text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
              >
                Qty <SortIndicator field="quantity" />
              </button>
            </div>
            {/* Table Body */}
            <div className="max-h-[400px] overflow-y-auto">
              {sortedMaterials.map((mat) => (
                <div 
                  key={mat.typeId} 
                  className="flex items-center gap-3 px-2 py-1.5 hover:bg-muted/50 rounded transition-colors"
                >
                  <div className="w-8 shrink-0">
                    <EveItemIcon typeId={mat.typeId} size={32} className="size-6 rounded" />
                  </div>
                  <span className="flex-1 text-sm truncate">{mat.name}</span>
                  <span className="w-32 shrink-0 text-sm text-muted-foreground truncate">
                    {mat.groupName}
                  </span>
                  <span className="w-24 shrink-0 text-sm font-mono text-right">
                    {mat.quantity.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  
  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [showBuyRecommendations, setShowBuyRecommendations] = useState(false)
  const [isPopulatingMaterials, setIsPopulatingMaterials] = useState(false)

  // Calculate buy recommendations for components
  const componentBuyRecommendations = useMemo(() => {
    if (!project?.components) return { hasBuyRecommendations: false, recommendations: new Map<string, boolean>() }
    
    const recommendations = new Map<string, boolean>()
    let hasBuyRecommendations = false
    
    for (const comp of project.components) {
      // Only calculate if we have both build_cost and sell_price
      if (comp.build_cost && comp.sell_price) {
        const buyTotal = comp.sell_price * comp.quantity
        const shouldBuy = buyTotal < comp.build_cost
        recommendations.set(comp.id, shouldBuy)
        if (shouldBuy) hasBuyRecommendations = true
      }
    }
    
    return { hasBuyRecommendations, recommendations }
  }, [project?.components])

  // Calculate adjusted raw materials when buy mode is active
  const adjustedRawMaterials = useMemo((): RawMaterial[] => {
    if (!project?.raw_materials || !showBuyRecommendations || !project.components) {
      return project?.raw_materials || []
    }

    // Create a map of material adjustments from components that should be bought
    const materialsToSubtract = new Map<number, number>()
    
    for (const comp of project.components) {
      const shouldBuy = componentBuyRecommendations.recommendations.get(comp.id)
      if (shouldBuy && comp.materials_breakdown) {
        for (const mat of comp.materials_breakdown) {
          const current = materialsToSubtract.get(mat.typeId) || 0
          materialsToSubtract.set(mat.typeId, current + mat.quantity)
        }
      }
    }

    // Subtract from raw materials
    return project.raw_materials
      .map(mat => {
        const subtractQty = materialsToSubtract.get(mat.type_id) || 0
        const newQty = Math.max(0, mat.quantity - subtractQty)
        
        if (newQty === 0) return null
        
        return {
          ...mat,
          quantity: newQty,
        }
      })
      .filter((mat): mat is RawMaterial => mat !== null)
  }, [project?.raw_materials, project?.components, showBuyRecommendations, componentBuyRecommendations])

  // Split components into Capital and Specialized groups
  const { capitalComponents, specializedComponents } = useMemo(() => {
    if (!project?.components) {
      return { capitalComponents: [], specializedComponents: [] }
    }
    
    const capital: Component[] = []
    const specialized: Component[] = []
    
    for (const comp of project.components) {
      if (comp.item_name.toLowerCase().includes("capital")) {
        capital.push(comp)
      } else {
        specialized.push(comp)
      }
    }
    
    return { capitalComponents: capital, specializedComponents: specialized }
  }, [project?.components])

  // Aggregate materials for each component group
  const capitalMaterials = useMemo(
    () => aggregateMaterials(capitalComponents),
    [capitalComponents]
  )
  
  const specializedMaterials = useMemo(
    () => aggregateMaterials(specializedComponents),
    [specializedComponents]
  )

  // Check if any components need materials populated
  const needsMaterialsPopulated = useMemo(() => {
    if (!project?.components) return false
    return project.components.some(comp => !comp.materials_breakdown)
  }, [project?.components])

  const fetchProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      if (!response.ok) {
        throw new Error("Project not found")
      }
      const data = await response.json()
      setError("")
      setProject(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project")
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  const handleItemUpdate = (
    itemId: string,
    collected: boolean,
    type: "raw" | "component",
    quantityMade?: number
  ) => {
    if (!project) return
    
    setProject((prev) => {
      if (!prev) return prev
      
      if (type === "raw") {
        return {
          ...prev,
          raw_materials: prev.raw_materials.map((item) =>
            item.id === itemId ? { ...item, collected } : item
          ),
        }
      } else {
        return {
          ...prev,
          components: prev.components.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  collected,
                  ...(quantityMade !== undefined && { quantity_made: quantityMade }),
                }
              : item
          ),
        }
      }
    })
  }

  const handleCostAdded = (cost: AdditionalCost) => {
    setProject((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        additional_costs: [cost, ...prev.additional_costs],
      }
    })
  }

  const handleCostRemoved = (costId: string) => {
    setProject((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        additional_costs: prev.additional_costs.filter((c) => c.id !== costId),
      }
    })
  }

  const handleInventoryItemsCollected = useCallback((itemIds: string[]) => {
    setProject((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        raw_materials: prev.raw_materials.map((item) =>
          itemIds.includes(item.id) ? { ...item, collected: true } : item
        ),
      }
    })
  }, [])

  const handleToggleComplete = async () => {
    if (!project) return
    
    setIsCompleting(true)
    
    try {
      const response = await fetch(`/api/projects/${projectId}/complete`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ completed: !project.completed }),
      })
      
      if (response.ok) {
        const updatedProject = await response.json()
        setProject((prev) => prev ? { ...prev, completed: updatedProject.completed } : null)
      } else {
        console.error("Failed to update project completion")
      }
    } catch (err) {
      console.error("Failed to update project completion:", err)
    } finally {
      setIsCompleting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return
    }
    
    setIsDeleting(true)
    
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      })
      
      if (response.ok) {
        router.push("/")
      }
    } catch (err) {
      console.error("Failed to delete project:", err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePopulateMaterials = async () => {
    setIsPopulatingMaterials(true)
    
    try {
      const response = await fetch(`/api/projects/${projectId}/populate-materials`, {
        method: "POST",
      })
      
      if (response.ok) {
        // Refresh project data to get updated materials
        await fetchProject()
      } else {
        const data = await response.json()
        console.error("Failed to populate materials:", data.error)
      }
    } catch (err) {
      console.error("Failed to populate materials:", err)
    } finally {
      setIsPopulatingMaterials(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-4xl">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error || "Project not found"}</AlertDescription>
          </Alert>
          <Button className="mt-4" asChild>
            <Link href="/projects">Back to Projects</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-4">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link href="/projects">
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-3xl font-bold tracking-tight truncate">{project.name}</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Created {new Date(project.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Buy Mode Toggle - only show if there are buy recommendations */}
            {componentBuyRecommendations.hasBuyRecommendations && (
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
            {/* Populate Materials - only show if components need materials data */}
            {needsMaterialsPopulated && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePopulateMaterials}
                disabled={isPopulatingMaterials}
                className="gap-2"
              >
                {isPopulatingMaterials ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Database className="size-4" />
                )}
                Populate Materials
              </Button>
            )}
            <Button
              variant={project.completed ? "outline" : "default"}
              size="sm"
              onClick={handleToggleComplete}
              disabled={isCompleting}
              className="gap-2"
            >
              {isCompleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : project.completed ? (
                <>
                  <Circle className="size-4" />
                  Mark as Active
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Mark as Complete
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete Project
            </Button>
          </div>
        </header>

        {/* Inventory Import */}
        <InventoryImport
          rawMaterials={project.raw_materials}
          projectId={projectId}
          onItemsCollected={handleInventoryItemsCollected}
        />

        {/* Item Lists - Stacked vertically for better table view */}
        <div className="space-y-6">
          <GroupedItemList
            title="Raw Materials"
            items={adjustedRawMaterials}
            projectId={projectId}
            onItemUpdate={(itemId, collected) => handleItemUpdate(itemId, collected, "raw")}
            isAdjusted={showBuyRecommendations && componentBuyRecommendations.hasBuyRecommendations}
          />
          
          {/* Capital Components */}
          {capitalComponents.length > 0 && (
            <div className="space-y-3">
              <ItemList
                title="Capital Components"
                items={capitalComponents}
                type="component"
                projectId={projectId}
                onItemUpdate={(itemId, collected, quantityMade) => handleItemUpdate(itemId, collected, "component", quantityMade)}
                showBuyRecommendations={showBuyRecommendations}
                buyRecommendations={componentBuyRecommendations.recommendations}
              />
              <AggregatedMaterialsCard 
                title="Materials needed for Capital Components" 
                materials={capitalMaterials} 
              />
            </div>
          )}
          
          {/* Specialized Components */}
          {specializedComponents.length > 0 && (
            <div className="space-y-3">
              <ItemList
                title="Specialized Components"
                items={specializedComponents}
                type="component"
                projectId={projectId}
                onItemUpdate={(itemId, collected, quantityMade) => handleItemUpdate(itemId, collected, "component", quantityMade)}
                showBuyRecommendations={showBuyRecommendations}
                buyRecommendations={componentBuyRecommendations.recommendations}
              />
              <AggregatedMaterialsCard 
                title="Materials needed for Specialized Components" 
                materials={specializedMaterials} 
              />
            </div>
          )}
        </div>

        {/* Price Summary */}
        <PriceSummary
          rawMaterials={adjustedRawMaterials}
        />

        {/* Additional Costs */}
        <AdditionalCosts
          costs={project.additional_costs}
          projectId={projectId}
          onCostAdded={handleCostAdded}
          onCostRemoved={handleCostRemoved}
        />

        {/* Total Cost */}
        <TotalCost
          rawMaterials={adjustedRawMaterials}
          additionalCosts={project.additional_costs}
        />
      </div>
    </div>
  )
}

