-- token_usage: rastreia tokens consumidos por agente/tarefa/sessão
CREATE TABLE IF NOT EXISTS "token_usage" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel_id"    uuid,
  "npc_id"        uuid,
  "agent_id"      text,
  "session_key"   text,
  "model"         varchar(100) NOT NULL,
  "motor_type"    varchar(20) DEFAULT 'openai' NOT NULL,
  "input_tokens"  integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "total_tokens"  integer DEFAULT 0 NOT NULL,
  "cost_usd"      numeric(10, 6) DEFAULT 0,
  "task_id"       uuid,
  "created_at"    timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "token_usage_channel_idx" ON "token_usage" ("channel_id");
CREATE INDEX IF NOT EXISTS "token_usage_npc_idx"     ON "token_usage" ("npc_id");
CREATE INDEX IF NOT EXISTS "token_usage_created_idx" ON "token_usage" ("created_at");
