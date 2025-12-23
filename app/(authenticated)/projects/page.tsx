"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, FolderOpen, Calendar, Search, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ProjectProgressOverlay, getProgressCardBorder } from "@/components/project-progress"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/database"

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isCompletedOpen, setIsCompletedOpen] = useState(false)

  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await fetch("/api/projects")
        if (response.ok) {
          const data = await response.json()
          setProjects(data)
        }
      } catch (err) {
        console.error("Failed to fetch projects:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjects()
  }, [])

  // Separate projects into active and completed
  const activeProjects = projects.filter((project) => !project.completed)
  const completedProjects = projects.filter((project) => project.completed)

  // Filter both arrays based on search query
  const filteredActiveProjects = activeProjects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredCompletedProjects = completedProjects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredProjects = [...filteredActiveProjects, ...filteredCompletedProjects]

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-4 md:space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-sm md:text-base text-muted-foreground">Track your manufacturing projects and materials</p>
          </div>
          <Button asChild size="default" className="w-full sm:w-auto">
            <Link href="/projects/new">
              <Plus className="size-4 mr-2" />
              New Project
            </Link>
          </Button>
        </header>

        {/* Search */}
        {projects.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first industry project to start tracking materials and costs.
              </p>
              <Button asChild>
                <Link href="/projects/new">
                  <Plus className="size-4 mr-2" />
                  Create Project
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : filteredProjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No matching projects</h3>
              <p className="text-muted-foreground text-center">
                No projects found matching &quot;{searchQuery}&quot;
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Active Projects */}
            {filteredActiveProjects.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Active Projects</h2>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredActiveProjects.map((project) => (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <Card className={cn(
                        "h-full transition-all hover:shadow-lg hover:shadow-primary/5 cursor-pointer active:scale-[0.98] relative overflow-hidden",
                        getProgressCardBorder(project.progress)
                      )}>
                        <ProjectProgressOverlay progress={project.progress} />
                        <CardHeader className="p-4 md:p-6 relative z-10">
                          <CardTitle className="line-clamp-1 text-base md:text-lg">{project.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1 text-xs md:text-sm">
                            <Calendar className="size-3" />
                            {new Date(project.created_at).toLocaleDateString()}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Projects - Collapsible Section */}
            {completedProjects.length > 0 && (
              <Collapsible open={isCompletedOpen} onOpenChange={setIsCompletedOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-4 h-auto hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-muted-foreground" />
                      <span className="font-semibold">
                        Completed Projects ({filteredCompletedProjects.length})
                      </span>
                    </div>
                    {isCompletedOpen ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                    {filteredCompletedProjects.map((project) => (
                      <Link key={project.id} href={`/projects/${project.id}`}>
                        <Card className={cn(
                          "h-full transition-all hover:shadow-lg hover:shadow-primary/5 cursor-pointer active:scale-[0.98] opacity-75 relative overflow-hidden",
                          getProgressCardBorder(project.progress)
                        )}>
                          <ProjectProgressOverlay progress={project.progress} />
                          <CardHeader className="p-4 md:p-6 relative z-10">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="size-4 text-muted-foreground shrink-0" />
                              <CardTitle className="line-clamp-1 text-base md:text-lg">{project.name}</CardTitle>
                            </div>
                            <CardDescription className="flex items-center gap-1 text-xs md:text-sm">
                              <Calendar className="size-3" />
                              {new Date(project.created_at).toLocaleDateString()}
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Show message if search returns no results */}
            {filteredActiveProjects.length === 0 && filteredCompletedProjects.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Search className="size-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No matching projects</h3>
                  <p className="text-muted-foreground text-center">
                    No projects found matching &quot;{searchQuery}&quot;
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Summary */}
        {projects.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? "s" : ""}
            {activeProjects.length > 0 && completedProjects.length > 0 && (
              <> ({activeProjects.length} active, {completedProjects.length} completed)</>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

