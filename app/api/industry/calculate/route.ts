import { NextRequest, NextResponse } from 'next/server'
import {
  calculateRecursiveBuild,
  getBlueprint,
  getStructureBonus,
  getRigBonus,
  getSecurityMultiplier,
  getDefaultSettings,
  getGroupName,
  getTypeInfo,
  type IndustrySettings,
} from '@/lib/blueprints'
import { getSystemCostIndex, getJobBaseCosts } from '@/lib/esi'
import { createAppraisal } from '@/lib/janice'

export interface CalculateRequest {
  blueprintTypeId: number
  quantity: number
  runs?: number
  blueprintMe?: number
  blueprintTe?: number
  systemName?: string  // Changed from systemId to systemName
  facilityTax?: number
  structureType?: 'npc_station' | 'raitaru' | 'azbel' | 'sotiyo'
  rigType?: 'none' | 't1' | 't2'
  securityType?: 'highsec' | 'lowsec' | 'nullsec' | 'wormhole'
  calculateReactions?: boolean
}

export interface MaterialWithPrice {
  typeId: number
  name: string
  quantity: number
  volume: number
  buyPrice: number
  sellPrice: number
  totalBuyPrice: number
  totalSellPrice: number
  groupName?: string
}

export interface ComponentItem {
  typeId: number
  name: string
  quantity: number
  volume: number
  buyPrice: number
  sellPrice: number
  totalBuyPrice: number
  totalSellPrice: number
  groupName?: string
  buildCost?: number        // Cost to build this component (materials + job cost)
  shouldBuy?: boolean       // True if buying is cheaper than building
  savings?: number          // Amount saved by choosing the cheaper option
}


export interface CalculateResponse {
  blueprint: {
    blueprintTypeId: number
    blueprintName: string
    productTypeId: number
    productName: string
  }
  materials: MaterialWithPrice[]  // Raw materials that cannot be built
  components: ComponentItem[]     // Intermediate components that are built
  outputs: {
    typeId: number
    name: string
    quantity: number
    volume: number
    buyPrice: number
    sellPrice: number
    totalBuyPrice: number
    totalSellPrice: number
    duration: string
  }[]
  excessMaterials: MaterialWithPrice[]
  costs: {
    materialsCostBuy: number
    materialsCostSell: number
    jobCosts: number
    excessValue: number
    totalCost: number
    costPerUnit: number
    estimatedProfit: number
  }
  buildSteps: {
    blueprintName: string
    productName: string
    runs: number
    quantity: number
    excess: number
    duration: string
    jobCost: number
  }[]
  systemCostIndex: number
}

export async function POST(request: NextRequest) {
  try {
    const body: CalculateRequest = await request.json()
    
    // Validate required fields
    if (!body.blueprintTypeId) {
      return NextResponse.json(
        { error: 'blueprintTypeId is required' },
        { status: 400 }
      )
    }
    
    // Check blueprint exists
    const blueprint = getBlueprint(body.blueprintTypeId)
    if (!blueprint) {
      return NextResponse.json(
        { error: 'Blueprint not found' },
        { status: 404 }
      )
    }
    
    // Build settings
    const defaults = getDefaultSettings()
    const settings: IndustrySettings = {
      blueprintMe: body.blueprintMe ?? defaults.blueprintMe,
      blueprintTe: body.blueprintTe ?? defaults.blueprintTe,
      runs: body.runs ?? defaults.runs,
      quantity: body.quantity ?? 1,
      systemCostIndex: defaults.systemCostIndex,
      facilityTax: (body.facilityTax ?? 0) / 100, // Convert percentage to decimal
      structureBonus: body.structureType 
        ? getStructureBonus(body.structureType)
        : defaults.structureBonus,
      rigBonus: body.rigType
        ? getRigBonus(body.rigType)
        : defaults.rigBonus,
      securityMultiplier: body.securityType
        ? getSecurityMultiplier(body.securityType)
        : defaults.securityMultiplier,
      componentMe: defaults.componentMe,
      componentTe: defaults.componentTe,
    }
    
    // Fetch system cost index from eve-industry.org
    const systemName = body.systemName ?? 'Jita'
    const isReaction = blueprint.activityId === 11
    const activityId = isReaction ? 11 : 1 // 1=Manufacturing, 11=Reactions
    
    try {
      settings.systemCostIndex = await getSystemCostIndex(systemName, activityId)
    } catch (error) {
      console.warn('Failed to fetch system cost index, using default:', error)
    }
    
    // Calculate recursive build first to get all blueprint IDs
    const result = calculateRecursiveBuild(body.blueprintTypeId, settings, new Map())
    
    // Get job base costs from eve-industry.org for all blueprints
    const blueprintIds = result.buildSteps.map(step => step.blueprintTypeId)
    let jobBaseCosts = new Map<number, number>()
    try {
      jobBaseCosts = await getJobBaseCosts(blueprintIds)
    } catch (error) {
      console.warn('Failed to fetch job base costs:', error)
    }
    
    // Recalculate job costs using actual base costs from API
    let totalJobCost = 0
    for (const step of result.buildSteps) {
      const baseCost = jobBaseCosts.get(step.blueprintTypeId) || 0
      // Job cost formula: base_cost * system_cost_index * runs * (1 - structure_bonus) * (1 + facility_tax)
      step.jobCost = baseCost * settings.systemCostIndex * step.runs * 
                     (1 - settings.structureBonus.jobCostBonus) * 
                     (1 + settings.facilityTax)
      totalJobCost += step.jobCost
    }
    
    // Get prices for all materials from Janice (including components)
    // Build a map of typeId -> name for all items we need prices for
    const itemsForPricing = new Map<number, string>()
    result.rawMaterials.forEach(m => itemsForPricing.set(m.typeId, m.name))
    result.excessMaterials.forEach(m => itemsForPricing.set(m.typeId, m.name))
    result.buildSteps.forEach(step => itemsForPricing.set(step.productTypeId, step.productName))
    itemsForPricing.set(blueprint.productTypeId, blueprint.productName)
    
    // Create item list for Janice appraisal using item names (Janice expects names, not type IDs)
    const itemList = Array.from(itemsForPricing.values()).map(name => `${name} x1`).join('\n')
    
    let priceMap = new Map<number, { buy: number; sell: number }>()
    try {
      const appraisal = await createAppraisal(itemList)
      for (const item of appraisal.items) {
        priceMap.set(item.typeId, {
          buy: item.buyPrice,
          sell: item.sellPrice
        })
      }
    } catch (error) {
      console.warn('Failed to fetch prices from Janice:', error)
    }
    
    // Build response with prices
    const materials: MaterialWithPrice[] = result.rawMaterials.map(m => {
      const prices = priceMap.get(m.typeId) || { buy: 0, sell: 0 }
      return {
        typeId: m.typeId,
        name: m.name,
        quantity: m.adjustedQuantity,
        volume: m.volume,
        buyPrice: prices.buy,
        sellPrice: prices.sell,
        totalBuyPrice: prices.buy * m.adjustedQuantity,
        totalSellPrice: prices.sell * m.adjustedQuantity,
        groupName: m.groupName
      }
    })
    
    const excessMaterials: MaterialWithPrice[] = result.excessMaterials.map(m => {
      const prices = priceMap.get(m.typeId) || { buy: 0, sell: 0 }
      return {
        typeId: m.typeId,
        name: m.name,
        quantity: m.quantity,
        volume: m.volume,
        buyPrice: prices.buy,
        sellPrice: prices.sell,
        totalBuyPrice: prices.buy * m.quantity,
        totalSellPrice: prices.sell * m.quantity,
        groupName: getGroupName(m.typeId) || undefined
      }
    })
    
    // Calculate totals
    const materialsCostBuy = materials.reduce((sum, m) => sum + m.totalBuyPrice, 0)
    const materialsCostSell = materials.reduce((sum, m) => sum + m.totalSellPrice, 0)
    const excessValue = excessMaterials.reduce((sum, m) => sum + m.totalBuyPrice, 0)
    const totalCost = materialsCostBuy + totalJobCost - excessValue
    const costPerUnit = totalCost / settings.quantity
    
    // Output product
    const productPrices = priceMap.get(blueprint.productTypeId) || { buy: 0, sell: 0 }
    const outputs = [{
      typeId: blueprint.productTypeId,
      name: blueprint.productName,
      quantity: settings.quantity,
      volume: 0, // TODO: Get from type info
      buyPrice: productPrices.buy,
      sellPrice: productPrices.sell,
      totalBuyPrice: productPrices.buy * settings.quantity,
      totalSellPrice: productPrices.sell * settings.quantity,
      duration: formatDuration(result.totalTime)
    }]
    
    const estimatedProfit = productPrices.sell * settings.quantity - totalCost
    
    // Build steps for display
    const buildSteps = result.buildSteps.map(step => ({
      blueprintName: step.blueprintName,
      productName: step.productName,
      runs: step.runs,
      quantity: step.producedQuantity,
      excess: step.excessQuantity,
      duration: formatDuration(step.time),
      jobCost: step.jobCost
    }))
    
    // Extract components from build steps (intermediate items that are built)
    // Exclude the main product and aggregate duplicates
    // Also calculate build cost for each component
    const componentMap = new Map<number, { 
      name: string; 
      quantity: number; 
      groupName?: string;
      buildCost: number;  // Material cost + job cost to build
    }>()
    
    for (const step of result.buildSteps) {
      if (step.productTypeId === blueprint.productTypeId) continue
      
      // Calculate material cost for this build step
      let materialCost = 0
      for (const mat of step.materials) {
        const matPrice = priceMap.get(mat.typeId)?.sell || 0
        materialCost += matPrice * mat.adjustedQuantity
      }
      const stepBuildCost = materialCost + step.jobCost
      
      const existing = componentMap.get(step.productTypeId)
      if (existing) {
        existing.quantity += step.producedQuantity
        existing.buildCost += stepBuildCost
      } else {
        componentMap.set(step.productTypeId, {
          name: step.productName,
          quantity: step.producedQuantity,
          groupName: getGroupName(step.productTypeId) || undefined,
          buildCost: stepBuildCost
        })
      }
    }
    
    const components: ComponentItem[] = Array.from(componentMap.entries()).map(([typeId, data]) => {
      const typeInfo = getTypeInfo(typeId)
      const prices = priceMap.get(typeId) || { buy: 0, sell: 0 }
      const unitVolume = typeInfo?.volume || 0
      const volume = unitVolume * data.quantity
      const totalSellPrice = prices.sell * data.quantity
      
      // Compare: is it cheaper to buy this component or build it?
      const shouldBuy = totalSellPrice > 0 && totalSellPrice < data.buildCost
      const savings = shouldBuy 
        ? data.buildCost - totalSellPrice  // Savings from buying
        : totalSellPrice - data.buildCost  // Savings from building (or 0 if no price)
      
      return {
        typeId,
        name: data.name,
        quantity: data.quantity,
        volume,
        buyPrice: prices.buy,
        sellPrice: prices.sell,
        totalBuyPrice: prices.buy * data.quantity,
        totalSellPrice,
        groupName: data.groupName,
        buildCost: data.buildCost,
        shouldBuy,
        savings: Math.abs(savings)
      }
    })
    
    const response: CalculateResponse = {
      blueprint: {
        blueprintTypeId: blueprint.blueprintTypeId,
        blueprintName: blueprint.blueprintName,
        productTypeId: blueprint.productTypeId,
        productName: blueprint.productName
      },
      materials,
      components,
      outputs,
      excessMaterials,
      costs: {
        materialsCostBuy,
        materialsCostSell,
        jobCosts: totalJobCost,
        excessValue,
        totalCost,
        costPerUnit,
        estimatedProfit
      },
      buildSteps,
      systemCostIndex: settings.systemCostIndex
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Industry calculation error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate industry build' },
      { status: 500 }
    )
  }
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) {
    return `${days}D ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

