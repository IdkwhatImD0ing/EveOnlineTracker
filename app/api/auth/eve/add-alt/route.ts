import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateState, getAuthorizationUrl } from '@/lib/eve-sso'
import { getAuthenticatedUser } from '@/lib/auth'
import { config } from '@/lib/config'

/**
 * GET /api/auth/eve/add-alt
 * 
 * Initiates OAuth flow to add an alt character.
 * Must be authenticated and allowed to use this endpoint.
 */
export async function GET() {
    // Check if user is authenticated and allowed
    const session = await getAuthenticatedUser()
    if (!session) {
        return NextResponse.json(
            { error: 'Must be logged in to add an alt' },
            { status: 401 }
        )
    }

    if (!session.user.allowed) {
        return NextResponse.json(
            { error: 'Account pending approval' },
            { status: 403 }
        )
    }

    const clientId = process.env.EVE_CLIENT_ID
    const callbackUrl = config.callbackUrl

    if (!clientId) {
        return NextResponse.json(
            { error: 'EVE_CLIENT_ID not configured' },
            { status: 500 }
        )
    }

    // Generate state with add_alt marker
    const state = generateState() + ':add_alt'

    // Store state in a cookie (expires in 10 minutes)
    const cookieStore = await cookies()
    cookieStore.set('eve_sso_state', state, {
        httpOnly: true,
        secure: config.isProd,
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
    })

    // Build authorization URL with same scopes as regular login
    const scopes: string[] = [
        'publicData',
        'esi-calendar.respond_calendar_events.v1',
        'esi-calendar.read_calendar_events.v1',
        'esi-location.read_location.v1',
        'esi-location.read_ship_type.v1',
        'esi-location.read_online.v1',
        'esi-mail.organize_mail.v1',
        'esi-mail.read_mail.v1',
        'esi-mail.send_mail.v1',
        'esi-skills.read_skills.v1',
        'esi-skills.read_skillqueue.v1',
        'esi-wallet.read_character_wallet.v1',
        'esi-wallet.read_corporation_wallet.v1',
        'esi-wallet.read_corporation_wallets.v1',
        'esi-search.search_structures.v1',
        'esi-universe.read_structures.v1',
        'esi-clones.read_clones.v1',
        'esi-clones.read_implants.v1',
        'esi-characters.read_contacts.v1',
        'esi-characters.write_contacts.v1',
        'esi-characters.read_loyalty.v1',
        'esi-characters.read_chat_channels.v1',
        'esi-characters.read_medals.v1',
        'esi-characters.read_standings.v1',
        'esi-characters.read_agents_research.v1',
        'esi-characters.read_blueprints.v1',
        'esi-characters.read_corporation_roles.v1',
        'esi-characters.read_fatigue.v1',
        'esi-characters.read_notifications.v1',
        'esi-characters.read_titles.v1',
        'esi-characters.read_fw_stats.v1',
        'esi-characters.read_freelance_jobs.v1',
        'esi-killmails.read_killmails.v1',
        'esi-killmails.read_corporation_killmails.v1',
        'esi-corporations.read_corporation_membership.v1',
        'esi-corporations.read_structures.v1',
        'esi-corporations.track_members.v1',
        'esi-corporations.read_divisions.v1',
        'esi-corporations.read_contacts.v1',
        'esi-corporations.read_titles.v1',
        'esi-corporations.read_blueprints.v1',
        'esi-corporations.read_standings.v1',
        'esi-corporations.read_starbases.v1',
        'esi-corporations.read_container_logs.v1',
        'esi-corporations.read_facilities.v1',
        'esi-corporations.read_medals.v1',
        'esi-corporations.read_fw_stats.v1',
        'esi-corporations.read_projects.v1',
        'esi-corporations.read_freelance_jobs.v1',
        'esi-assets.read_assets.v1',
        'esi-assets.read_corporation_assets.v1',
        'esi-planets.manage_planets.v1',
        'esi-planets.read_customs_offices.v1',
        'esi-fleets.read_fleet.v1',
        'esi-fleets.write_fleet.v1',
        'esi-ui.open_window.v1',
        'esi-ui.write_waypoint.v1',
        'esi-fittings.read_fittings.v1',
        'esi-fittings.write_fittings.v1',
        'esi-markets.structure_markets.v1',
        'esi-markets.read_character_orders.v1',
        'esi-markets.read_corporation_orders.v1',
        'esi-industry.read_character_jobs.v1',
        'esi-industry.read_corporation_jobs.v1',
        'esi-industry.read_character_mining.v1',
        'esi-industry.read_corporation_mining.v1',
        'esi-contracts.read_character_contracts.v1',
        'esi-contracts.read_corporation_contracts.v1',
        'esi-alliances.read_contacts.v1',
    ]

    const authUrl = getAuthorizationUrl(clientId, callbackUrl, state, scopes)

    // Redirect to EVE SSO
    return NextResponse.redirect(authUrl)
}

