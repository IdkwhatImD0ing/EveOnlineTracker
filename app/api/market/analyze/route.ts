import OpenAI from 'openai';

// Lazy initialization to avoid build-time errors when OPENAI_API_KEY is not set
let client: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI();
  }
  return client;
}

const SYSTEM_INSTRUCTIONS = `You are a friendly EVE Online market advisor. Explain things in **simple, easy-to-understand language** - avoid technical jargon. The user is a regular player, not a financial analyst.

## What the signals mean (explain these simply to users):

**Cycle Signal**: Does this item's price go up and down in a predictable pattern?
- Positive = "The price tends to bounce back after dropping, and right now it's low"
- Negative = "The price is high in its usual pattern and might drop soon"

**Trend Signal**: Is the price generally going up or down lately?
- Positive = "The price has been recovering/climbing recently"
- Negative = "The price is still falling - might want to wait"

**Support Signal**: Has the price bounced back from this level before?
- Positive = "This price level has held before - it's like a floor the price doesn't usually go below"
- Negative = "We're in uncharted territory - no historical floor to rely on"

**Volume Signal**: Are other traders buying at these low prices?
- Positive = "Lots of people are buying while it's cheap - usually a good sign"
- Negative = "People are selling heavily - could drop more"

**Score Tiers**: 70+ = Great opportunity, 40-69 = Good, 20-39 = Okay but risky, <20 = Skip

## Your job:
1. Format your response in **markdown** with headers (##) and bullet points
2. Explain why this is a good buy in 2-3 short paragraphs
3. Use plain English - no finance jargon
4. Search for recent EVE Online news/patches that might affect this item
5. Be honest about risks if any signals are negative
6. Do NOT suggest next steps or follow-up actions - this is a one-time analysis

## Web Search Rules (IMPORTANT):
- ONLY use official EVE Online sources: eveonline.com, community.eveonline.com
- Search for recent patch notes using queries like: "EVE Online patch notes [item name] site:eveonline.com"
- DO NOT cite or reference third-party market tools (Goonmetrics, evemarketer, eve-central, etc.)
- Only reference patch notes from the last 2-3 months - ignore anything older
- If no recent official news is found, simply state "No recent patch notes affecting this item" - do not speculate or cite old/irrelevant sources`;

interface AnalyzeRequestBody {
  itemName: string;
  typeId: number;
  signals: {
    cycle: { score: number; reason: string };
    trend: { score: number; reason: string };
    support: { score: number; reason: string };
    volume: { score: number; reason: string };
    totalScore: number;
    tier: string;
  };
  currentPrice: number;
  avgPrice: number;
  weeklyIskPotential: number;
}

function formatISK(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  } else if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toFixed(2);
}

export async function POST(request: Request) {
  try {
    const body: AnalyzeRequestBody = await request.json();
    const { itemName, signals, currentPrice, avgPrice, weeklyIskPotential } = body;

    // Validate required fields
    if (!itemName || !signals || !currentPrice || !avgPrice) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const potentialGain = ((avgPrice - currentPrice) / currentPrice * 100).toFixed(1);
    
    // Get today's date for the AI to know what "recent" means
    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Use streaming for real-time response with low reasoning effort
    const stream = await getOpenAIClient().responses.create({
      model: "gpt-5-mini",
      reasoning: { effort: "low" },
      instructions: SYSTEM_INSTRUCTIONS,
      input: `**Today's Date**: ${today}

Analyze this EVE Online market opportunity:

**Item**: ${itemName}
**Current Price**: ${formatISK(currentPrice)} ISK
**Average Price**: ${formatISK(avgPrice)} ISK
**Potential Gain**: ${potentialGain}%
**Weekly ISK Potential**: ${formatISK(weeklyIskPotential)} ISK

**Signal Breakdown**:
- Cycle: ${signals.cycle.score.toFixed(0)} pts - "${signals.cycle.reason}"
- Trend: ${signals.trend.score.toFixed(0)} pts - "${signals.trend.reason}"
- Support: ${signals.support.score.toFixed(0)} pts - "${signals.support.reason}"
- Volume: ${signals.volume.score.toFixed(0)} pts - "${signals.volume.reason}"
- **Total Score**: ${signals.totalScore} (${signals.tier})

Search for EVE Online patch notes from the last 2-3 months that might affect "${itemName}" on official sites (eveonline.com).
If you find relevant recent news, mention it. If not, just say "No recent patch notes found" - don't cite old or third-party sources.

Based on the signals above, explain why this is a good buying opportunity.`,
      tools: [{ type: "web_search" }],
      stream: true
    });

    // Return as a readable stream for real-time UI updates
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            // Stream reasoning chunks
            if ((event.type as string) === 'response.reasoning.delta') {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: 'reasoning', 
                  delta: (event as unknown as { delta: string }).delta 
                })}\n\n`)
              );
            }
            // Notify when web search tool is called
            if ((event.type as string) === 'response.tool_call.created') {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: 'tool_call', 
                  tool: (event as unknown as { tool_call?: { type?: string } }).tool_call?.type || 'web_search',
                  status: 'started'
                })}\n\n`)
              );
            }
            // Notify when tool call completes
            if ((event.type as string) === 'response.tool_call.done') {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: 'tool_call', 
                  tool: 'web_search',
                  status: 'done'
                })}\n\n`)
              );
            }
            // Stream output text
            if ((event.type as string) === 'response.output_text.delta') {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: 'output', 
                  delta: (event as unknown as { delta: string }).delta 
                })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`)
          );
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
  } catch (error) {
    console.error('Analyze API error:', error);
    return Response.json(
      { error: 'Failed to analyze opportunity' },
      { status: 500 }
    );
  }
}

