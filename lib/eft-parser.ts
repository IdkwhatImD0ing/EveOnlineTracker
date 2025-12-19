/**
 * EFT (EVE Fitting Tool) format parser
 * 
 * Parses ship fittings in the standard EFT format and resolves item names to type IDs
 * using the EVE SDE (Static Data Export).
 * 
 * EFT Format:
 * [Ship Name, Fit Name]
 * 
 * Low Slot Module
 * Low Slot Module
 * 
 * Mid Slot Module
 * Mid Slot Module
 * 
 * High Slot Module
 * High Slot Module
 * 
 * Rig Module
 * 
 * 
 * Drone Name x5
 * 
 * Ammo Name x100
 */

import type { FitItem, FitSlotType, ParsedFit } from '@/types/fits'
import invTypes from '@/data/inv-types.json'

// Type the imported JSON
interface InvType {
  name: string
  groupId: number
  volume: number
}

const invTypesData = invTypes as Record<string, InvType>

// Build reverse lookup: name (lowercase) -> type_id
let nameToTypeId: Map<string, number> | null = null

function getNameToTypeIdMap(): Map<string, number> {
  if (nameToTypeId === null) {
    nameToTypeId = new Map()
    for (const [typeId, data] of Object.entries(invTypesData)) {
      // Store lowercase for case-insensitive matching
      nameToTypeId.set(data.name.toLowerCase(), parseInt(typeId, 10))
    }
  }
  return nameToTypeId
}

/**
 * Resolve an item name to its EVE type ID
 * Returns null if the item cannot be found
 */
export function resolveTypeId(itemName: string): number | null {
  const lookup = getNameToTypeIdMap()
  return lookup.get(itemName.toLowerCase().trim()) ?? null
}

/**
 * Get item name from type ID
 */
export function getItemName(typeId: number): string | null {
  const data = invTypesData[typeId.toString()]
  return data?.name ?? null
}

/**
 * Parse quantity from item line (e.g., "Warrior II x10" -> { name: "Warrior II", quantity: 10 })
 */
function parseQuantity(line: string): { name: string; quantity: number } {
  // Match pattern: "Item Name x123" or "Item Name x 123"
  const match = line.match(/^(.+?)\s*x\s*(\d+)$/i)
  if (match) {
    return {
      name: match[1].trim(),
      quantity: parseInt(match[2], 10)
    }
  }
  return { name: line.trim(), quantity: 1 }
}

/**
 * Determine slot type based on position in the EFT format
 * 
 * EFT slot order (separated by empty lines):
 * 1. Low slots
 * 2. Mid slots  
 * 3. High slots
 * 4. Rigs
 * 5. Subsystems (T3 ships only)
 * 6. Drones
 * 7. Cargo (ammo, scripts, etc.)
 * 
 * Note: The order can vary, but typically follows this pattern.
 * We use group order and some heuristics.
 */
function determineSlotType(groupIndex: number, totalGroups: number): FitSlotType {
  // Common patterns based on group index
  // Groups 0-2 are typically low/mid/high
  // Later groups are rigs, then subsystems/drones/cargo
  
  if (groupIndex === 0) return 'low'
  if (groupIndex === 1) return 'mid'
  if (groupIndex === 2) return 'high'
  if (groupIndex === 3) return 'rig'
  
  // For remaining groups, default to cargo (drones, ammo, etc.)
  if (groupIndex >= totalGroups - 2) return 'cargo'
  if (groupIndex === totalGroups - 3) return 'drone'
  
  return 'subsystem'
}

/**
 * Parse an EFT-formatted ship fitting
 * 
 * @param eftText - The raw EFT text to parse
 * @returns Parsed fit with resolved type IDs
 */
export function parseEFT(eftText: string): ParsedFit {
  const lines = eftText.split('\n').map(l => l.trim())
  const unresolvedItems: string[] = []
  
  // Parse header: [Ship Name, Fit Name]
  const headerLine = lines.find(l => l.startsWith('[') && l.includes(','))
  if (!headerLine) {
    throw new Error('Invalid EFT format: Missing header line [Ship Name, Fit Name]')
  }
  
  // Extract ship name and fit name from header
  const headerMatch = headerLine.match(/^\[(.+?),\s*(.+)\]$/)
  if (!headerMatch) {
    throw new Error('Invalid EFT format: Header must be [Ship Name, Fit Name]')
  }
  
  const shipName = headerMatch[1].trim()
  const fitName = headerMatch[2].trim()
  
  // Resolve ship type ID
  const shipTypeId = resolveTypeId(shipName)
  if (shipTypeId === null) {
    unresolvedItems.push(`Ship: ${shipName}`)
  }
  
  // Group remaining lines by empty lines (slot groups)
  const groups: string[][] = []
  let currentGroup: string[] = []
  
  for (const line of lines) {
    // Skip header and empty processing
    if (line.startsWith('[')) continue
    
    if (line === '') {
      if (currentGroup.length > 0) {
        groups.push(currentGroup)
        currentGroup = []
      }
    } else {
      currentGroup.push(line)
    }
  }
  
  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }
  
  // Parse items from each group
  const items: FitItem[] = []
  
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex]
    const slotType = determineSlotType(groupIndex, groups.length)
    
    for (const line of group) {
      // Skip [Empty * Slot] lines
      if (line.match(/^\[Empty .+ slot\]$/i)) continue
      
      const { name, quantity } = parseQuantity(line)
      const typeId = resolveTypeId(name)
      
      if (typeId === null) {
        unresolvedItems.push(name)
      }
      
      items.push({
        type_id: typeId,
        name,
        quantity,
        slot: slotType
      })
    }
  }
  
  return {
    ship_type_id: shipTypeId,
    ship_name: shipName,
    fit_name: fitName,
    items,
    unresolved_items: unresolvedItems
  }
}

/**
 * Validate that an EFT string is parseable
 * Returns null if valid, error message if invalid
 */
export function validateEFT(eftText: string): string | null {
  try {
    const result = parseEFT(eftText)
    
    // Check for critical issues
    if (result.ship_type_id === null) {
      return `Unknown ship: ${result.ship_name}`
    }
    
    if (result.items.length === 0) {
      return 'Fit has no items'
    }
    
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid EFT format'
  }
}

