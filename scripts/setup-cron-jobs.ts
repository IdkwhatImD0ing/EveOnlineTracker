/**
 * Setup script to create cron jobs on cron-job.org
 * 
 * This script provisions 52 cron jobs for market history updates:
 * - 20 jobs for The Forge (Jita) - region 10000002
 * - 20 jobs for Vale of the Silent - region 10000003
 * - 12 jobs for Deklein - region 10000035
 * 
 * Run with: npx tsx scripts/setup-cron-jobs.ts
 * 
 * Required environment variables:
 * - CRONJOB_API_KEY: Your cron-job.org API key
 * - CRON_SECRET: The secret used to authenticate cron requests
 * - VERCEL_URL: Your deployed Vercel app URL (e.g., eve-online-tracker.vercel.app)
 */

import * as fs from 'fs'
import * as path from 'path'

// Load environment variables from .env and .env.local
function loadEnvFile(filename: string) {
  const envPath = path.join(process.cwd(), filename)
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    const lines = envContent.split(/\r?\n/)
    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim()
        process.env[key] = value
      }
    }
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local') // .env.local overrides .env

const CRONJOB_API_KEY = process.env.CRONJOB_API_KEY
const CRON_SECRET = process.env.CRON_SECRET
const VERCEL_URL = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL

if (!CRONJOB_API_KEY) {
  console.error('Missing CRONJOB_API_KEY environment variable')
  process.exit(1)
}

if (!CRON_SECRET) {
  console.error('Missing CRON_SECRET environment variable')
  process.exit(1)
}

if (!VERCEL_URL) {
  console.error('Missing VERCEL_URL environment variable')
  process.exit(1)
}

const API_BASE = 'https://api.cron-job.org'

// Clean URL (remove protocol if present, we'll add https://)
const baseUrl = VERCEL_URL.replace(/^https?:\/\//, '')

interface CronJobSchedule {
  timezone: string
  hours: number[]
  mdays: number[]
  minutes: number[]
  months: number[]
  wdays: number[]
}

interface CronJobConfig {
  job: {
    url: string
    title: string
    enabled: boolean
    saveResponses: boolean
    schedule: CronJobSchedule
    requestMethod: number // 0 = GET
    extendedData: {
      headers: Record<string, string>
    }
  }
}

interface JobDefinition {
  title: string
  path: string
  hour: number
  minute: number
}

// Generate job definitions for all 48 jobs
function generateJobDefinitions(): JobDefinition[] {
  const jobs: JobDefinition[] = []

  // The Forge (Jita) - 20 jobs, chunks 0-19, minute :00, hours 0-19
  for (let chunk = 0; chunk < 20; chunk++) {
    jobs.push({
      title: `Market History - Jita - Chunk ${chunk}/20`,
      path: `/api/esi/market-history?mode=daily&chunk=${chunk}&total_chunks=20`,
      hour: chunk,
      minute: 0,
    })
  }

  // Vale of the Silent - 20 jobs, chunks 0-19, minute :20, hours 0-19
  for (let chunk = 0; chunk < 20; chunk++) {
    jobs.push({
      title: `Market History - Vale - Chunk ${chunk}/20`,
      path: `/api/esi/market-history?mode=daily&region_id=10000003&chunk=${chunk}&total_chunks=20`,
      hour: chunk,
      minute: 20,
    })
  }

  // Deklein - 12 jobs, chunks 0-11, minute :40, every 2 hours
  const dekleinHours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]
  for (let i = 0; i < 12; i++) {
    jobs.push({
      title: `Market History - Deklein - Chunk ${i}/12`,
      path: `/api/esi/market-history?mode=daily&region_id=10000035&chunk=${i}&total_chunks=12`,
      hour: dekleinHours[i],
      minute: 40,
    })
  }

  return jobs
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function createCronJob(jobDef: JobDefinition, retries = 3): Promise<{ success: boolean; jobId?: number; error?: string }> {
  const config: CronJobConfig = {
    job: {
      url: `https://${baseUrl}${jobDef.path}`,
      title: jobDef.title,
      enabled: true,
      saveResponses: true,
      schedule: {
        timezone: 'UTC',
        hours: [jobDef.hour],
        mdays: [-1], // Every day of month
        minutes: [jobDef.minute],
        months: [-1], // Every month
        wdays: [-1], // Every day of week
      },
      requestMethod: 0, // GET
      extendedData: {
        headers: {
          'Authorization': `Bearer ${CRON_SECRET}`,
        },
      },
    },
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/jobs`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CRONJOB_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (response.status === 429) {
        // Rate limited - wait longer and retry
        const waitTime = attempt * 10000 // 10s, 20s, 30s
        console.log(`    Rate limited, waiting ${waitTime / 1000}s before retry ${attempt}/${retries}...`)
        await sleep(waitTime)
        continue
      }

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, error: `HTTP ${response.status}: ${errorText}` }
      }

      const data = await response.json()
      return { success: true, jobId: data.jobId }
    } catch (error) {
      if (attempt === retries) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
      await sleep(2000)
    }
  }
  
  return { success: false, error: 'Max retries exceeded' }
}

async function listExistingJobs(retries = 5): Promise<{ jobId: number; title: string; url: string }[] | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/jobs`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CRONJOB_API_KEY}`,
        },
      })

      if (response.status === 429) {
        // Rate limited - wait and retry
        const waitTime = attempt * 10000 // 10s, 20s, 30s, 40s, 50s
        console.log(`  Rate limited, waiting ${waitTime / 1000}s before retry ${attempt}/${retries}...`)
        await sleep(waitTime)
        continue
      }

      if (!response.ok) {
        console.error('Failed to list existing jobs:', response.status)
        return null
      }

      const data = await response.json()
      return data.jobs || []
    } catch (error) {
      if (attempt === retries) {
        console.error('Error listing jobs after all retries:', error)
        return null
      }
      const waitTime = attempt * 10000
      console.log(`  Error occurred, waiting ${waitTime / 1000}s before retry ${attempt}/${retries}...`)
      await sleep(waitTime)
    }
  }
  
  console.error('Failed to list existing jobs after max retries')
  return null
}

async function deleteJob(jobId: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CRONJOB_API_KEY}`,
      },
    })
    return response.ok
  } catch {
    return false
  }
}

async function main() {
  console.log('=== cron-job.org Setup Script ===\n')
  console.log(`Target URL: https://${baseUrl}`)
  console.log(`CRON_SECRET: ${CRON_SECRET ? '[SET]' : '[MISSING]'}\n`)

  // Check for flags
  const shouldDelete = process.argv.includes('--delete')
  const shouldCreate = process.argv.includes('--create') || !process.argv.includes('--list')
  const shouldList = process.argv.includes('--list')
  const shouldFill = process.argv.includes('--fill') // Only create missing jobs

  // List existing jobs
  console.log('Fetching existing jobs...')
  const existingJobs = await listExistingJobs()
  
  // Exit if listing failed - don't proceed with incorrect data
  if (existingJobs === null) {
    console.error('\nERROR: Could not fetch existing jobs. Aborting to prevent duplicate job creation.')
    console.error('Please wait a few minutes for rate limit to reset and try again.')
    process.exit(1)
  }
  
  console.log(`Found ${existingJobs.length} existing jobs\n`)
  
  // Wait after listing to avoid rate limiting
  await sleep(2000)

  // Build set of existing job titles for quick lookup
  const existingTitles = new Set(existingJobs.map((job: { title: string }) => job.title))

  if (shouldList) {
    console.log('Existing jobs:')
    for (const job of existingJobs) {
      console.log(`  [${job.jobId}] ${job.title}`)
      console.log(`      URL: ${job.url}`)
    }
    return
  }

  if (shouldDelete && existingJobs.length > 0) {
    console.log('Deleting existing Market History jobs...')
    const marketHistoryJobs = existingJobs.filter((job: { title: string }) => 
      job.title.startsWith('Market History')
    )
    console.log(`  Found ${marketHistoryJobs.length} Market History jobs to delete\n`)
    
    for (const job of marketHistoryJobs) {
      const deleted = await deleteJob(job.jobId)
      console.log(`  ${deleted ? '✓' : '✗'} Deleted job ${job.jobId}: ${job.title}`)
      await sleep(3000) // Rate limit deletes too
    }
    console.log('')
    existingTitles.clear() // Clear since we deleted them
  }

  if (!shouldCreate) {
    return
  }

  // Generate and create jobs
  let jobDefinitions = generateJobDefinitions()
  
  // If --fill flag, only create missing jobs
  if (shouldFill) {
    const missingJobs = jobDefinitions.filter(job => !existingTitles.has(job.title))
    console.log(`Found ${missingJobs.length} missing jobs out of ${jobDefinitions.length} total\n`)
    jobDefinitions = missingJobs
    
    if (missingJobs.length === 0) {
      console.log('All jobs already exist!')
      return
    }
  }
  
  console.log(`Creating ${jobDefinitions.length} cron jobs...\n`)

  let successCount = 0
  let failCount = 0

  for (const jobDef of jobDefinitions) {
    const result = await createCronJob(jobDef)
    if (result.success) {
      console.log(`  ✓ Created: ${jobDef.title} (ID: ${result.jobId})`)
      successCount++
    } else {
      console.log(`  ✗ Failed: ${jobDef.title} - ${result.error}`)
      failCount++
    }

    // Rate limiting - cron-job.org has strict limits, wait 5 seconds between requests
    await sleep(5000)
  }

  console.log('\n=== Summary ===')
  console.log(`  Created: ${successCount}`)
  console.log(`  Failed: ${failCount}`)
  console.log(`  Total: ${jobDefinitions.length}`)
}

main().catch(console.error)

