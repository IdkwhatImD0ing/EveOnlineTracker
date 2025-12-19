/**
 * Fix Ship Packaged Volumes
 * 
 * Updates tradeable-items.jsonl to use correct packaged volumes for ships
 * instead of assembled volumes.
 */

const fs = require('fs');
const path = require('path');

// Ship group to packaged volume mapping (in m³)
const PACKAGED_VOLUMES = {
  // 500 m³
  'Shuttle': 500,
  'Capsule': 500,
  
  // 2,500 m³ - Frigates
  'Frigate': 2500,
  'Assault Frigate': 2500,
  'Covert Ops': 2500,
  'Electronic Attack Ship': 2500,
  'Expedition Frigate': 2500,
  'Interceptor': 2500,
  'Logistics Frigate': 2500,
  'Stealth Bomber': 2500,
  'Corvette': 2500,
  
  // 5,000 m³ - Destroyers, Mining Barges, T3 Cruisers
  'Destroyer': 5000,
  'Command Destroyer': 5000,
  'Interdictor': 5000,
  'Tactical Destroyer': 5000,
  'Mining Barge': 5000,
  'Strategic Cruiser': 5000,
  
  // 10,000 m³ - Cruisers
  'Cruiser': 10000,
  'Combat Recon Ship': 10000,
  'Force Recon Ship': 10000,
  'Heavy Assault Cruiser': 10000,
  'Heavy Interdiction Cruiser': 10000,
  'Logistics': 10000,
  'Flag Cruiser': 10000,
  
  // 15,000 m³ - Battlecruisers, Exhumers
  'Attack Battlecruiser': 15000,
  'Combat Battlecruiser': 15000,
  'Command Ship': 15000,
  'Exhumer': 15000,
  
  // 20,000 m³ - Haulers
  'Hauler': 20000,
  'Blockade Runner': 20000,
  'Deep Space Transport': 20000,
  
  // 50,000 m³ - Battleships
  'Battleship': 50000,
  'Black Ops': 50000,
  'Marauder': 50000,
  
  // 500,000 m³ - Freighters
  'Freighter': 500000,
  'Jump Freighter': 500000,
  
  // 1,000,000 m³ - Capital Industrials
  'Capital Industrial Ship': 1000000,
  'Industrial Command Ship': 1000000,
  'Expedition Command Ship': 1000000,
  
  // 1,300,000 m³ - Capitals
  'Carrier': 1300000,
  'Force Auxiliary': 1300000,
  'Dreadnought': 1300000,
  'Lancer Dreadnought': 1300000,
  
  // 5,000,000 m³ - Supercarriers
  'Supercarrier': 5000000,
  
  // 10,000,000 m³ - Titans
  'Titan': 10000000,
  
  // Special - keep original
  'Prototype Exploration Ship': null,
};

const inputPath = path.join(__dirname, '..', 'data', 'tradeable-items.jsonl');
const outputPath = inputPath; // Overwrite in place

console.log('Reading tradeable-items.jsonl...');
const content = fs.readFileSync(inputPath, 'utf-8');
const lines = content.trim().split('\n');

let updatedCount = 0;
let skippedCount = 0;
const updates = [];

const updatedLines = lines.map((line, index) => {
  try {
    const item = JSON.parse(line);
    
    // Only process ships
    if (item.categoryName !== 'Ship') {
      return line;
    }
    
    const groupName = item.groupName;
    const newVolume = PACKAGED_VOLUMES[groupName];
    
    if (newVolume === null) {
      // Keep original for special ships
      skippedCount++;
      return line;
    }
    
    if (newVolume === undefined) {
      console.warn(`Unknown ship group: ${groupName} (${item.name})`);
      skippedCount++;
      return line;
    }
    
    if (item.volume !== newVolume) {
      updates.push({
        name: item.name,
        group: groupName,
        oldVolume: item.volume,
        newVolume: newVolume
      });
      item.volume = newVolume;
      updatedCount++;
    }
    
    return JSON.stringify(item);
  } catch (e) {
    console.error(`Error parsing line ${index + 1}: ${e.message}`);
    return line;
  }
});

console.log(`\nUpdating ${updatedCount} ships...`);
console.log(`Skipped ${skippedCount} ships (special or unknown groups)\n`);

// Show some example updates
console.log('Sample updates:');
updates.slice(0, 10).forEach(u => {
  console.log(`  ${u.name} (${u.group}): ${u.oldVolume.toLocaleString()} m³ → ${u.newVolume.toLocaleString()} m³`);
});
if (updates.length > 10) {
  console.log(`  ... and ${updates.length - 10} more`);
}

// Write updated file
fs.writeFileSync(outputPath, updatedLines.join('\n') + '\n');
console.log(`\nWritten to ${outputPath}`);
console.log('Done!');

