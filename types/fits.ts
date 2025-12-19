/**
 * Types for Alliance Fits feature
 */

/**
 * Slot types in EVE ship fittings
 */
export type FitSlotType = 'high' | 'mid' | 'low' | 'rig' | 'subsystem' | 'drone' | 'cargo'

/**
 * A single item in a parsed fit
 */
export interface FitItem {
  type_id: number | null  // null if item couldn't be resolved
  name: string
  quantity: number
  slot: FitSlotType
}

/**
 * Parsed EFT fitting result
 */
export interface ParsedFit {
  ship_type_id: number | null  // null if ship couldn't be resolved
  ship_name: string
  fit_name: string
  items: FitItem[]
  unresolved_items: string[]  // Item names that couldn't be resolved to type_ids
}

/**
 * Alliance fit stored in database
 */
export interface AllianceFit {
  id: string
  ship_type_id: number
  ship_name: string
  fit_name: string
  raw_eft: string
  items: FitItem[]
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Alliance fit with creator info for display
 */
export interface AllianceFitWithCreator extends AllianceFit {
  creator_name?: string
}

/**
 * Request body for creating a new fit
 */
export interface CreateFitRequest {
  raw_eft: string
}

/**
 * Response when creating a fit
 */
export interface CreateFitResponse {
  fit: AllianceFit
  unresolved_items: string[]
}

/**
 * Response when listing fits
 */
export interface ListFitsResponse {
  fits: AllianceFit[]
}

