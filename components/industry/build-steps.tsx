"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { useState } from "react"

interface BuildStep {
  blueprintName: string
  productName: string
  runs: number
  quantity: number
  excess: number
  duration: string
  jobCost: number
}

interface BuildStepsProps {
  steps: BuildStep[]
}

function formatISK(value: number): string {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(2)}K`
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function BuildSteps({ steps }: BuildStepsProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (steps.length === 0) return null

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors">
            <CardTitle className="flex items-center justify-between text-lg">
              <span>Components Breakdown ({steps.length} jobs)</span>
              <ChevronDown className={`size-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium text-right">Runs</th>
                    <th className="pb-2 font-medium text-right">Quantity</th>
                    <th className="pb-2 font-medium text-right">Excess</th>
                    <th className="pb-2 font-medium text-right">Duration</th>
                    <th className="pb-2 font-medium text-right">Job Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((step, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-accent/30">
                      <td className="py-2">
                        <div className="font-medium">{step.productName}</div>
                        <div className="text-xs text-muted-foreground">{step.blueprintName}</div>
                      </td>
                      <td className="py-2 text-right tabular-nums">{step.runs}</td>
                      <td className="py-2 text-right tabular-nums">{step.quantity}</td>
                      <td className="py-2 text-right tabular-nums text-amber-600">
                        {step.excess > 0 ? `+${step.excess}` : "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {step.duration}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        ISK {formatISK(step.jobCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

