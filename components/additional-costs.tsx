"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Loader2 } from "lucide-react"
import type { AdditionalCost } from "@/types/database"

interface AdditionalCostsProps {
  costs: AdditionalCost[]
  projectId: string
  onCostAdded: (cost: AdditionalCost) => void
  onCostRemoved: (costId: string) => void
}

function formatISK(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function AdditionalCosts({
  costs,
  projectId,
  onCostAdded,
  onCostRemoved,
}: AdditionalCostsProps) {
  const [note, setNote] = useState("")
  const [amount, setAmount] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!note.trim() || !amount.trim()) return
    
    const parsedAmount = parseFloat(amount.replace(/,/g, ""))
    if (isNaN(parsedAmount)) return

    setIsAdding(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note.trim(),
          amount: parsedAmount,
        }),
      })

      if (response.ok) {
        const newCost = await response.json()
        onCostAdded(newCost)
        setNote("")
        setAmount("")
      }
    } catch (err) {
      console.error("Failed to add cost:", err)
    } finally {
      setIsAdding(false)
    }
  }

  const handleDelete = async (costId: string) => {
    setDeletingId(costId)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/costs?costId=${costId}`,
        { method: "DELETE" }
      )

      if (response.ok) {
        onCostRemoved(costId)
      }
    } catch (err) {
      console.error("Failed to delete cost:", err)
    } finally {
      setDeletingId(null)
    }
  }

  const total = costs.reduce((sum, cost) => sum + cost.amount, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Additional Costs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            placeholder="Note (e.g., Manufacturing fee)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1"
            disabled={isAdding}
          />
          <Input
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-36"
            disabled={isAdding}
          />
          <Button type="submit" size="icon" disabled={isAdding || !note.trim() || !amount.trim()}>
            {isAdding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
          </Button>
        </form>

        {costs.length > 0 && (
          <div className="space-y-2">
            {costs.map((cost) => (
              <div
                key={cost.id}
                className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
              >
                <span className="text-sm">{cost.note}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">
                    {formatISK(cost.amount)} ISK
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(cost.id)}
                    disabled={deletingId === cost.id}
                  >
                    {deletingId === cost.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5 text-destructive" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
            
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm font-medium">Total Additional</span>
              <span className="font-mono font-semibold">
                {formatISK(total)} ISK
              </span>
            </div>
          </div>
        )}

        {costs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No additional costs added yet
          </p>
        )}
      </CardContent>
    </Card>
  )
}

