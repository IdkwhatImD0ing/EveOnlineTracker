"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Loader2, AlertCircle, Package, Boxes } from "lucide-react"
import Link from "next/link"

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [rawMaterials, setRawMaterials] = useState("")
  const [components, setComponents] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!name.trim()) {
      setError("Project name is required")
      return
    }

    if (!rawMaterials.trim() && !components.trim()) {
      setError("Please provide at least one list of items")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          rawMaterialsInput: rawMaterials,
          componentsInput: components,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create project")
      }

      router.push(`/projects/${data.project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Project</h1>
            <p className="text-muted-foreground">
              Create a new industry project by pasting your item lists
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Project Name</CardTitle>
              <CardDescription>
                Give your project a descriptive name
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="e.g., Nightmare Build, T2 Modules, etc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Package className="size-5 text-muted-foreground" />
                  <CardTitle>Raw Materials</CardTitle>
                </div>
                <CardDescription>
                  Paste your raw materials list from Eve Online. Supports
                  inventory copy format.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="raw-materials" className="sr-only">
                    Raw Materials
                  </Label>
                  <Textarea
                    id="raw-materials"
                    placeholder={`Tritanium 1000000
Pyerite 500000
Mexallon 250000
...`}
                    className="min-h-[250px] font-mono text-sm"
                    value={rawMaterials}
                    onChange={(e) => setRawMaterials(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    One item per line: &quot;Item Name&quot; or &quot;Item Name Quantity&quot;
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Boxes className="size-5 text-muted-foreground" />
                  <CardTitle>Components</CardTitle>
                </div>
                <CardDescription>
                  Paste your components or intermediate products list from Eve
                  Online.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="components" className="sr-only">
                    Components
                  </Label>
                  <Textarea
                    id="components"
                    placeholder={`Plasma Thruster 50
Fernite Carbide Armor Plate 100
Deflection Shield Emitter 75
...`}
                    className="min-h-[250px] font-mono text-sm"
                    value={components}
                    onChange={(e) => setComponents(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    One item per line: &quot;Item Name&quot; or &quot;Item Name Quantity&quot;
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" asChild disabled={isLoading}>
              <Link href="/">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creating Project...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

