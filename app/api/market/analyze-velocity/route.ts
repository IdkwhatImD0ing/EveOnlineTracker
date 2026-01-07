import OpenAI from 'openai';

// Lazy initialization to avoid build-time errors when OPENAI_API_KEY is not set
let client: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI();
  }
  return client;
}

const SYSTEM_INSTRUCTIONS = `You are a friendly EVE Online market advisor helping a trader in a nullsec alliance. Your job is to analyze their recent sales history and recommend which items they should import again from Jita.

## Your Analysis Should Cover:

1. **Top Performers**: Which items made the most ISK and why they're worth restocking
2. **Hidden Gems**: Items with good profit margins that might be overlooked
3. **Items to Reconsider**: Any items with low/negative profit that might not be worth the effort
4. **Trend Insights**: Is the trader's performance improving or declining? What might explain it?
5. **Actionable Recommendations**: A clear prioritized list of what to import next

## Guidelines:

1. Format your response in **markdown** with headers (##) and bullet points
2. Use plain English - no finance jargon. This is a game, keep it fun!
3. Be specific with item names and numbers
4. Focus on practical advice: "Import more X because..."
5. Consider profit per day, not just total profit - consistency matters
6. If an item sold well but has thin margins, mention the risk
7. Keep the response focused and actionable - 3-4 short paragraphs max
8. Do NOT suggest external research or follow-up actions - give concrete advice now

## EVE-Specific Context:

- The trader imports items from Jita (major trade hub) to their nullsec alliance market
- Higher profit per unit is good, but volume matters too - fast sellers are valuable
- Items with consistent daily sales are safer than one-off big sales
- Trend direction matters: improving means their strategy is working`;

interface TopPerformerItem {
  typeId: number;
  typeName: string;
  categoryName: string | null;
  totalProfit: number;
  totalRevenue: number;
  orderCount: number;
  quantitySold: number;
  profitPerDay: number;
}

interface VelocityTrend {
  direction: 'up' | 'down' | 'stable';
  percentChange: number;
  recentAvg: number;
  olderAvg: number;
}

interface VelocitySummary {
  avgProfitPerDay: number;
  bestDay: { date: string; profit: number };
  worstDay: { date: string; profit: number };
  totalProfit: number;
  totalRevenue: number;
  totalOrders: number;
  daysWithData: number;
}

interface AnalyzeVelocityRequestBody {
  topItems: TopPerformerItem[];
  trend: VelocityTrend;
  summary: VelocitySummary;
  period: '7d' | '30d' | '90d';
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

function getPeriodLabel(period: string): string {
  switch (period) {
    case '7d': return 'last 7 days';
    case '30d': return 'last 30 days';
    case '90d': return 'last 90 days';
    default: return period;
  }
}

export async function POST(request: Request) {
  try {
    const body: AnalyzeVelocityRequestBody = await request.json();
    const { topItems, trend, summary, period } = body;

    // Validate required fields
    if (!topItems || !trend || !summary || !period) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (topItems.length === 0) {
      return Response.json(
        { error: 'No items to analyze' },
        { status: 400 }
      );
    }

    // Build the item breakdown for the prompt
    const itemBreakdown = topItems.slice(0, 15).map((item, index) => {
      const profitPerUnit = item.quantitySold > 0 
        ? item.totalProfit / item.quantitySold 
        : 0;
      const margin = item.totalRevenue > 0 
        ? (item.totalProfit / item.totalRevenue * 100).toFixed(1) 
        : '0';
      
      return `${index + 1}. **${item.typeName}** (${item.categoryName || 'Unknown'})
   - Total Profit: ${formatISK(item.totalProfit)} | Profit/Day: ${formatISK(item.profitPerDay)}
   - Sold: ${item.quantitySold.toLocaleString()} units across ${item.orderCount} orders
   - Revenue: ${formatISK(item.totalRevenue)} | Margin: ${margin}%
   - Profit/Unit: ${formatISK(profitPerUnit)}`;
    }).join('\n\n');

    // Trend description
    let trendDescription = '';
    if (trend.direction === 'up') {
      trendDescription = `**Improving** (+${trend.percentChange.toFixed(1)}%) - Recent 7-day average of ${formatISK(trend.recentAvg)}/day is higher than the older period average of ${formatISK(trend.olderAvg)}/day`;
    } else if (trend.direction === 'down') {
      trendDescription = `**Declining** (${trend.percentChange.toFixed(1)}%) - Recent 7-day average of ${formatISK(trend.recentAvg)}/day is lower than the older period average of ${formatISK(trend.olderAvg)}/day`;
    } else {
      trendDescription = `**Stable** - Recent performance is consistent with historical average`;
    }

    const prompt = `Analyze this EVE Online trader's sales performance from the ${getPeriodLabel(period)} and recommend what to import next:

## Overall Performance

- **Total Profit**: ${formatISK(summary.totalProfit)}
- **Average Profit/Day**: ${formatISK(summary.avgProfitPerDay)}
- **Total Revenue**: ${formatISK(summary.totalRevenue)}
- **Orders Completed**: ${summary.totalOrders.toLocaleString()}
- **Days with Sales**: ${summary.daysWithData}
- **Best Day**: ${summary.bestDay.date ? `${summary.bestDay.date} (${formatISK(summary.bestDay.profit)})` : 'N/A'}

## Trend Analysis

${trendDescription}

## Top Performing Items (by total profit)

${itemBreakdown}

---

Based on this data, provide:
1. Your top 3-5 recommendations for items to prioritize importing
2. Any items that might not be worth the effort (low margin or inconsistent)
3. Brief insights on the overall trend and what it might mean
4. One actionable tip to improve performance`;

    // Use streaming for real-time response with low reasoning effort
    const stream = await getOpenAIClient().responses.create({
      model: "gpt-5-mini",
      reasoning: { effort: "low" },
      instructions: SYSTEM_INSTRUCTIONS,
      input: prompt,
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
    console.error('Analyze Velocity API error:', error);
    return Response.json(
      { error: 'Failed to analyze trading velocity' },
      { status: 500 }
    );
  }
}

