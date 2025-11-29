/**
 * Janice API client for Eve Online item appraisals
 * API Documentation: https://janice.e-351.com/api/rest/docs/index.html
 */

const JANICE_API_BASE = 'https://janice.e-351.com/api/rest/v2'
const JITA_MARKET_ID = 2

export interface JaniceItemType {
  eid: number
  name: string
  volume: number
  packagedVolume: number
}

export interface JaniceItemPrices {
  buyPrice: number
  splitPrice: number
  sellPrice: number
  buyPriceTotal: number
  splitPriceTotal: number
  sellPriceTotal: number
}

export interface JaniceAppraisalItem {
  id: number
  amount: number
  buyOrderCount: number
  buyVolume: number
  sellOrderCount: number
  sellVolume: number
  effectivePrices: JaniceItemPrices
  immediatePrices: JaniceItemPrices
  top5AveragePrices: JaniceItemPrices
  totalVolume: number
  totalPackagedVolume: number
  itemType: JaniceItemType
}

export interface JaniceAppraisalValues {
  totalBuyPrice: number
  totalSplitPrice: number
  totalSellPrice: number
}

export interface JaniceMarket {
  id: number
  name: string
}

export interface JaniceAppraisal {
  id: number
  created: string
  expires: string
  datasetTime: string
  code: string | null
  designation: 'appraisal' | 'wtb' | 'wts'
  pricing: 'buy' | 'split' | 'sell' | 'purchase'
  pricingVariant: 'immediate' | 'top5percent'
  pricePercentage: number
  comment: string | null
  isCompactized: boolean
  input: string | null
  failures: string | null
  market: JaniceMarket
  totalVolume: number
  totalPackagedVolume: number
  effectivePrices: JaniceAppraisalValues
  immediatePrices: JaniceAppraisalValues
  top5AveragePrices: JaniceAppraisalValues
  items: JaniceAppraisalItem[] | null
}

export interface ParsedItem {
  itemName: string
  typeId: number
  quantity: number
  buyPrice: number
  sellPrice: number
  splitPrice: number
  volume: number
  itemType: string | null
}

export interface AppraisalResult {
  items: ParsedItem[]
  totals: {
    buyPrice: number
    sellPrice: number
    splitPrice: number
  }
  failures: string | null
}

function getApiKey(): string | null {
  return process.env.JANICE_API_KEY || null
}

/**
 * Parse items from raw text without API (fallback when Janice is unavailable)
 * Supports multiple Eve Online formats:
 * - Tab-separated inventory export: "Item Name\tQuantity\tVolume\tBuy\tSell\t..."
 * - Simple format: "Item Name 100" or "Item Name\t100"
 * - Multi-line format: Item name on one line, quantity on the next
 */
function parseItemsLocally(input: string): ParsedItem[] {
  const lines = input.trim().split('\n')
  const items: ParsedItem[] = []

  // Common header patterns to skip
  const headerPatterns = [
    /^item\s/i,
    /^name\s/i,
    /quantity.*volume/i,
    /buy.*sell/i,
  ]

  // Check if a string is just numbers (with optional commas, spaces, decimals)
  const isNumberOnly = (str: string) => /^[\d\s,.]+$/.test(str)

  // Track pending item name for multi-line format
  let pendingItemName: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue

    // Skip header lines
    if (headerPatterns.some(pattern => pattern.test(trimmed))) {
      continue
    }

    // Try tab-separated format first (Eve Online inventory/market export)
    // Two formats:
    // With Type: Item | Qty | Volume | Type | Buy | Sell | TotalBuy | TotalSell
    // Without Type: Item | Qty | Volume | Buy | Sell | TotalBuy | TotalSell
    const tabParts = trimmed.split('\t')

    if (tabParts.length >= 2) {
      const itemName = tabParts[0].trim()
      // Second column is quantity - may contain commas or be a plain number
      const quantityStr = tabParts[1].trim().replace(/,/g, '')
      const quantity = parseInt(quantityStr, 10)

      // Parse a price string (handles commas and decimals)
      const parsePrice = (str: string): number => {
        const cleaned = str.trim().replace(/,/g, '')
        const num = parseFloat(cleaned)
        return isNaN(num) ? 0 : num
      }

      // Detect if column 3 is Type (has letters) or Buy price (numbers only)
      let itemType: string | null = null
      let buyPrice = 0
      let sellPrice = 0

      if (tabParts.length >= 4) {
        const col3 = tabParts[3].trim()

        // If column 3 contains letters, it's a Type field
        if (col3 && /[a-zA-Z]/.test(col3)) {
          itemType = col3
          // Type format: col4 = Buy, col5 = Sell
          if (tabParts.length >= 5) buyPrice = parsePrice(tabParts[4])
          if (tabParts.length >= 6) sellPrice = parsePrice(tabParts[5])
        } else {
          // No Type format: col3 = Buy, col4 = Sell
          buyPrice = parsePrice(col3)
          if (tabParts.length >= 5) sellPrice = parsePrice(tabParts[4])
        }
      }

      // Calculate split price as average of buy and sell
      const splitPrice = buyPrice > 0 && sellPrice > 0
        ? (buyPrice + sellPrice) / 2
        : buyPrice || sellPrice

      // Make sure item name isn't just numbers
      if (itemName && !isNumberOnly(itemName) && !isNaN(quantity) && quantity > 0) {
        items.push({
          itemName,
          typeId: 0,
          quantity,
          buyPrice,
          sellPrice,
          splitPrice,
          volume: 0,
          itemType,
        })
        pendingItemName = null
        continue
      }
    }

    // Try space-separated format: "ItemName Quantity"
    // Match item name followed by a number at the end
    const spaceMatch = trimmed.match(/^(.+?)\s+(\d[\d,]*)$/)

    if (spaceMatch) {
      const itemName = spaceMatch[1].trim()
      const quantity = parseInt(spaceMatch[2].replace(/,/g, ''), 10)

      if (itemName && !isNumberOnly(itemName) && !isNaN(quantity) && quantity > 0) {
        items.push({
          itemName,
          typeId: 0,
          quantity,
          buyPrice: 0,
          sellPrice: 0,
          splitPrice: 0,
          volume: 0,
          itemType: null,
        })
        pendingItemName = null
        continue
      }
    }

    // Check if this line is just a number
    if (isNumberOnly(trimmed)) {
      // If we have a pending item name, use this as its quantity
      if (pendingItemName) {
        const quantity = parseInt(trimmed.replace(/,/g, ''), 10)
        if (!isNaN(quantity) && quantity > 0) {
          items.push({
            itemName: pendingItemName,
            typeId: 0,
            quantity,
            buyPrice: 0,
            sellPrice: 0,
            splitPrice: 0,
            volume: 0,
            itemType: null,
          })
        }
        pendingItemName = null
      }
      // Otherwise skip this number line
      continue
    }

    // This line is text (potential item name)
    // If we had a pending item, add it with quantity 1 before moving on
    if (pendingItemName) {
      items.push({
        itemName: pendingItemName,
        typeId: 0,
        quantity: 1,
        buyPrice: 0,
        sellPrice: 0,
        splitPrice: 0,
        volume: 0,
        itemType: null,
      })
    }

    // Check if next line is a number (multi-line format)
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''
    if (nextLine && isNumberOnly(nextLine)) {
      // Store this as pending, quantity will come from next line
      pendingItemName = trimmed
    } else {
      // No number follows, add with quantity 1
      items.push({
        itemName: trimmed,
        typeId: 0,
        quantity: 1,
        buyPrice: 0,
        sellPrice: 0,
        splitPrice: 0,
        volume: 0,
        itemType: null,
      })
      pendingItemName = null
    }
  }

  // Don't forget any pending item at the end
  if (pendingItemName) {
    items.push({
      itemName: pendingItemName,
      typeId: 0,
      quantity: 1,
      buyPrice: 0,
      sellPrice: 0,
      splitPrice: 0,
      volume: 0,
      itemType: null,
    })
  }

  return items
}

/**
 * Create an appraisal from raw text input (Eve Online inventory format)
 * Falls back to local parsing without prices if Janice API is unavailable
 * @param input - Raw text with item names and quantities
 * @param persist - Whether to save the appraisal (default: false)
 * @returns Parsed appraisal result with items and prices (prices will be 0 if API unavailable)
 */
export async function createAppraisal(
  input: string,
  persist: boolean = false
): Promise<AppraisalResult> {
  const apiKey = getApiKey()

  // If no API key, fall back to local parsing without prices
  if (!apiKey) {
    console.warn('JANICE_API_KEY not set - items will be parsed without price data')
    const items = parseItemsLocally(input)
    return {
      items,
      totals: { buyPrice: 0, sellPrice: 0, splitPrice: 0 },
      failures: null,
    }
  }

  try {
    const params = new URLSearchParams({
      market: JITA_MARKET_ID.toString(),
      persist: persist.toString(),
      compactize: 'true',
    })

    const response = await fetch(`${JANICE_API_BASE}/appraisal?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'X-ApiKey': apiKey,
      },
      body: input,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Janice API error (${response.status}): ${errorText}`)
      // Fall back to local parsing
      const items = parseItemsLocally(input)
      return {
        items,
        totals: { buyPrice: 0, sellPrice: 0, splitPrice: 0 },
        failures: `Janice API error: ${response.status}`,
      }
    }

    const appraisal: JaniceAppraisal = await response.json()

    const items: ParsedItem[] = (appraisal.items || []).map((item) => ({
      itemName: item.itemType.name,
      typeId: item.itemType.eid,
      quantity: item.amount,
      buyPrice: item.immediatePrices.buyPrice,
      sellPrice: item.immediatePrices.sellPrice,
      splitPrice: item.immediatePrices.splitPrice,
      volume: item.itemType.volume,
      itemType: null, // Janice API doesn't provide category info
    }))

    return {
      items,
      totals: {
        buyPrice: appraisal.immediatePrices.totalBuyPrice,
        sellPrice: appraisal.immediatePrices.totalSellPrice,
        splitPrice: appraisal.immediatePrices.totalSplitPrice,
      },
      failures: appraisal.failures,
    }
  } catch (err) {
    console.error('Janice API request failed:', err)
    // Fall back to local parsing on any error
    const items = parseItemsLocally(input)
    return {
      items,
      totals: { buyPrice: 0, sellPrice: 0, splitPrice: 0 },
      failures: err instanceof Error ? err.message : 'API request failed',
    }
  }
}

/**
 * Get an existing appraisal by code
 * @param code - Appraisal code (e.g., 'mg6Zuw')
 * @returns Appraisal data or null if unavailable
 */
export async function getAppraisal(code: string): Promise<JaniceAppraisal | null> {
  const apiKey = getApiKey()

  if (!apiKey) {
    console.warn('JANICE_API_KEY not set - cannot fetch appraisal')
    return null
  }

  try {
    const response = await fetch(`${JANICE_API_BASE}/appraisal/${code}`, {
      method: 'GET',
      headers: {
        'X-ApiKey': apiKey,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Janice API error (${response.status}): ${errorText}`)
      return null
    }

    return response.json()
  } catch (err) {
    console.error('Failed to fetch appraisal:', err)
    return null
  }
}

