"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ItemList } from "@/components/item-list"
import { GroupedItemList } from "@/components/grouped-item-list"
import { PriceSummary } from "@/components/price-summary"
import { AdditionalCosts } from "@/components/additional-costs"
import { TotalCost } from "@/components/total-cost"
import { ArrowLeft, Loader2, AlertCircle, Trash2 } from "lucide-react"
import type { ProjectWithDetails, AdditionalCost } from "@/types/database"

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  
  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

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

  const handleItemUpdate = (itemId: string, collected: boolean, type: "raw" | "component") => {
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
            item.id === itemId ? { ...item, collected } : item
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
        </header>

        {/* Item Lists - Stacked vertically for better table view */}
        <div className="space-y-6">
          <GroupedItemList
            title="Raw Materials"
            items={project.raw_materials}
            projectId={projectId}
            onItemUpdate={(itemId, collected) => handleItemUpdate(itemId, collected, "raw")}
          />
          <ItemList
            title="Components"
            items={project.components}
            type="component"
            projectId={projectId}
            onItemUpdate={(itemId, collected) => handleItemUpdate(itemId, collected, "component")}
          />
        </div>

        {/* Price Summary */}
        <PriceSummary
          rawMaterials={project.raw_materials}
          components={project.components}
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
          rawMaterials={project.raw_materials}
          additionalCosts={project.additional_costs}
        />
      </div>
    </div>
  )
}

