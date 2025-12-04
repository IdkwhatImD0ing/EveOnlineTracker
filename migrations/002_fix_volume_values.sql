-- Migration: Fix volume values that were stored as total volume instead of per-unit volume
-- The volume field should store per-unit volume (like buy_price and sell_price)
-- but was incorrectly storing total volume (per-unit × quantity)

-- Fix raw_materials table
UPDATE raw_materials
SET volume = volume / quantity
WHERE volume IS NOT NULL 
  AND quantity > 0;

-- Fix components table
UPDATE components
SET volume = volume / quantity
WHERE volume IS NOT NULL 
  AND quantity > 0;

