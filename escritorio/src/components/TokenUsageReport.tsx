"use client";

import { useEffect, useState } from "react";

type Period = "today" | "week" | "month";

interface Totals {
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

interface AgentRow {
  npc_id: string;
  npc_name: string;
  model: string;
  motor_type: string;
  total_tokens: number;
  cost_usd: number;
  interactions: number;
}

interface TaskRow {
  task_id: string;
  task_title: string;
  total_tokens: number;
  cost_usd: number;
}

interface TimePoint {
  period: string;
  total_tokens: number;
  cost_usd: number;
}

function fmt(n: number) { return Number(n).toLocaleString("pt-BR"); }
function fmtUsd(n: number) { return `$${Number(n).toFixed(4)}`; }

export function TokenUsageReport() {
  const [period, setPeriod] = useState<Period>("today");
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [byAgent, setByAgent] = useState<AgentRow[]>([]);
  const [byTask, setByTask] = useState<TaskRow[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimePoint[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/token-usage?period=${period}`)
      .then(r => r.json())
      .then(data => {
        setTotals(data.totals);
        setByAgent(data.byAgent || []);
        setByTask(data.byTask || []);
        setTimeSeries(data.timeSeries || []);
      })
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="p-6 space-y-6 text-white max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">📊 Relatório de Tokens</h2>
        <div className="flex gap-2">
          {(["today", "week", "month"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                period === p ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {{ today: "Hoje", week: "7 dias", month: "30 dias" }[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Carregando...</div>
      ) : (
        <>
          {/* Totais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total de Tokens", value: fmt(totals?.total_tokens || 0), icon: "🔢" },
              { label: "Tokens de Entrada", value: fmt(totals?.input_tokens || 0), icon: "📥" },
              { label: "Tokens de Saída", value: fmt(totals?.output_tokens || 0), icon: "📤" },
              { label: "Custo Estimado", value: fmtUsd(totals?.cost_usd || 0), icon: "💵" },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-2xl mb-1">{icon}</div>
                <div className="text-xl font-bold">{value}</div>
                <div className="text-xs text-gray-400 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Por Agente */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 font-semibold text-sm">
              🤖 Por Agente
            </div>
            {byAgent.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-500">Nenhum dado no período.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-900/50">
                  <tr>
                    {["Agente", "Motor", "Modelo", "Tokens", "Custo", "Interações"].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-gray-400 font-medium text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byAgent.map((row, i) => (
                    <tr key={i} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-4 py-2 font-medium">{row.npc_name || row.npc_id || "—"}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          row.motor_type === "openai" ? "bg-green-900/50 text-green-400" : "bg-indigo-900/50 text-indigo-400"
                        }`}>
                          {row.motor_type === "openai" ? "🌐 OpenAI" : "⚡ Claude"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{row.model}</td>
                      <td className="px-4 py-2 font-mono">{fmt(row.total_tokens)}</td>
                      <td className="px-4 py-2 font-mono text-yellow-400">{fmtUsd(row.cost_usd)}</td>
                      <td className="px-4 py-2 text-gray-400">{row.interactions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Por Tarefa */}
          {byTask.length > 0 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700 font-semibold text-sm">
                📋 Por Tarefa
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-900/50">
                  <tr>
                    {["Tarefa", "Tokens", "Custo"].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-gray-400 font-medium text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byTask.map((row, i) => (
                    <tr key={i} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-4 py-2">{row.task_title || row.task_id}</td>
                      <td className="px-4 py-2 font-mono">{fmt(row.total_tokens)}</td>
                      <td className="px-4 py-2 font-mono text-yellow-400">{fmtUsd(row.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
