import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/internal-rpc";
import { getDb } from "@/lib/server-db";
import { sql } from "drizzle-orm";

// Cost per 1M tokens (USD) — update as pricing changes
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o":            { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":       { input: 0.15,  output: 0.60  },
  "gpt-4-turbo":       { input: 10.00, output: 30.00 },
  "claude-sonnet-4-6": { input: 3.00,  output: 15.00 },
  "claude-haiku-4-5":  { input: 0.80,  output: 4.00  },
};

function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const prices = MODEL_COSTS[model] || { input: 2.50, output: 10.00 };
  return (inputTokens / 1_000_000) * prices.input + (outputTokens / 1_000_000) * prices.output;
}

// POST — registrar uso de tokens
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const { channelId, npcId, agentId, sessionKey, model, motorType, inputTokens, outputTokens, taskId } = body;
  const totalTokens = (inputTokens || 0) + (outputTokens || 0);
  const costUsd = calcCost(model || "gpt-4o", inputTokens || 0, outputTokens || 0);

  const db = getDb();
  await db.execute(sql`
    INSERT INTO token_usage (channel_id, npc_id, agent_id, session_key, model, motor_type, input_tokens, output_tokens, total_tokens, cost_usd, task_id)
    VALUES (
      ${channelId || null}, ${npcId || null}, ${agentId || null}, ${sessionKey || null},
      ${model || "gpt-4o"}, ${motorType || "openai"},
      ${inputTokens || 0}, ${outputTokens || 0}, ${totalTokens},
      ${costUsd}, ${taskId || null}
    )
  `);

  return NextResponse.json({ ok: true });
}

// GET — relatório de uso
// ?period=today|week|month  &groupBy=agent|task|model
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "today";
  const groupBy = searchParams.get("groupBy") || "agent";

  const intervals: Record<string, string> = {
    today: "1 day", week: "7 days", month: "30 days",
  };
  const interval = intervals[period] || "1 day";

  const db = getDb();

  // Totais gerais
  const totals = await db.execute(sql`
    SELECT
      COALESCE(SUM(total_tokens), 0)  AS total_tokens,
      COALESCE(SUM(input_tokens), 0)  AS input_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens,
      COALESCE(SUM(cost_usd), 0)      AS cost_usd
    FROM token_usage
    WHERE created_at >= now() - ${sql.raw(`interval '${interval}'`)}
  `);

  // Por agente (NPC)
  const byAgent = await db.execute(sql`
    SELECT
      tu.npc_id,
      n.name AS npc_name,
      tu.model,
      tu.motor_type,
      COALESCE(SUM(tu.total_tokens), 0)  AS total_tokens,
      COALESCE(SUM(tu.cost_usd), 0)      AS cost_usd,
      COUNT(*) AS interactions
    FROM token_usage tu
    LEFT JOIN npcs n ON n.id = tu.npc_id
    WHERE tu.created_at >= now() - ${sql.raw(`interval '${interval}'`)}
    GROUP BY tu.npc_id, n.name, tu.model, tu.motor_type
    ORDER BY total_tokens DESC
    LIMIT 50
  `);

  // Por tarefa
  const byTask = await db.execute(sql`
    SELECT
      tu.task_id,
      t.title AS task_title,
      COALESCE(SUM(tu.total_tokens), 0) AS total_tokens,
      COALESCE(SUM(tu.cost_usd), 0)     AS cost_usd
    FROM token_usage tu
    LEFT JOIN tasks t ON t.id = tu.task_id
    WHERE tu.created_at >= now() - ${sql.raw(`interval '${interval}'`)}
      AND tu.task_id IS NOT NULL
    GROUP BY tu.task_id, t.title
    ORDER BY total_tokens DESC
    LIMIT 50
  `);

  // Série temporal (últimas 24h por hora, ou últimos 7d por dia)
  const timeSeries = await db.execute(sql`
    SELECT
      date_trunc(${period === "today" ? "hour" : "day"}, created_at) AS period,
      SUM(total_tokens) AS total_tokens,
      SUM(cost_usd)     AS cost_usd
    FROM token_usage
    WHERE created_at >= now() - ${sql.raw(`interval '${interval}'`)}
    GROUP BY 1
    ORDER BY 1
  `);

  return NextResponse.json({
    totals: totals.rows[0],
    byAgent: byAgent.rows,
    byTask: byTask.rows,
    timeSeries: timeSeries.rows,
  });
}
