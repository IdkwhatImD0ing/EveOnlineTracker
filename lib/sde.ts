/**
 * EVE Static Data Export (SDE) utilities
 * Uses pre-extracted JSON lookup from Fuzzwork's dump: https://www.fuzzwork.co.uk/dump/
 */

import typeGroups from '@/data/type-groups.json'

// Type the imported JSON
const typeGroupLookup = typeGroups as Record<string, string>

/**
 * Get the group name for a type ID
 */
export function getGroupName(typeId: number): string | null {
    return typeGroupLookup[typeId.toString()] || null
}

/**
 * Get group names for multiple type IDs (batch)
 */
export function getGroupNamesBatch(typeIds: number[]): Map<number, string> {
    const result = new Map<number, string>()
    for (const typeId of typeIds) {
        const groupName = typeGroupLookup[typeId.toString()]
        if (groupName) {
            result.set(typeId, groupName)
        }
    }
    return result
}
