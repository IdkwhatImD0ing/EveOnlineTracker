"use client"

import { useState, useMemo } from "react"
import { ChevronDown, ChevronRight, Copy, Check, ExternalLink, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EveItemIcon } from "@/components/eve-item-icon"
import { formatIskShort } from "@/components/market-seeder/utils"
import type { ContractOpportunity, ContractItemWithPrice } from "@/types/contracts"

// ============================================================================
// Types
// ============================================================================

interface ContractsTableProps {
  opportunities: ContractOpportunity[]
}

type SortKey = 'profit_margin' | 'profit' | 'contract_price' | 'item_count' | 'date_issued'
type SortDirection = 'asc' | 'desc'

// ============================================================================
// Helpers
// ============================================================================

function formatDate(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function timeUntilExpiry(expiryDate: string): string {
  const now = new Date()
  const expiry = new Date(expiryDate)
  const diffMs = expiry.getTime() - now.getTime()
  
  if (diffMs <= 0) return 'Expired'
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`
  }
  return `${hours}h`
}

function getMarginBadgeVariant(margin: number): "default" | "secondary" | "destructive" | "outline" {
  if (margin >= 50) return "default"  // Green/primary for excellent margins
  if (margin >= 20) return "secondary"
  return "outline"
}

// ============================================================================
// Item Row Component
// ============================================================================

function ContractItemRow({ item }: { item: ContractItemWithPrice }) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50">
      <EveItemIcon typeId={item.type_id} size={32} className="size-6" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          {item.type_name}
          {item.is_blueprint_copy && (
            <Badge variant="outline" className="ml-2 text-xs">BPC</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {item.quantity.toLocaleString()} × {formatIskShort(item.jita_buy_price)}
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium text-sm">{formatIskShort(item.total_jita_value)}</div>
      </div>
    </div>
  )
}

// ============================================================================
// Expanded Row Component
// ============================================================================

function ExpandedContractRow({ opportunity }: { opportunity: ContractOpportunity }) {
  const [copied, setCopied] = useState(false)

  const handleCopyContractId = async () => {
    await navigator.clipboard.writeText(String(opportunity.contract_id))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Sort items by value (highest first)
  const sortedItems = [...opportunity.items].sort((a, b) => b.total_jita_value - a.total_jita_value)

  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={6} className="p-4">
        <div className="space-y-4">
          {/* Contract Details */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Contract ID:</span>{" "}
              <span className="font-mono">{opportunity.contract_id}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-1"
                onClick={handleCopyContractId}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <div>
              <span className="text-muted-foreground">Issued:</span>{" "}
              {formatDate(opportunity.date_issued)}
            </div>
            <div>
              <span className="text-muted-foreground">Expires:</span>{" "}
              {timeUntilExpiry(opportunity.date_expired)}
            </div>
            {opportunity.volume && (
              <div>
                <span className="text-muted-foreground">Volume:</span>{" "}
                {opportunity.volume.toLocaleString()} m³
              </div>
            )}
            {opportunity.items_missing_price > 0 && (
              <Badge variant="outline" className="text-amber-600">
                {opportunity.items_missing_price} items not priced
              </Badge>
            )}
          </div>

          {/* Pricing Breakdown */}
          <div className="grid grid-cols-3 gap-4 p-3 rounded-lg bg-background border">
            <div>
              <div className="text-xs text-muted-foreground">Contract Price</div>
              <div className="text-lg font-semibold">{formatIskShort(opportunity.contract_price)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Jita Value</div>
              <div className="text-lg font-semibold">{formatIskShort(opportunity.total_jita_value)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Your Profit</div>
              <div className="text-lg font-semibold text-green-600">
                +{formatIskShort(opportunity.profit)}
              </div>
            </div>
          </div>

          {/* Items List */}
          <div>
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Items ({opportunity.item_count})
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-lg bg-background">
              <div className="divide-y">
                {sortedItems.map((item, idx) => (
                  <ContractItemRow key={`${item.type_id}-${idx}`} item={item} />
                ))}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a
                href={`https://evemarketer.com/contract/${opportunity.contract_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                View on EVE Marketer
              </a>
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ============================================================================
// Main Table Component
// ============================================================================

export function ContractsTable({ opportunities }: ContractsTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('profit_margin')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  // Sort opportunities
  const sortedOpportunities = useMemo(() => {
    return [...opportunities].sort((a, b) => {
      let aValue: number
      let bValue: number

      switch (sortKey) {
        case 'profit_margin':
          aValue = a.profit_margin
          bValue = b.profit_margin
          break
        case 'profit':
          aValue = a.profit
          bValue = b.profit
          break
        case 'contract_price':
          aValue = a.contract_price
          bValue = b.contract_price
          break
        case 'item_count':
          aValue = a.item_count
          bValue = b.item_count
          break
        case 'date_issued':
          aValue = new Date(a.date_issued).getTime()
          bValue = new Date(b.date_issued).getTime()
          break
        default:
          return 0
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    })
  }, [opportunities, sortKey, sortDirection])

  // Paginate
  const totalPages = Math.ceil(sortedOpportunities.length / itemsPerPage)
  const paginatedOpportunities = sortedOpportunities.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Handle sort
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
    setCurrentPage(1)
  }

  // Handle expand/collapse
  const toggleExpand = (contractId: number) => {
    setExpandedId(prev => prev === contractId ? null : contractId)
  }

  // Sortable header component
  const SortableHeader = ({ label, sortKeyValue }: { label: string; sortKeyValue: SortKey }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(sortKeyValue)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === sortKeyValue && (
          <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </TableHead>
  )

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <SortableHeader label="Margin" sortKeyValue="profit_margin" />
              <SortableHeader label="Profit" sortKeyValue="profit" />
              <SortableHeader label="Price" sortKeyValue="contract_price" />
              <SortableHeader label="Items" sortKeyValue="item_count" />
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOpportunities.map((opportunity) => (
              <>
                <TableRow
                  key={opportunity.contract_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleExpand(opportunity.contract_id)}
                >
                  <TableCell>
                    {expandedId === opportunity.contract_id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getMarginBadgeVariant(opportunity.profit_margin)}>
                      {opportunity.profit_margin.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-green-600">
                    +{formatIskShort(opportunity.profit)}
                  </TableCell>
                  <TableCell>{formatIskShort(opportunity.contract_price)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{opportunity.item_count}</span>
                      <span className="text-xs text-muted-foreground">
                        ({opportunity.total_quantity.toLocaleString()} units)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {timeUntilExpiry(opportunity.date_expired)}
                  </TableCell>
                </TableRow>
                {expandedId === opportunity.contract_id && (
                  <ExpandedContractRow opportunity={opportunity} />
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, opportunities.length)} of {opportunities.length} contracts
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

