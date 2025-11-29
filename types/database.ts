/**
 * Database types for the Eve Online Industry Tracker
 */

export interface Project {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface RawMaterial {
  id: string
  project_id: string
  item_name: string
  type_id: number
  quantity: number
  collected: boolean
  buy_price: number | null
  sell_price: number | null
  split_price: number | null
  volume: number | null
  item_type: string | null
}

export interface Component {
  id: string
  project_id: string
  item_name: string
  type_id: number
  quantity: number
  collected: boolean
  buy_price: number | null
  sell_price: number | null
  split_price: number | null
  volume: number | null
  item_type: string | null
}

export interface AdditionalCost {
  id: string
  project_id: string
  note: string
  amount: number
  created_at: string
}

export interface ProjectWithDetails extends Project {
  raw_materials: RawMaterial[]
  components: Component[]
  additional_costs: AdditionalCost[]
}

// API request/response types
export interface CreateProjectRequest {
  name: string
  rawMaterialsInput: string
  componentsInput: string
}

export interface UpdateItemRequest {
  collected: boolean
}

export interface CreateAdditionalCostRequest {
  note: string
  amount: number
}

