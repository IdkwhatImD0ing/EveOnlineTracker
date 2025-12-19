/**
 * Centralized deployment configuration
 * 
 * Auto-detects Vercel deployments using VERCEL environment variable.
 * Falls back to localhost for local development.
 */

// Vercel automatically sets VERCEL=1 when running on their platform
const isVercel = process.env.VERCEL === '1'

// VERCEL_ENV is 'production', 'preview', or 'development'
const vercelEnv = process.env.VERCEL_ENV

const isProd = isVercel && vercelEnv === 'production'
const isDev = !isVercel

// Production URL for the app
const PROD_URL = 'https://www.eveonlinetracker.com'
const DEV_URL = 'http://localhost:3000'

// Slyce alliance ID for auto-approval
// Can be found via ESI or zkillboard - set in environment variable
const SLYCE_ALLIANCE_ID = process.env.SLYCE_ALLIANCE_ID 
  ? parseInt(process.env.SLYCE_ALLIANCE_ID) 
  : null

export const config = {
  /** True if running on Vercel */
  isVercel,
  
  /** True if running locally */
  isDev,
  
  /** True if running in Vercel production */
  isProd,
  
  /** Vercel environment (production/preview/development) or undefined if local */
  vercelEnv,
  
  /** Base URL for the application */
  baseUrl: isProd ? PROD_URL : isDev ? DEV_URL : PROD_URL,
  
  /** EVE SSO callback URL */
  callbackUrl: isProd 
    ? `${PROD_URL}/callback` 
    : isDev 
      ? `${DEV_URL}/callback`
      : `${PROD_URL}/callback`,
  
  /** Slyce alliance ID for auto-approval of alliance members */
  slyceAllianceId: SLYCE_ALLIANCE_ID,
} as const

