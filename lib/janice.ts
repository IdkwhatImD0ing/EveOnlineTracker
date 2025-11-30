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

function getApiKey(): string {
  const apiKey = process.env.JANICE_API_KEY
  if (!apiKey) {
    throw new Error('JANICE_API_KEY environment variable is required')
  }
  return apiKey
}

/**
 * Create an appraisal from raw text input (Eve Online inventory format)
 * @param input - Raw text with item names and quantities
 * @param persist - Whether to save the appraisal (default: false)
 * @returns Parsed appraisal result with items and prices
 */
export async function createAppraisal(
  input: string,
  persist: boolean = false
): Promise<AppraisalResult> {
  const apiKey = getApiKey()

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
    throw new Error(`Janice API error (${response.status}): ${errorText}`)
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
}

/**
 * Get an existing appraisal by code
 * @param code - Appraisal code (e.g., 'mg6Zuw')
 * @returns Appraisal data or null if unavailable
 */
export async function getAppraisal(code: string): Promise<JaniceAppraisal | null> {
  const apiKey = getApiKey()

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
