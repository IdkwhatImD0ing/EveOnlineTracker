/**
 * Contract Analysis API
 * 
 * Analyzes public contracts to identify profitable opportunities where
 * the Jita buy price of all items is less than the contract price.
 * 
 * GET /api/contracts/analyze
 * 
 * Query Parameters:
 *   - region_id (optional): Region ID to search contracts in (default: 10000002 / The Forge)
 *   - min_profit (optional): Minimum profit in ISK (default: 1000000)
 *   - min_margin (optional): Minimum profit margin % (default: 5)
 *   - max_contract_price (optional): Maximum contract price to analyze
 *   - include_auctions (optional): Include auction contracts (default: false)
 *   - stream (optional): If 'true', returns Server-Sent Events with progress updates
 * 
 * Note: This endpoint uses public ESI APIs, no authentication required for ESI calls,
 * but user must be authenticated with our app.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { isApprovedRole } from '@/types/auth'
import { getCachedJitaPrices } from '@/lib/cached-data'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import type {
  ESIPublicContract,
  ESIContractItem,
  ContractOpportunity,
  ContractItemWithPrice,
  ContractAnalyzeResponse,
  ContractAnalysisSummary,
} from '@/types/contracts'
import { CONTRACT_ANALYSIS_DEFAULTS, CONTRACT_REGIONS } from '@/types/contracts'

// ============================================================================
// Types
// ============================================================================

interface TradeableItem {
  typeId: number
  name: string
  groupName: string
  categoryName: string
  volume: number
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Read tradeable items from JSONL file to get item names
 */
async function loadItemNames(): Promise<Map<number, TradeableItem>> {
  const filePath = path.join(process.cwd(), 'data', 'tradeable-items.jsonl')
  const items = new Map<number, TradeableItem>()

  if (!fs.existsSync(filePath)) {
    console.warn('[Contracts] Tradeable items file not found')
    return items
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const item = JSON.parse(line) as TradeableItem
        items.set(item.typeId, item)
      } catch {
        // Skip invalid lines
      }
    }
  }

  return items
}

/**
 * Format ISK value with proper formatting
 */
function formatISK(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T ISK`
  } else if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B ISK`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M ISK`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K ISK`
  }
  return `${value.toFixed(2)} ISK`
}

/**
 * SSE Helper: Send an event to the stream
 */
function sendSSEEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: string,
  data: unknown
) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  controller.enqueue(encoder.encode(message))
}

/**
 * Fetch public contracts for a region from ESI
 */
async function fetchPublicContracts(regionId: number): Promise<ESIPublicContract[]> {
  const allContracts: ESIPublicContract[] = []
  let page = 1
  let totalPages = 1

  do {
    const response = await fetch(
      `https://esi.evetech.net/latest/contracts/public/${regionId}/?page=${page}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Compatibility-Date': '2025-12-16',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        // No contracts in this region
        break
      }
      throw new Error(`ESI error (${response.status}): Failed to fetch contracts`)
    }

    const contracts: ESIPublicContract[] = await response.json()
    allContracts.push(...contracts)

    const pagesHeader = response.headers.get('x-pages')
    totalPages = pagesHeader ? parseInt(pagesHeader) : 1
    page++
  } while (page <= totalPages)

  return allContracts
}

/**
 * Fetch items for a specific contract from ESI
 */
async function fetchContractItems(contractId: number): Promise<ESIContractItem[]> {
  const allItems: ESIContractItem[] = []
  let page = 1
  let totalPages = 1

  do {
    const response = await fetch(
      `https://esi.evetech.net/latest/contracts/public/items/${contractId}/?page=${page}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Compatibility-Date': '2025-12-16',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 204) {
        // No items (empty contract)
        break
      }
      if (response.status === 404) {
        // Contract not found or expired
        break
      }
      // For other errors, just skip this contract
      console.warn(`[Contracts] Failed to fetch items for contract ${contractId}: ${response.status}`)
      break
    }

    const items: ESIContractItem[] = await response.json()
    allItems.push(...items)

    const pagesHeader = response.headers.get('x-pages')
    totalPages = pagesHeader ? parseInt(pagesHeader) : 1
    page++
  } while (page <= totalPages)

  return allItems
}

/**
 * Handle streaming request with Server-Sent Events
 */
async function handleStreamingRequest(
  params: {
    regionId: number
    minProfit: number
    minMargin: number
    maxContractPrice: number | null
    includeAuctions: boolean
    startTime: number
  }
) {
  const { regionId, minProfit, minMargin, maxContractPrice, includeAuctions, startTime } = params
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stage 1: Fetch contracts
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'contracts',
          message: 'Fetching public contracts...',
          percent: 5,
        })

        const contractsFetchStart = Date.now()
        const allContracts = await fetchPublicContracts(regionId)
        const contractsFetchTime = Date.now() - contractsFetchStart

        // Filter to item_exchange (and optionally auctions) with valid price
        const validTypes = new Set(['item_exchange'])
        if (includeAuctions) validTypes.add('auction')

        let filteredContracts = allContracts.filter(c => 
          validTypes.has(c.type) && 
          (c.price !== undefined && c.price > 0)
        )

        // Apply max price filter
        if (maxContractPrice !== null) {
          filteredContracts = filteredContracts.filter(c => (c.price || 0) <= maxContractPrice)
        }

        // Limit for performance
        const contractsToAnalyze = filteredContracts.slice(0, CONTRACT_ANALYSIS_DEFAULTS.MAX_CONTRACTS_TO_ANALYZE)

        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'contracts',
          message: `Found ${allContracts.length} contracts, analyzing ${contractsToAnalyze.length}...`,
          percent: 15,
        })

        // Stage 2: Fetch items for each contract
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'items',
          message: 'Fetching contract items...',
          percent: 20,
          current: 0,
          total: contractsToAnalyze.length,
        })

        const itemsFetchStart = Date.now()
        const contractItems = new Map<number, ESIContractItem[]>()
        const allTypeIds = new Set<number>()
        
        // Process in batches for better performance
        const BATCH_SIZE = CONTRACT_ANALYSIS_DEFAULTS.BATCH_SIZE
        for (let i = 0; i < contractsToAnalyze.length; i += BATCH_SIZE) {
          const batch = contractsToAnalyze.slice(i, i + BATCH_SIZE)
          
          const batchResults = await Promise.all(
            batch.map(async (contract) => {
              const items = await fetchContractItems(contract.contract_id)
              return { contractId: contract.contract_id, items }
            })
          )

          for (const { contractId, items } of batchResults) {
            contractItems.set(contractId, items)
            for (const item of items) {
              if (item.is_included) {
                allTypeIds.add(item.type_id)
              }
            }
          }

          // Progress update
          const progressPercent = 20 + Math.floor((i / contractsToAnalyze.length) * 40)
          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'items',
            message: `Fetched items for ${Math.min(i + BATCH_SIZE, contractsToAnalyze.length)}/${contractsToAnalyze.length} contracts...`,
            percent: progressPercent,
            current: Math.min(i + BATCH_SIZE, contractsToAnalyze.length),
            total: contractsToAnalyze.length,
          })
        }
        const itemsFetchTime = Date.now() - itemsFetchStart

        // Stage 3: Fetch Jita prices
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'prices',
          message: `Fetching Jita prices for ${allTypeIds.size} item types...`,
          percent: 65,
        })

        const pricesFetchStart = Date.now()
        const jitaPrices = await getCachedJitaPrices(Array.from(allTypeIds))
        const pricesFetchTime = Date.now() - pricesFetchStart

        // Stage 4: Load item names
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'analyzing',
          message: 'Loading item data...',
          percent: 75,
        })

        const itemNames = await loadItemNames()

        // Stage 5: Analyze contracts
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'analyzing',
          message: 'Calculating profit opportunities...',
          percent: 80,
        })

        const analysisStart = Date.now()
        const opportunities: ContractOpportunity[] = []

        for (const contract of contractsToAnalyze) {
          const items = contractItems.get(contract.contract_id) || []
          if (items.length === 0) continue

          // Only consider items the seller is including (is_included = true)
          const includedItems = items.filter(item => item.is_included)
          if (includedItems.length === 0) continue

          // Calculate total Jita value
          let totalJitaValue = 0
          let itemsPriced = 0
          let itemsMissingPrice = 0
          let totalQuantity = 0

          const contractItemsWithPrice: ContractItemWithPrice[] = []

          for (const item of includedItems) {
            const jitaPrice = jitaPrices.get(item.type_id)
            const itemInfo = itemNames.get(item.type_id)
            
            if (jitaPrice) {
              const unitPrice = jitaPrice.lowestSellPrice
              const totalItemValue = unitPrice * item.quantity
              totalJitaValue += totalItemValue
              itemsPriced++

              contractItemsWithPrice.push({
                type_id: item.type_id,
                type_name: itemInfo?.name || `Unknown (${item.type_id})`,
                quantity: item.quantity,
                is_included: item.is_included,
                is_blueprint_copy: item.is_blueprint_copy,
                jita_buy_price: unitPrice,
                total_jita_value: totalItemValue,
              })
            } else {
              itemsMissingPrice++
              contractItemsWithPrice.push({
                type_id: item.type_id,
                type_name: itemInfo?.name || `Unknown (${item.type_id})`,
                quantity: item.quantity,
                is_included: item.is_included,
                is_blueprint_copy: item.is_blueprint_copy,
                jita_buy_price: 0,
                total_jita_value: 0,
              })
            }
            totalQuantity += item.quantity
          }

          // Skip contracts where we couldn't price most items
          if (itemsPriced === 0 || itemsMissingPrice > itemsPriced) continue

          const contractPrice = contract.price || 0
          // Profit is negative when it's a good deal (you pay less than Jita value)
          // We want to find contracts where contractPrice < totalJitaValue
          const profit = totalJitaValue - contractPrice
          const profitMargin = totalJitaValue > 0 ? (profit / contractPrice) * 100 : 0

          // Filter by minimum profit and margin
          if (profit >= minProfit && profitMargin >= minMargin) {
            opportunities.push({
              contract_id: contract.contract_id,
              type: contract.type as 'item_exchange' | 'auction',
              title: contract.title || null,
              contract_price: contractPrice,
              total_jita_value: totalJitaValue,
              profit,
              profit_margin: profitMargin,
              issuer_id: contract.issuer_id,
              issuer_corporation_id: contract.issuer_corporation_id,
              for_corporation: contract.for_corporation,
              date_issued: contract.date_issued,
              date_expired: contract.date_expired,
              volume: contract.volume || null,
              start_location_id: contract.start_location_id || null,
              items: contractItemsWithPrice,
              item_count: includedItems.length,
              total_quantity: totalQuantity,
              items_priced: itemsPriced,
              items_missing_price: itemsMissingPrice,
            })
          }
        }

        // Sort by profit margin (highest first)
        opportunities.sort((a, b) => b.profit_margin - a.profit_margin)

        const analysisTime = Date.now() - analysisStart
        const totalTime = Date.now() - startTime

        // Build summary
        const summary: ContractAnalysisSummary = {
          total_contracts_fetched: allContracts.length,
          item_exchange_contracts: filteredContracts.length,
          contracts_analyzed: contractsToAnalyze.length,
          profitable_contracts: opportunities.length,
          avg_profit_margin: opportunities.length > 0
            ? opportunities.reduce((sum, o) => sum + o.profit_margin, 0) / opportunities.length
            : 0,
          total_potential_profit: opportunities.reduce((sum, o) => sum + o.profit, 0),
        }

        // Get region name
        const regionInfo = CONTRACT_REGIONS.find(r => r.id === regionId)
        const regionName = regionInfo?.name || `Region ${regionId}`

        // Build response
        const response: ContractAnalyzeResponse = {
          success: true,
          generated_at: new Date().toISOString(),
          region_id: regionId,
          region_name: regionName,
          summary,
          opportunities,
          config: {
            min_profit: minProfit,
            min_margin: minMargin,
            max_contract_price: maxContractPrice,
            include_auctions: includeAuctions,
          },
          timing: {
            contracts_fetch_ms: contractsFetchTime,
            items_fetch_ms: itemsFetchTime,
            jita_prices_ms: pricesFetchTime,
            analysis_ms: analysisTime,
            total_ms: totalTime,
          },
        }

        // Send final results
        sendSSEEvent(controller, encoder, 'complete', response)
        controller.close()

      } catch (error) {
        console.error('[Contracts SSE] Error:', error)
        sendSSEEvent(controller, encoder, 'error', {
          message: error instanceof Error ? error.message : 'An unexpected error occurred'
        })
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const session = await getAuthenticatedUser(request)

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!isApprovedRole(session.user.role)) {
    return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
  }

  // Rate limiting
  const rateLimitResult = await checkRateLimit(session.user.id, session.user.role)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }

  const searchParams = request.nextUrl.searchParams
  const startTime = Date.now()

  // Parse parameters
  const regionId = parseInt(searchParams.get('region_id') || String(CONTRACT_ANALYSIS_DEFAULTS.REGION_ID))
  const minProfit = parseInt(searchParams.get('min_profit') || String(CONTRACT_ANALYSIS_DEFAULTS.MIN_PROFIT))
  const minMargin = parseFloat(searchParams.get('min_margin') || String(CONTRACT_ANALYSIS_DEFAULTS.MIN_MARGIN))
  const maxContractPriceParam = searchParams.get('max_contract_price')
  const maxContractPrice = maxContractPriceParam ? parseInt(maxContractPriceParam) : null
  const includeAuctions = searchParams.get('include_auctions') === 'true'
  const stream = searchParams.get('stream') === 'true'

  // Validate region
  if (isNaN(regionId) || regionId <= 0) {
    return NextResponse.json(
      { error: 'Invalid region_id parameter' },
      { status: 400 }
    )
  }

  if (stream) {
    return handleStreamingRequest({
      regionId,
      minProfit,
      minMargin,
      maxContractPrice,
      includeAuctions,
      startTime,
    })
  }

  // Non-streaming response (basic version without progress)
  try {
    const allContracts = await fetchPublicContracts(regionId)
    
    // Filter contracts
    const validTypes = new Set(['item_exchange'])
    if (includeAuctions) validTypes.add('auction')

    let filteredContracts = allContracts.filter(c => 
      validTypes.has(c.type) && 
      (c.price !== undefined && c.price > 0)
    )

    if (maxContractPrice !== null) {
      filteredContracts = filteredContracts.filter(c => (c.price || 0) <= maxContractPrice)
    }

    const contractsToAnalyze = filteredContracts.slice(0, CONTRACT_ANALYSIS_DEFAULTS.MAX_CONTRACTS_TO_ANALYZE)

    // Fetch items for contracts
    const contractItems = new Map<number, ESIContractItem[]>()
    const allTypeIds = new Set<number>()

    for (const contract of contractsToAnalyze) {
      const items = await fetchContractItems(contract.contract_id)
      contractItems.set(contract.contract_id, items)
      for (const item of items) {
        if (item.is_included) {
          allTypeIds.add(item.type_id)
        }
      }
    }

    // Fetch Jita prices
    const jitaPrices = await getCachedJitaPrices(Array.from(allTypeIds))
    const itemNames = await loadItemNames()

    // Analyze contracts (same logic as streaming)
    const opportunities: ContractOpportunity[] = []

    for (const contract of contractsToAnalyze) {
      const items = contractItems.get(contract.contract_id) || []
      const includedItems = items.filter(item => item.is_included)
      if (includedItems.length === 0) continue

      let totalJitaValue = 0
      let itemsPriced = 0
      let itemsMissingPrice = 0
      let totalQuantity = 0
      const contractItemsWithPrice: ContractItemWithPrice[] = []

      for (const item of includedItems) {
        const jitaPrice = jitaPrices.get(item.type_id)
        const itemInfo = itemNames.get(item.type_id)
        
        if (jitaPrice) {
          const unitPrice = jitaPrice.lowestSellPrice
          totalJitaValue += unitPrice * item.quantity
          itemsPriced++
          contractItemsWithPrice.push({
            type_id: item.type_id,
            type_name: itemInfo?.name || `Unknown (${item.type_id})`,
            quantity: item.quantity,
            is_included: item.is_included,
            is_blueprint_copy: item.is_blueprint_copy,
            jita_buy_price: unitPrice,
            total_jita_value: unitPrice * item.quantity,
          })
        } else {
          itemsMissingPrice++
          contractItemsWithPrice.push({
            type_id: item.type_id,
            type_name: itemInfo?.name || `Unknown (${item.type_id})`,
            quantity: item.quantity,
            is_included: item.is_included,
            is_blueprint_copy: item.is_blueprint_copy,
            jita_buy_price: 0,
            total_jita_value: 0,
          })
        }
        totalQuantity += item.quantity
      }

      if (itemsPriced === 0 || itemsMissingPrice > itemsPriced) continue

      const contractPrice = contract.price || 0
      const profit = totalJitaValue - contractPrice
      const profitMargin = totalJitaValue > 0 ? (profit / contractPrice) * 100 : 0

      if (profit >= minProfit && profitMargin >= minMargin) {
        opportunities.push({
          contract_id: contract.contract_id,
          type: contract.type as 'item_exchange' | 'auction',
          title: contract.title || null,
          contract_price: contractPrice,
          total_jita_value: totalJitaValue,
          profit,
          profit_margin: profitMargin,
          issuer_id: contract.issuer_id,
          issuer_corporation_id: contract.issuer_corporation_id,
          for_corporation: contract.for_corporation,
          date_issued: contract.date_issued,
          date_expired: contract.date_expired,
          volume: contract.volume || null,
          start_location_id: contract.start_location_id || null,
          items: contractItemsWithPrice,
          item_count: includedItems.length,
          total_quantity: totalQuantity,
          items_priced: itemsPriced,
          items_missing_price: itemsMissingPrice,
        })
      }
    }

    opportunities.sort((a, b) => b.profit_margin - a.profit_margin)

    const regionInfo = CONTRACT_REGIONS.find(r => r.id === regionId)

    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      region_id: regionId,
      region_name: regionInfo?.name || `Region ${regionId}`,
      summary: {
        total_contracts_fetched: allContracts.length,
        item_exchange_contracts: filteredContracts.length,
        contracts_analyzed: contractsToAnalyze.length,
        profitable_contracts: opportunities.length,
        avg_profit_margin: opportunities.length > 0
          ? opportunities.reduce((sum, o) => sum + o.profit_margin, 0) / opportunities.length
          : 0,
        total_potential_profit: opportunities.reduce((sum, o) => sum + o.profit, 0),
      },
      opportunities,
      config: {
        min_profit: minProfit,
        min_margin: minMargin,
        max_contract_price: maxContractPrice,
        include_auctions: includeAuctions,
      },
      timing: {
        total_ms: Date.now() - startTime,
      },
    } as ContractAnalyzeResponse)

  } catch (error) {
    console.error('[Contracts] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      },
      { status: 500 }
    )
  }
}

