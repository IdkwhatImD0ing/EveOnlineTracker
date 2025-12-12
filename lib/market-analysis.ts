/**
 * Multi-Signal Market Analysis Library
 * 
 * Implements a combined signal analysis system using:
 * - Cyclical Analysis (autocorrelation, phase detection)
 * - Trend Analysis (moving averages, momentum)
 * - Support Level Detection (price floors)
 * - Volume-Price Analysis (accumulation/distribution)
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

export const CONFIG = {
  // Data Requirements
  MIN_DATA_POINTS: 30,           // Minimum days of history for analysis
  LOOKBACK_DAYS: 365,            // Historical window
  
  // Filter Thresholds
  MIN_DAILY_VOLUME: 10,          // Minimum units traded/day
  MAX_VOLATILITY: 0.5,           // Max std_dev/mean ratio
  MIN_PRICE: 1000,               // Filter out low-value items
  
  // Signal Thresholds
  AUTOCORR_STRONG: 0.5,          // Strong cyclical pattern threshold
  AUTOCORR_WEAK: 0.3,            // Weak cyclical pattern threshold
  SUPPORT_PROXIMITY: 0.10,       // Within 10% of support level
  SUPPORT_MIN_BOUNCES: 2,        // Minimum touches for valid support
  VOLUME_SPIKE_THRESHOLD: 3,     // 3x average = volume spike
  
  // Scoring Weights (can be tuned)
  WEIGHTS: {
    CYCLE: 30,      // Max points from cycle signal
    TREND: 25,      // Max points from trend signal
    SUPPORT: 25,    // Max points from support signal
    VOLUME: 20,     // Max points from volume signal
  },
  
  // Output Settings
  TOP_RESULTS: 50,
  MAX_ITEMS_TO_ANALYZE: 5000,
  
  // ESI Rate Limiting
  CONCURRENT_ESI_REQUESTS: 50,
  ESI_BATCH_DELAY_MS: 50,
}

// Opportunity tier thresholds
export const OPPORTUNITY_TIERS = {
  EXCELLENT: 70,
  GOOD: 40,
  MARGINAL: 20,
}

// =============================================================================
// TYPES
// =============================================================================

export interface MarketHistoryEntry {
  type_id: number
  date: string
  average: number
  highest: number
  lowest: number
  order_count: number
  volume: number
}

export interface PriceDataPoint {
  date: string
  price: number
  volume: number
  high: number
  low: number
}

export interface ItemStatistics {
  typeId: number
  itemName: string
  mean: number
  stdDev: number
  avgVolume: number
  volatility: number
  dataPoints: number
  priceHistory: PriceDataPoint[]  // Full history for signal analysis
}

export interface SignalScore {
  score: number           // Points awarded (-30 to +30 typically)
  reason: string          // Human-readable explanation
  confidence: number      // 0-1 confidence in the signal
}

export interface SignalBreakdown {
  cycle: SignalScore
  trend: SignalScore
  support: SignalScore
  volume: SignalScore
  totalScore: number
  tier: 'excellent' | 'good' | 'marginal' | 'skip'
}

export interface MarketOpportunity {
  typeId: number
  itemName: string
  currentPrice: number
  avgPrice: number
  dailyVolume: number
  volatility: number
  
  // Signal Analysis
  signals: SignalBreakdown
  
  // ISK Profit Potential
  dailyIskPotential: number    // Potential ISK profit per day
  weeklyIskPotential: number   // Potential ISK profit per week
  iskScore: number             // ISK-based score component (0-100)
  
  // Legacy fields for compatibility
  zScore: number
  potentialGain: number
  opportunityScore: number
  confidence: 'high' | 'medium' | 'low'
  momentum: number
}

// =============================================================================
// BASIC MATH UTILITIES
// =============================================================================

export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

export function calculateStdDev(values: number[], mean?: number): number {
  if (values.length < 2) return 0
  const avg = mean ?? calculateMean(values)
  const squaredDiffs = values.map(val => Math.pow(val - avg, 2))
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  return Math.sqrt(variance)
}

export function calculateVolatility(stdDev: number, mean: number): number {
  if (mean === 0) return Infinity
  return stdDev / mean
}

export function calculateZScore(currentPrice: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0
  return (currentPrice - mean) / stdDev
}

export function calculatePotentialGain(currentPrice: number, mean: number): number {
  if (currentPrice === 0) return 0
  return ((mean - currentPrice) / currentPrice) * 100
}

// =============================================================================
// SIGNAL 1: CYCLICAL ANALYSIS
// =============================================================================

/**
 * Calculate autocorrelation at a specific lag
 * Measures how correlated the price is with itself N days ago
 * High autocorrelation at lag N suggests an N-day cycle
 */
export function calculateAutocorrelation(prices: number[], lag: number): number {
  if (prices.length <= lag) return 0
  
  const n = prices.length - lag
  const mean = calculateMean(prices)
  
  let numerator = 0
  let denominator = 0
  
  for (let i = 0; i < n; i++) {
    numerator += (prices[i] - mean) * (prices[i + lag] - mean)
  }
  
  for (let i = 0; i < prices.length; i++) {
    denominator += Math.pow(prices[i] - mean, 2)
  }
  
  if (denominator === 0) return 0
  return numerator / denominator
}

/**
 * Detect cyclical patterns by testing multiple lag periods
 * Returns the strongest cycle period and its correlation strength
 */
export function detectCyclicalPattern(prices: number[]): { 
  period: number | null
  strength: number 
  phase: 'low' | 'high' | 'rising' | 'falling' | 'none'
} {
  if (prices.length < 30) {
    return { period: null, strength: 0, phase: 'none' }
  }
  
  // Test common cycle periods
  const lagTests = [7, 14, 21, 28, 30, 45, 60]
  let bestLag = 0
  let bestCorr = 0
  
  for (const lag of lagTests) {
    if (prices.length > lag * 2) {
      const corr = calculateAutocorrelation(prices, lag)
      if (corr > bestCorr) {
        bestCorr = corr
        bestLag = lag
      }
    }
  }
  
  // No significant cycle found
  if (bestCorr < CONFIG.AUTOCORR_WEAK) {
    return { period: null, strength: bestCorr, phase: 'none' }
  }
  
  // Determine current phase in the cycle
  const phase = detectCyclePhase(prices, bestLag)
  
  return { 
    period: bestLag, 
    strength: bestCorr,
    phase 
  }
}

/**
 * Determine where we are in the detected cycle
 */
function detectCyclePhase(prices: number[], period: number): 'low' | 'high' | 'rising' | 'falling' {
  if (prices.length < period) return 'low'
  
  const recentPrices = prices.slice(-period)
  const currentPrice = prices[prices.length - 1]
  const cycleMin = Math.min(...recentPrices)
  const cycleMax = Math.max(...recentPrices)
  const cycleRange = cycleMax - cycleMin
  
  if (cycleRange === 0) return 'low'
  
  // Position in cycle (0 = bottom, 1 = top)
  const position = (currentPrice - cycleMin) / cycleRange
  
  // Check recent trend (last 5 days)
  const recent5 = prices.slice(-5)
  const trend = recent5.length >= 2 
    ? (recent5[recent5.length - 1] - recent5[0]) / recent5[0]
    : 0
  
  if (position < 0.3) {
    return trend > 0.02 ? 'rising' : 'low'
  } else if (position > 0.7) {
    return trend < -0.02 ? 'falling' : 'high'
  } else {
    return trend > 0 ? 'rising' : 'falling'
  }
}

/**
 * Calculate cycle signal score
 */
export function calculateCycleSignal(prices: number[]): SignalScore {
  const cycle = detectCyclicalPattern(prices)
  
  if (cycle.phase === 'none' || cycle.strength < CONFIG.AUTOCORR_WEAK) {
    return {
      score: 0,
      reason: 'No clear cyclical pattern detected',
      confidence: 0.3
    }
  }
  
  const isStrong = cycle.strength >= CONFIG.AUTOCORR_STRONG
  const maxScore = CONFIG.WEIGHTS.CYCLE
  
  switch (cycle.phase) {
    case 'low':
      return {
        score: isStrong ? maxScore : maxScore * 0.6,
        reason: `In low phase of ${cycle.period}-day cycle (${(cycle.strength * 100).toFixed(0)}% correlation)`,
        confidence: cycle.strength
      }
    case 'rising':
      return {
        score: isStrong ? maxScore * 0.7 : maxScore * 0.4,
        reason: `Rising from low in ${cycle.period}-day cycle`,
        confidence: cycle.strength * 0.9
      }
    case 'falling':
      return {
        score: isStrong ? -maxScore * 0.3 : 0,
        reason: `Falling in ${cycle.period}-day cycle - may go lower`,
        confidence: cycle.strength * 0.7
      }
    case 'high':
      return {
        score: -maxScore * 0.7,
        reason: `Near high of ${cycle.period}-day cycle - expect decline`,
        confidence: cycle.strength
      }
    default:
      return { score: 0, reason: 'Unknown phase', confidence: 0 }
  }
}

// =============================================================================
// SIGNAL 2: TREND ANALYSIS
// =============================================================================

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(prices: number[], period: number): number[] {
  const sma: number[] = []
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(NaN)
    } else {
      const slice = prices.slice(i - period + 1, i + 1)
      sma.push(calculateMean(slice))
    }
  }
  return sma
}

/**
 * Calculate Rate of Change (momentum indicator)
 */
export function calculateROC(prices: number[], period: number = 14): number {
  if (prices.length <= period) return 0
  const current = prices[prices.length - 1]
  const past = prices[prices.length - 1 - period]
  if (past === 0) return 0
  return (current - past) / past
}

/**
 * Detect trend direction and strength using moving averages
 */
export function analyzeTrend(prices: number[]): {
  direction: 'uptrend' | 'downtrend' | 'sideways'
  strength: number
  crossover: 'bullish' | 'bearish' | 'none'
  momentum: number
} {
  if (prices.length < 30) {
    return { direction: 'sideways', strength: 0, crossover: 'none', momentum: 0 }
  }
  
  const sma7 = calculateSMA(prices, 7)
  const sma30 = calculateSMA(prices, 30)
  
  // Get recent values (last valid)
  const recentSMA7 = sma7.filter(v => !isNaN(v)).slice(-5)
  const recentSMA30 = sma30.filter(v => !isNaN(v)).slice(-5)
  
  if (recentSMA7.length < 2 || recentSMA30.length < 2) {
    return { direction: 'sideways', strength: 0, crossover: 'none', momentum: 0 }
  }
  
  const currentSMA7 = recentSMA7[recentSMA7.length - 1]
  const currentSMA30 = recentSMA30[recentSMA30.length - 1]
  const prevSMA7 = recentSMA7[recentSMA7.length - 2]
  const prevSMA30 = recentSMA30[recentSMA30.length - 2]
  
  // Check for crossover
  let crossover: 'bullish' | 'bearish' | 'none' = 'none'
  if (prevSMA7 <= prevSMA30 && currentSMA7 > currentSMA30) {
    crossover = 'bullish' // Golden cross
  } else if (prevSMA7 >= prevSMA30 && currentSMA7 < currentSMA30) {
    crossover = 'bearish' // Death cross
  }
  
  // Determine direction
  const diff = (currentSMA7 - currentSMA30) / currentSMA30
  const momentum = calculateROC(prices, 14)
  
  let direction: 'uptrend' | 'downtrend' | 'sideways'
  let strength: number
  
  if (diff > 0.02) {
    direction = 'uptrend'
    strength = Math.min(1, diff * 10)
  } else if (diff < -0.02) {
    direction = 'downtrend'
    strength = Math.min(1, Math.abs(diff) * 10)
  } else {
    direction = 'sideways'
    strength = 0.5
  }
  
  return { direction, strength, crossover, momentum }
}

/**
 * Calculate trend signal score
 */
export function calculateTrendSignal(prices: number[]): SignalScore {
  const trend = analyzeTrend(prices)
  const maxScore = CONFIG.WEIGHTS.TREND
  
  // Bullish crossover is a strong buy signal
  if (trend.crossover === 'bullish') {
    return {
      score: maxScore,
      reason: 'Bullish crossover detected - trend reversal',
      confidence: 0.85
    }
  }
  
  // Bearish crossover is a strong avoid signal
  if (trend.crossover === 'bearish') {
    return {
      score: -maxScore,
      reason: 'Bearish crossover - downtrend starting',
      confidence: 0.85
    }
  }
  
  switch (trend.direction) {
    case 'uptrend':
      const upScore = trend.momentum > 0 
        ? maxScore * 0.8 
        : maxScore * 0.5
      return {
        score: upScore,
        reason: `Uptrend with ${(trend.momentum * 100).toFixed(1)}% momentum`,
        confidence: trend.strength
      }
    
    case 'downtrend':
      const downScore = -maxScore * trend.strength
      return {
        score: downScore,
        reason: `Downtrend - don't catch falling knife`,
        confidence: trend.strength
      }
    
    case 'sideways':
      const sidewaysScore = trend.momentum > 0.02 ? maxScore * 0.3 : maxScore * 0.1
      return {
        score: sidewaysScore,
        reason: 'Sideways consolidation',
        confidence: 0.5
      }
    
    default:
      return { score: 0, reason: 'Unknown trend', confidence: 0 }
  }
}

// =============================================================================
// SIGNAL 3: SUPPORT LEVEL DETECTION
// =============================================================================

interface SupportLevel {
  price: number
  bounces: number      // Times price touched and bounced
  strength: number     // 0-1 based on bounces and recency
  lastTouch: number    // Index of last touch
}

/**
 * Find support levels by clustering low prices
 */
export function findSupportLevels(priceHistory: PriceDataPoint[]): SupportLevel[] {
  if (priceHistory.length < 20) return []
  
  // Get all local minima (prices lower than neighbors)
  const lows: { price: number; index: number }[] = []
  
  for (let i = 2; i < priceHistory.length - 2; i++) {
    const price = priceHistory[i].low
    const prev1 = priceHistory[i - 1].low
    const prev2 = priceHistory[i - 2].low
    const next1 = priceHistory[i + 1].low
    const next2 = priceHistory[i + 2].low
    
    // Local minimum (lower than 2 neighbors on each side)
    if (price <= prev1 && price <= prev2 && price <= next1 && price <= next2) {
      lows.push({ price, index: i })
    }
  }
  
  if (lows.length === 0) return []
  
  // Cluster lows within 5% of each other
  const clusters: { prices: number[]; indices: number[] }[] = []
  const tolerance = 0.05 // 5%
  
  for (const low of lows) {
    let foundCluster = false
    
    for (const cluster of clusters) {
      const clusterMean = calculateMean(cluster.prices)
      if (Math.abs(low.price - clusterMean) / clusterMean < tolerance) {
        cluster.prices.push(low.price)
        cluster.indices.push(low.index)
        foundCluster = true
        break
      }
    }
    
    if (!foundCluster) {
      clusters.push({ prices: [low.price], indices: [low.index] })
    }
  }
  
  // Convert clusters to support levels
  const supports: SupportLevel[] = clusters
    .filter(c => c.prices.length >= CONFIG.SUPPORT_MIN_BOUNCES)
    .map(c => {
      const avgPrice = calculateMean(c.prices)
      const lastTouch = Math.max(...c.indices)
      const recencyFactor = 1 - (priceHistory.length - lastTouch) / priceHistory.length
      
      return {
        price: avgPrice,
        bounces: c.prices.length,
        strength: Math.min(1, (c.prices.length / 5) * (0.5 + 0.5 * recencyFactor)),
        lastTouch
      }
    })
    .sort((a, b) => b.strength - a.strength)
  
  return supports.slice(0, 5) // Return top 5 support levels
}

/**
 * Calculate support signal score
 */
export function calculateSupportSignal(
  currentPrice: number, 
  priceHistory: PriceDataPoint[]
): SignalScore {
  const supports = findSupportLevels(priceHistory)
  const maxScore = CONFIG.WEIGHTS.SUPPORT
  
  if (supports.length === 0) {
    return {
      score: 0,
      reason: 'No clear support levels found',
      confidence: 0.3
    }
  }
  
  // Find nearest support
  const historicalLow = Math.min(...priceHistory.map(p => p.low))
  
  // Check if we're below all historical supports (new territory)
  if (currentPrice < historicalLow * 0.95) {
    return {
      score: -maxScore * 0.6,
      reason: 'Below all historical supports - uncharted territory',
      confidence: 0.7
    }
  }
  
  // Find the nearest support level
  let nearestSupport: SupportLevel | null = null
  let nearestDistance = Infinity
  
  for (const support of supports) {
    const distance = Math.abs(currentPrice - support.price) / support.price
    if (distance < nearestDistance && currentPrice >= support.price * 0.9) {
      nearestDistance = distance
      nearestSupport = support
    }
  }
  
  if (!nearestSupport) {
    return {
      score: -maxScore * 0.3,
      reason: 'Price well below support levels',
      confidence: 0.5
    }
  }
  
  // Calculate score based on proximity and strength
  const isNearSupport = nearestDistance < CONFIG.SUPPORT_PROXIMITY
  const bounceBonus = Math.min(1, nearestSupport.bounces / 5)
  
  if (isNearSupport) {
    const score = maxScore * nearestSupport.strength * bounceBonus
    return {
      score,
      reason: `Near support at ${nearestSupport.price.toFixed(2)} (${nearestSupport.bounces} bounces)`,
      confidence: nearestSupport.strength
    }
  }
  
  return {
    score: maxScore * 0.3 * nearestSupport.strength,
    reason: `Support at ${nearestSupport.price.toFixed(2)} below`,
    confidence: nearestSupport.strength * 0.7
  }
}

// =============================================================================
// SIGNAL 4: VOLUME-PRICE ANALYSIS
// =============================================================================

/**
 * Detect accumulation/distribution patterns
 * Accumulation: High volume at low prices (smart money buying)
 * Distribution: High volume at high prices (smart money selling)
 */
export function analyzeVolumePricePattern(priceHistory: PriceDataPoint[]): {
  pattern: 'accumulation' | 'distribution' | 'neutral'
  strength: number
  obvTrend: 'rising' | 'falling' | 'flat'
} {
  if (priceHistory.length < 30) {
    return { pattern: 'neutral', strength: 0, obvTrend: 'flat' }
  }
  
  const prices = priceHistory.map(p => p.price)
  const volumes = priceHistory.map(p => p.volume)
  
  // Separate into price quintiles
  const sortedPrices = [...prices].sort((a, b) => a - b)
  const lowThreshold = sortedPrices[Math.floor(sortedPrices.length * 0.2)]
  const highThreshold = sortedPrices[Math.floor(sortedPrices.length * 0.8)]
  
  let lowPriceVolume = 0
  let lowPriceCount = 0
  let highPriceVolume = 0
  let highPriceCount = 0
  
  for (let i = 0; i < priceHistory.length; i++) {
    if (prices[i] <= lowThreshold) {
      lowPriceVolume += volumes[i]
      lowPriceCount++
    } else if (prices[i] >= highThreshold) {
      highPriceVolume += volumes[i]
      highPriceCount++
    }
  }
  
  const avgLowVolume = lowPriceCount > 0 ? lowPriceVolume / lowPriceCount : 0
  const avgHighVolume = highPriceCount > 0 ? highPriceVolume / highPriceCount : 0
  
  // Calculate On-Balance Volume trend
  const obvTrend = calculateOBVTrend(priceHistory)
  
  // Determine pattern
  let pattern: 'accumulation' | 'distribution' | 'neutral' = 'neutral'
  let strength = 0
  
  if (avgHighVolume > 0 && avgLowVolume > avgHighVolume * 1.5) {
    pattern = 'accumulation'
    strength = Math.min(1, (avgLowVolume / avgHighVolume - 1) / 2)
  } else if (avgLowVolume > 0 && avgHighVolume > avgLowVolume * 1.5) {
    pattern = 'distribution'
    strength = Math.min(1, (avgHighVolume / avgLowVolume - 1) / 2)
  }
  
  return { pattern, strength, obvTrend }
}

/**
 * Calculate On-Balance Volume trend direction
 */
function calculateOBVTrend(priceHistory: PriceDataPoint[]): 'rising' | 'falling' | 'flat' {
  if (priceHistory.length < 14) return 'flat'
  
  // Calculate OBV
  const obv: number[] = [0]
  for (let i = 1; i < priceHistory.length; i++) {
    const priceChange = priceHistory[i].price - priceHistory[i - 1].price
    if (priceChange > 0) {
      obv.push(obv[i - 1] + priceHistory[i].volume)
    } else if (priceChange < 0) {
      obv.push(obv[i - 1] - priceHistory[i].volume)
    } else {
      obv.push(obv[i - 1])
    }
  }
  
  // Compare recent OBV to older OBV
  const recent = calculateMean(obv.slice(-7))
  const older = calculateMean(obv.slice(-21, -7))
  
  if (older === 0) return 'flat'
  const change = (recent - older) / Math.abs(older)
  
  if (change > 0.1) return 'rising'
  if (change < -0.1) return 'falling'
  return 'flat'
}

/**
 * Calculate volume signal score
 */
export function calculateVolumeSignal(
  currentPrice: number,
  priceHistory: PriceDataPoint[]
): SignalScore {
  const analysis = analyzeVolumePricePattern(priceHistory)
  const maxScore = CONFIG.WEIGHTS.VOLUME
  
  // Check for recent volume spike
  const volumes = priceHistory.map(p => p.volume)
  const avgVolume = calculateMean(volumes.slice(0, -7))
  const recentVolume = calculateMean(volumes.slice(-7))
  const volumeSpike = avgVolume > 0 ? recentVolume / avgVolume : 1
  
  // Determine current price position
  const prices = priceHistory.map(p => p.price)
  const sortedPrices = [...prices].sort((a, b) => a - b)
  const position = sortedPrices.filter(p => p < currentPrice).length / sortedPrices.length
  
  // Accumulation at low prices = bullish
  if (analysis.pattern === 'accumulation') {
    const isLowPrice = position < 0.3
    const score = isLowPrice 
      ? maxScore * analysis.strength 
      : maxScore * analysis.strength * 0.5
    
    return {
      score,
      reason: `Accumulation pattern detected${analysis.obvTrend === 'rising' ? ' with rising OBV' : ''}`,
      confidence: analysis.strength
    }
  }
  
  // Distribution = bearish
  if (analysis.pattern === 'distribution') {
    return {
      score: -maxScore * analysis.strength,
      reason: 'Distribution pattern - smart money selling',
      confidence: analysis.strength
    }
  }
  
  // Check OBV divergence (rising OBV + falling/flat price = hidden bullish)
  if (analysis.obvTrend === 'rising' && position < 0.4) {
    return {
      score: maxScore * 0.5,
      reason: 'Rising OBV suggests hidden buying pressure',
      confidence: 0.6
    }
  }
  
  // Volume spike warning
  if (volumeSpike > CONFIG.VOLUME_SPIKE_THRESHOLD) {
    return {
      score: 0,
      reason: `Volume spike (${volumeSpike.toFixed(1)}x) - watch for manipulation`,
      confidence: 0.5
    }
  }
  
  return {
    score: 0,
    reason: 'Normal volume pattern',
    confidence: 0.4
  }
}

// =============================================================================
// COMBINED SIGNAL ANALYSIS
// =============================================================================

/**
 * Get opportunity tier based on total score
 */
export function getOpportunityTier(score: number): 'excellent' | 'good' | 'marginal' | 'skip' {
  if (score >= OPPORTUNITY_TIERS.EXCELLENT) return 'excellent'
  if (score >= OPPORTUNITY_TIERS.GOOD) return 'good'
  if (score >= OPPORTUNITY_TIERS.MARGINAL) return 'marginal'
  return 'skip'
}

/**
 * Map tier to confidence level (for legacy compatibility)
 */
function tierToConfidence(tier: 'excellent' | 'good' | 'marginal' | 'skip'): 'high' | 'medium' | 'low' {
  switch (tier) {
    case 'excellent': return 'high'
    case 'good': return 'medium'
    default: return 'low'
  }
}

/**
 * Calculate all signals and combine into final score
 */
export function calculateSignalBreakdown(
  currentPrice: number,
  priceHistory: PriceDataPoint[]
): SignalBreakdown {
  const prices = priceHistory.map(p => p.price)
  
  const cycle = calculateCycleSignal(prices)
  const trend = calculateTrendSignal(prices)
  const support = calculateSupportSignal(currentPrice, priceHistory)
  const volume = calculateVolumeSignal(currentPrice, priceHistory)
  
  const totalScore = cycle.score + trend.score + support.score + volume.score
  const tier = getOpportunityTier(totalScore)
  
  return {
    cycle,
    trend,
    support,
    volume,
    totalScore,
    tier
  }
}

// =============================================================================
// MAIN ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Process market history data into statistics per item
 */
export function calculateItemStatistics(
  history: MarketHistoryEntry[],
  itemNames: Map<number, string>
): ItemStatistics[] {
  // Group history by type_id
  const byTypeId = new Map<number, MarketHistoryEntry[]>()
  
  for (const entry of history) {
    const existing = byTypeId.get(entry.type_id) || []
    existing.push(entry)
    byTypeId.set(entry.type_id, existing)
  }
  
  const stats: ItemStatistics[] = []
  
  for (const [typeId, entries] of byTypeId) {
    // Sort by date ascending
    entries.sort((a, b) => a.date.localeCompare(b.date))
    
    const prices = entries.map(e => e.average)
    const volumes = entries.map(e => e.volume)
    
    const mean = calculateMean(prices)
    const stdDev = calculateStdDev(prices, mean)
    const avgVolume = calculateMean(volumes)
    const volatility = calculateVolatility(stdDev, mean)
    
    // Build full price history for signal analysis
    const priceHistory: PriceDataPoint[] = entries.map(e => ({
      date: e.date,
      price: e.average,
      volume: e.volume,
      high: e.highest,
      low: e.lowest
    }))
    
    stats.push({
      typeId,
      itemName: itemNames.get(typeId) || `Unknown (${typeId})`,
      mean,
      stdDev,
      avgVolume,
      volatility,
      dataPoints: entries.length,
      priceHistory,
    })
  }
  
  return stats
}

/**
 * Filter items by minimum criteria before analysis
 */
export function filterCandidates(stats: ItemStatistics[]): ItemStatistics[] {
  return stats.filter(item => {
    if (item.dataPoints < CONFIG.MIN_DATA_POINTS) return false
    if (item.avgVolume < CONFIG.MIN_DAILY_VOLUME) return false
    if (item.volatility > CONFIG.MAX_VOLATILITY) return false
    if (item.mean < CONFIG.MIN_PRICE) return false
    return true
  })
}

/**
 * Rank candidates by historical volume to prioritize ESI fetches
 */
export function rankByVolume(stats: ItemStatistics[], limit: number = 500): ItemStatistics[] {
  return [...stats]
    .sort((a, b) => b.avgVolume - a.avgVolume)
    .slice(0, limit)
}

/**
 * Analyze an item with current price data using multi-signal approach
 */
/**
 * Calculate ISK score from daily ISK potential (logarithmic scale)
 * Scale: 10M/day = 20pts, 100M/day = 40pts, 1B/day = 60pts, 10B/day = 80pts
 */
function calculateIskScore(dailyIskPotential: number): number {
  if (dailyIskPotential <= 0) return 0
  // Log base 10 of millions, scaled by 20
  const score = Math.log10(dailyIskPotential / 1_000_000) * 20
  return Math.max(0, Math.min(100, score))
}

export function analyzeOpportunity(
  stats: ItemStatistics,
  currentPrice: number
): MarketOpportunity | null {
  if (currentPrice <= 0) return null
  if (stats.priceHistory.length < CONFIG.MIN_DATA_POINTS) return null
  
  // CRITICAL: Reject items trading ABOVE their average (negative gain)
  // Why buy something that's overpriced?
  if (currentPrice > stats.mean) return null
  
  // Calculate potential gain
  const potentialGain = calculatePotentialGain(currentPrice, stats.mean)
  
  // Calculate ISK profit potential
  // This is the theoretical max profit if you captured all daily volume
  const dailyIskPotential = (potentialGain / 100) * currentPrice * stats.avgVolume
  const weeklyIskPotential = dailyIskPotential * 7
  
  // Skip items with negligible ISK potential (< 1M/day)
  if (dailyIskPotential < 1_000_000) return null
  
  // Calculate all signals
  const signals = calculateSignalBreakdown(currentPrice, stats.priceHistory)
  
  // Calculate ISK-based score
  const iskScore = calculateIskScore(dailyIskPotential)
  
  // Combined scoring: 50% signals, 50% ISK potential
  // This balances "is it a good time to buy" with "is there enough profit available"
  const combinedScore = (signals.totalScore * 0.5) + (iskScore * 0.5)
  
  // Update tier based on combined score
  const tier = getOpportunityTier(combinedScore)
  
  // Skip items that don't pass the minimum threshold
  if (tier === 'skip') return null
  
  // Calculate legacy metrics for compatibility
  const zScore = calculateZScore(currentPrice, stats.mean, stats.stdDev)
  const prices = stats.priceHistory.map(p => p.price)
  const momentum = calculateROC(prices, 14)
  
  return {
    typeId: stats.typeId,
    itemName: stats.itemName,
    currentPrice,
    avgPrice: Math.round(stats.mean * 100) / 100,
    dailyVolume: Math.round(stats.avgVolume),
    volatility: Math.round(stats.volatility * 1000) / 1000,
    
    // Signal breakdown (keep original signal score, but store combined for ranking)
    signals: {
      ...signals,
      totalScore: Math.round(combinedScore), // Use combined score
      tier
    },
    
    // ISK Profit Potential
    dailyIskPotential: Math.round(dailyIskPotential),
    weeklyIskPotential: Math.round(weeklyIskPotential),
    iskScore: Math.round(iskScore * 10) / 10,
    
    // Legacy fields
    zScore: Math.round(zScore * 100) / 100,
    potentialGain: Math.round(potentialGain * 100) / 100,
    opportunityScore: Math.round(combinedScore),
    confidence: tierToConfidence(tier),
    momentum: Math.round(momentum * 1000) / 1000,
  }
}

/**
 * Rank opportunities by score and return top results
 */
export function rankOpportunities(
  opportunities: MarketOpportunity[],
  limit: number = CONFIG.TOP_RESULTS
): MarketOpportunity[] {
  return [...opportunities]
    .sort((a, b) => b.signals.totalScore - a.signals.totalScore)
    .slice(0, limit)
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format ISK value with proper formatting
 */
export function formatISK(value: number): string {
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

// =============================================================================
// EVE MARKET TICK SIZE UTILITIES
// =============================================================================

/**
 * Calculate the market tick size for a given price.
 * 
 * EVE Online uses 4 significant figures for price precision (as of March 2020).
 * Tick size = 10^(floor(log10(price)) - 3)
 * 
 * Examples:
 * - 100 ISK → tick = 0.01 ISK
 * - 1,000 ISK → tick = 0.1 ISK
 * - 10,000 ISK → tick = 1 ISK
 * - 100,000 ISK → tick = 10 ISK
 * - 1,000,000 ISK → tick = 100 ISK
 * - 10,000,000 ISK → tick = 1,000 ISK
 * - 100,000,000 ISK → tick = 10,000 ISK
 * - 1,000,000,000 ISK → tick = 100,000 ISK
 */
export function calculateTickSize(price: number): number {
  if (price <= 0) return 0.01
  
  // Calculate the order of magnitude
  const magnitude = Math.floor(Math.log10(price))
  
  // Tick size is 10^(magnitude - 3) for 4 significant figures
  // But minimum tick is 0.01 ISK
  const tickExponent = magnitude - 3
  const tickSize = Math.pow(10, tickExponent)
  
  return Math.max(0.01, tickSize)
}

/**
 * Round a price down to the nearest valid tick.
 * Used for calculating undercut prices.
 */
export function roundPriceToTick(price: number): number {
  const tick = calculateTickSize(price)
  return Math.floor(price / tick) * tick
}

/**
 * Round a price up to the nearest valid tick.
 */
export function roundPriceUpToTick(price: number): number {
  const tick = calculateTickSize(price)
  return Math.ceil(price / tick) * tick
}

/**
 * Calculate the undercut price (1 tick below the given price).
 * This is the minimum valid price that undercuts the competition.
 * 
 * @param competitorPrice The competitor's current price
 * @returns The undercut price (1 tick lower)
 */
export function calculateUndercutPrice(competitorPrice: number): number {
  if (competitorPrice <= 0) return 0
  
  // First, ensure the competitor price is on a valid tick
  const tick = calculateTickSize(competitorPrice)
  const roundedPrice = roundPriceToTick(competitorPrice)
  
  // Undercut by 1 tick
  const undercutPrice = roundedPrice - tick
  
  // Ensure we don't go below minimum (0.01 ISK)
  return Math.max(0.01, undercutPrice)
}

/**
 * Format a price for EVE's market interface (no ISK suffix, comma-separated).
 * This format can be copy-pasted directly into EVE's modify order dialog.
 * 
 * @param price The price to format
 * @returns Formatted string like "1,234,567.89"
 */
export function formatPriceForEve(price: number): string {
  // Round to 2 decimal places
  const rounded = Math.round(price * 100) / 100
  
  // Format with commas and 2 decimal places
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}