import { NextResponse, type NextRequest } from 'next/server'

// Simplified proxy - no Supabase session handling needed
// All routes are protected by the custom auth layer (AuthGate)
export async function updateSession(request: NextRequest) {
  return NextResponse.next({ request })
}

