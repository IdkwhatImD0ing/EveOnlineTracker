/**
 * Blueprint lookup and industry calculation utilities
 * Handles recursive material expansion, ME/TE calculations, and job costs
 */

import blueprintsData from '@/data/blueprints.json'
import blueprintsByProductData from '@/data/blueprints-by-product.json'
import invTypesData from '@/data/inv-types.json'
import invGroupsData from '@/data/inv-groups.json'
import structuresData from '@/data/structures.json'

// Type definitions
export interface BlueprintMaterial {
  typeId: number
  quantity: number
}

export interface BlueprintData {
  blueprintTypeId: number
  blueprintName: string
  productTypeId: number
  productName: string
  activityId: number
  time: number
  materials: BlueprintMaterial[]
  producedQuantity: number
}

export interface TypeInfo {
  name: string
  groupId: number | null
  volume: number
}

export interface StructureBonus {
  meBonus: number
  teBonus: number
  jobCostBonus: number
}

export interface RigBonus {
  meBonus: number
  teBonus: number
}

export interface IndustrySettings {
  blueprintMe: number        // 0-10
  blueprintTe: number        // 0-20
  runs: number               // Runs per BPC
  quantity: number           // Number of BPCs
  systemCostIndex: number    // From ESI
  facilityTax: number        // 0-1 (percentage as decimal)
  structureBonus: StructureBonus
  rigBonus: RigBonus
  securityMultiplier: number // 1.0 for highsec, 1.9 for low, 2.1 for null
  componentMe: number        // Default ME for components (10)
  componentTe: number        // Default TE for components (20)
}

export interface MaterialRequirement {
  typeId: number
  name: string
  baseQuantity: number
  adjustedQuantity: number
  volume: number
  groupName?: string
  isRawMaterial: boolean
}

export interface BuildStep {
  blueprintTypeId: number
  blueprintName: string
  productTypeId: number
  productName: string
  runs: number
  producedQuantity: number
  excessQuantity: number
  time: number              // In seconds
  jobCost: number
  materials: MaterialRequirement[]
}

export interface CalculationResult {
  targetBlueprint: BlueprintData
  rawMaterials: MaterialRequirement[]
  buildSteps: BuildStep[]
  totalTime: number
  totalJobCost: number
  excessMaterials: { typeId: number; name: string; quantity: number; volume: number }[]
}

// Cast imported JSON to typed data
const blueprints = blueprintsData as Record<string, BlueprintData>
const blueprintsByProduct = blueprintsByProductData as Record<string, number>
const invTypes = invTypesData as Record<string, TypeInfo>
const invGroups = invGroupsData as Record<string, { name: string; categoryId: number }>
const structures = structuresData as typeof structuresData

// Activity type constants
const ACTIVITY_MANUFACTURING = 1
const ACTIVITY_REACTION = 11

/**
 * Get blueprint by blueprint type ID
 */
export function getBlueprint(blueprintTypeId: number): BlueprintData | null {
  return blueprints[blueprintTypeId.toString()] || null
}

/**
 * Get blueprint by product type ID (what it produces)
 */
export function getBlueprintByProduct(productTypeId: number): BlueprintData | null {
  const blueprintId = blueprintsByProduct[productTypeId.toString()]
  if (!blueprintId) return null
  return getBlueprint(blueprintId)
}

/**
 * Get type information by type ID
 */
export function getTypeInfo(typeId: number): TypeInfo | null {
  return invTypes[typeId.toString()] || null
}

/**
 * Get type name by type ID
 */
export function getTypeName(typeId: number): string {
  return invTypes[typeId.toString()]?.name || `Unknown (${typeId})`
}

/**
 * Get group name by type ID (for categorization)
 */
export function getGroupName(typeId: number): string | null {
  const typeInfo = invTypes[typeId.toString()]
  if (!typeInfo || typeInfo.groupId === null) return null
  
  const group = invGroups[typeInfo.groupId.toString()]
  return group?.name || null
}

/**
 * Check if a type can be manufactured (has a blueprint)
 */
export function canBeBuilt(typeId: number): boolean {
  return blueprintsByProduct[typeId.toString()] !== undefined
}

/**
 * Calculate adjusted material quantity with ME bonus
 * Formula: max(runs, ceil(round(baseQuantity * runs * (1 - totalMe), 2)))
 * 
 * EVE Online applies ME to the TOTAL materials needed, not per-run.
 * This means batch production is more efficient than individual jobs.
 * The minimum is the number of runs (at least 1 of each material per run).
 */
export function calculateMaterialQuantity(
  baseQuantity: number,
  runs: number,
  blueprintMe: number,
  structureMeBonus: number,
  rigMeBonus: number,
  securityMultiplier: number = 1.0
): number {
  // Total ME reduction (blueprint ME + structure + rig * security)
  const totalMeReduction = (blueprintMe / 100) + structureMeBonus + (rigMeBonus * securityMultiplier)
  
  // Apply ME formula to total quantity
  const rawQuantity = baseQuantity * runs * (1 - totalMeReduction)
  const rounded = Math.round(rawQuantity * 100) / 100 // Round to 2 decimal places
  const adjusted = Math.ceil(rounded)
  
  // Minimum is the number of runs (at least 1 material per run)
  return Math.max(runs, adjusted)
}

/**
 * Calculate job time with TE bonus
 * Formula: baseTime * runs * (1 - totalTe)
 */
export function calculateJobTime(
  baseTime: number,
  runs: number,
  blueprintTe: number,
  structureTeBonus: number,
  rigTeBonus: number,
  securityMultiplier: number = 1.0
): number {
  // Total TE reduction
  const totalTeReduction = (blueprintTe / 100) + structureTeBonus + (rigTeBonus * securityMultiplier)
  
  return Math.ceil(baseTime * runs * (1 - Math.min(totalTeReduction, 0.9))) // Cap at 90% reduction
}

/**
 * Get default industry settings
 */
export function getDefaultSettings(): IndustrySettings {
  return {
    blueprintMe: 0,
    blueprintTe: 0,
    runs: 1,
    quantity: 1,
    systemCostIndex: 0.05, // 5% default
    facilityTax: 0,
    structureBonus: { meBonus: 0.01, teBonus: 0.15, jobCostBonus: 0.03 }, // Raitaru defaults
    rigBonus: { meBonus: 0.02, teBonus: 0.20 }, // T1 rig
    securityMultiplier: 1.0, // Highsec
    componentMe: structures.defaultComponentME,
    componentTe: structures.defaultComponentTE,
  }
}

/**
 * Get structure bonus by structure type
 */
export function getStructureBonus(structureType: keyof typeof structures.industryStructures): StructureBonus {
  const structure = structures.industryStructures[structureType]
  return {
    meBonus: structure.meBonus,
    teBonus: structure.teBonus,
    jobCostBonus: structure.jobCostBonus
  }
}

/**
 * Get rig bonus by rig type
 */
export function getRigBonus(rigType: keyof typeof structures.rigs): RigBonus {
  const rig = structures.rigs[rigType]
  return {
    meBonus: rig.meBonus,
    teBonus: rig.teBonus
  }
}

/**
 * Get security multiplier
 */
export function getSecurityMultiplier(securityType: keyof typeof structures.securityMultipliers): number {
  return structures.securityMultipliers[securityType]
}

/**
 * Recursively calculate all materials needed for a blueprint
 * Expands intermediate components that can be built
 * 
 * settings.quantity = number of BPCs
 * settings.runs = runs per BPC
 */
export function calculateRecursiveBuild(
  blueprintTypeId: number,
  settings: IndustrySettings,
  adjustedPrices: Map<number, number> = new Map()
): CalculationResult {
  const blueprint = getBlueprint(blueprintTypeId)
  if (!blueprint) {
    throw new Error(`Blueprint ${blueprintTypeId} not found`)
  }

  // quantity = number of BPCs, runs = runs per BPC
  const runsPerBpc = settings.runs
  const numberOfBpcs = settings.quantity
  
  const rawMaterials: Map<number, MaterialRequirement> = new Map()
  const buildSteps: BuildStep[] = []
  const excessTracker: Map<number, number> = new Map()

  // Recursive function to process a blueprint
  function processBlueprintRecursive(
    bp: BlueprintData,
    runs: number,
    isTopLevel: boolean,
    me: number,
    te: number
  ): void {
    const stepMaterials: MaterialRequirement[] = []
    
    for (const mat of bp.materials) {
      const adjustedQty = calculateMaterialQuantity(
        mat.quantity,
        runs,
        me,
        settings.structureBonus.meBonus,
        settings.rigBonus.meBonus,
        settings.securityMultiplier
      )
      
      const typeInfo = getTypeInfo(mat.typeId)
      const materialReq: MaterialRequirement = {
        typeId: mat.typeId,
        name: getTypeName(mat.typeId),
        baseQuantity: mat.quantity * runs,
        adjustedQuantity: adjustedQty,
        volume: (typeInfo?.volume || 0) * adjustedQty,
        groupName: getGroupName(mat.typeId) || undefined,
        isRawMaterial: !canBeBuilt(mat.typeId)
      }
      
      stepMaterials.push(materialReq)
      
      // Check if this material can be built
      const componentBp = getBlueprintByProduct(mat.typeId)
      
      // Determine if we should recurse into this component:
      // - If top-level is manufacturing, don't recurse into reactions (treat reaction outputs as raw materials)
      // - If top-level is reaction, only recurse into other reactions
      const isTopLevelReaction = blueprint!.activityId === ACTIVITY_REACTION
      const isComponentReaction = componentBp?.activityId === ACTIVITY_REACTION
      const shouldRecurse = componentBp && (
        (isTopLevelReaction && isComponentReaction) ||  // Reactions can recurse into reactions
        (!isTopLevelReaction && !isComponentReaction)   // Manufacturing can only recurse into manufacturing
      )
      
      if (shouldRecurse && componentBp) {
        // Check excess from previous builds
        let needed = adjustedQty
        const excess = excessTracker.get(mat.typeId) || 0
        if (excess > 0) {
          const used = Math.min(excess, needed)
          needed -= used
          excessTracker.set(mat.typeId, excess - used)
        }
        
        if (needed > 0) {
          // Calculate runs needed for this component
          const componentRuns = Math.ceil(needed / componentBp.producedQuantity)
          const produced = componentRuns * componentBp.producedQuantity
          const newExcess = produced - needed
          
          if (newExcess > 0) {
            excessTracker.set(mat.typeId, (excessTracker.get(mat.typeId) || 0) + newExcess)
          }
          
          // Recursively process component (using default component ME/TE)
          processBlueprintRecursive(
            componentBp,
            componentRuns,
            false,
            settings.componentMe,
            settings.componentTe
          )
        }
      } else {
        // Raw material - add to final list
        const existing = rawMaterials.get(mat.typeId)
        if (existing) {
          existing.adjustedQuantity += adjustedQty
          existing.baseQuantity += mat.quantity * runs
          existing.volume = (typeInfo?.volume || 0) * existing.adjustedQuantity
        } else {
          rawMaterials.set(mat.typeId, { ...materialReq })
        }
      }
    }
    
    // Calculate job time
    const jobTime = calculateJobTime(
      bp.time,
      runs,
      te,
      settings.structureBonus.teBonus,
      settings.rigBonus.teBonus,
      settings.securityMultiplier
    )
    
    // Calculate job cost (base job cost * system index * (1 - structure bonus))
    const baseJobCost = stepMaterials.reduce((sum, mat) => {
      const adjustedPrice = adjustedPrices.get(mat.typeId) || 0
      return sum + (adjustedPrice * mat.adjustedQuantity)
    }, 0)
    
    const jobCost = baseJobCost * settings.systemCostIndex * 0.02 * runs * 
                    (1 - settings.structureBonus.jobCostBonus) * 
                    (1 + settings.facilityTax)
    
    const totalProduced = runs * bp.producedQuantity
    // For top-level, there's no excess from the BPC itself (you get exactly what runs produce)
    // Excess only comes from component over-production
    const excessProduced = isTopLevel 
      ? 0 
      : excessTracker.get(bp.productTypeId) || 0
    
    buildSteps.unshift({
      blueprintTypeId: bp.blueprintTypeId,
      blueprintName: bp.blueprintName,
      productTypeId: bp.productTypeId,
      productName: bp.productName,
      runs,
      producedQuantity: totalProduced,
      excessQuantity: excessProduced,
      time: jobTime,
      jobCost,
      materials: stepMaterials
    })
  }
  
  // Start recursive calculation for ONE BPC
  processBlueprintRecursive(
    blueprint, 
    runsPerBpc, 
    true, 
    settings.blueprintMe, 
    settings.blueprintTe
  )
  
  // Multiply all raw materials by number of BPCs
  if (numberOfBpcs > 1) {
    for (const mat of rawMaterials.values()) {
      mat.baseQuantity *= numberOfBpcs
      mat.adjustedQuantity *= numberOfBpcs
      mat.volume *= numberOfBpcs
    }
    
    // Multiply excess materials by number of BPCs
    for (const [typeId, qty] of excessTracker.entries()) {
      excessTracker.set(typeId, qty * numberOfBpcs)
    }
    
    // Multiply build step quantities for top-level step
    const topLevelStep = buildSteps.find(s => s.blueprintTypeId === blueprint.blueprintTypeId)
    if (topLevelStep) {
      topLevelStep.runs *= numberOfBpcs
      topLevelStep.producedQuantity *= numberOfBpcs
      topLevelStep.excessQuantity *= numberOfBpcs
      topLevelStep.time *= numberOfBpcs
      topLevelStep.jobCost *= numberOfBpcs
      for (const mat of topLevelStep.materials) {
        mat.baseQuantity *= numberOfBpcs
        mat.adjustedQuantity *= numberOfBpcs
        mat.volume *= numberOfBpcs
      }
    }
    
    // Multiply component build steps by number of BPCs
    for (const step of buildSteps) {
      if (step.blueprintTypeId !== blueprint.blueprintTypeId) {
        step.runs *= numberOfBpcs
        step.producedQuantity *= numberOfBpcs
        step.excessQuantity *= numberOfBpcs
        step.time *= numberOfBpcs
        step.jobCost *= numberOfBpcs
        for (const mat of step.materials) {
          mat.baseQuantity *= numberOfBpcs
          mat.adjustedQuantity *= numberOfBpcs
          mat.volume *= numberOfBpcs
        }
      }
    }
  }
  
  // Convert excess tracker to array
  const excessMaterials = Array.from(excessTracker.entries())
    .filter(([, qty]) => qty > 0)
    .map(([typeId, quantity]) => ({
      typeId,
      name: getTypeName(typeId),
      quantity,
      volume: (getTypeInfo(typeId)?.volume || 0) * quantity
    }))
  
  // Calculate totals
  const totalTime = buildSteps.reduce((sum, step) => sum + step.time, 0)
  const totalJobCost = buildSteps.reduce((sum, step) => sum + step.jobCost, 0)
  
  return {
    targetBlueprint: blueprint,
    rawMaterials: Array.from(rawMaterials.values()),
    buildSteps,
    totalTime,
    totalJobCost,
    excessMaterials
  }
}

/**
 * Search blueprints by name (for autocomplete)
 */
export function searchBlueprints(query: string, limit: number = 20): BlueprintData[] {
  const lowerQuery = query.toLowerCase()
  const results: BlueprintData[] = []
  
  for (const bp of Object.values(blueprints)) {
    if (results.length >= limit) break
    
    if (bp.blueprintName.toLowerCase().includes(lowerQuery) ||
        bp.productName.toLowerCase().includes(lowerQuery)) {
      results.push(bp)
    }
  }
  
  // Sort by relevance (exact matches first, then by name length)
  results.sort((a, b) => {
    const aStartsWith = a.productName.toLowerCase().startsWith(lowerQuery)
    const bStartsWith = b.productName.toLowerCase().startsWith(lowerQuery)
    if (aStartsWith && !bStartsWith) return -1
    if (!aStartsWith && bStartsWith) return 1
    return a.productName.length - b.productName.length
  })
  
  return results
}

/**
 * Format duration in EVE style (e.g., "2D 05:30:00")
 */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (days > 0) {
    return `${days}D ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Export structure data for UI dropdowns
export const industryStructures = structures.industryStructures
export const reactionStructures = structures.reactionStructures
export const rigs = structures.rigs
export const securityMultipliers = structures.securityMultipliers

