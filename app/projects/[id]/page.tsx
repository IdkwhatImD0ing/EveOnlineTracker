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
import { ArrowLeft, Loader2, AlertCircle, Trash2, ShoppingCart, Hammer } from "lucide-react"
import type { ProjectWithDetails, AdditionalCost, RawMaterial, Component } from "@/types/database"

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  
  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [showBuyRecommendations, setShowBuyRecommendations] = useState(false)

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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-4xl">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error || "Project not found"}</AlertDescription>
          </Alert>
          <Button className="mt-4" asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              <p className="text-muted-foreground">
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

        {/* Item Lists - Stacked vertically for better table view */}
        <div className="space-y-6">
          <GroupedItemList
            title="Raw Materials"
            items={adjustedRawMaterials}
            projectId={projectId}
            onItemUpdate={(itemId, collected) => handleItemUpdate(itemId, collected, "raw")}
            isAdjusted={showBuyRecommendations && componentBuyRecommendations.hasBuyRecommendations}
          />
          <ItemList
            title="Components"
            items={project.components}
            type="component"
            projectId={projectId}
            onItemUpdate={(itemId, collected, quantityMade) => handleItemUpdate(itemId, collected, "component", quantityMade)}
            showBuyRecommendations={showBuyRecommendations}
            buyRecommendations={componentBuyRecommendations.recommendations}
          />
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

