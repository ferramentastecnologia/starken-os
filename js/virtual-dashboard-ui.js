/**
 * Virtual CEO Dashboard UI
 * Dashboard centralizado do CEO Bot com métricas consolidadas
 */

// ─── State ───
let voDashboardData = null;
let voSelectedPeriod = 'daily';

// ─── Load Dashboard ───
async function voLoadDashboard(npcCentralId, reportPeriod = null) {
  try {
    const params = { npc_central_id: npcCentralId };
    if (reportPeriod) {
      params.report_period = reportPeriod;
    }
    params.period_type = voSelectedPeriod;

    const result = await VO.apiCall('vo_ceo_dashboard', params);
    voDashboardData = result.dashboard;
    return voDashboardData;
  } catch (err) {
    console.error('[VO Dashboard] Failed to load:', err);
    return null;
  }
}

// ─── Render CEO Dashboard ───
async function voRenderCeoDashboard() {
  const container = document.getElementById('vo-dashboard-container');
  if (!container || !voDashboardData) return;

  const data = voDashboardData;

  let html = `
    <div style="padding:20px">
      <!-- Header com período -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--border)">
        <div>
          <h1 style="margin:0;color:var(--text-primary);font-size:2rem">📊 Dashboard Executivo</h1>
          <p style="margin:8px 0 0;color:var(--text-secondary)">Consolidação em tempo real - ${new Date(data.report_period).toLocaleDateString('pt-BR')}</p>
        </div>
        <div style="display:flex;gap:8px">
          <button
            onclick="voChangePeriod('daily')"
            style="padding:8px 16px;background:${voSelectedPeriod === 'daily' ? 'var(--brand)' : 'var(--border)'};color:${voSelectedPeriod === 'daily' ? 'white' : 'var(--text-primary)'};border:none;border-radius:4px;cursor:pointer;font-weight:600;transition:all 0.2s"
            onmouseover="this.style.opacity='0.8'"
            onmouseout="this.style.opacity='1'"
          >
            Diário
          </button>
          <button
            onclick="voChangePeriod('weekly')"
            style="padding:8px 16px;background:${voSelectedPeriod === 'weekly' ? 'var(--brand)' : 'var(--border)'};color:${voSelectedPeriod === 'weekly' ? 'white' : 'var(--text-primary)'};border:none;border-radius:4px;cursor:pointer;font-weight:600;transition:all 0.2s"
            onmouseover="this.style.opacity='0.8'"
            onmouseout="this.style.opacity='1'"
          >
            Semanal
          </button>
          <button
            onclick="voChangePeriod('monthly')"
            style="padding:8px 16px;background:${voSelectedPeriod === 'monthly' ? 'var(--brand)' : 'var(--border)'};color:${voSelectedPeriod === 'monthly' ? 'white' : 'var(--text-primary)'};border:none;border-radius:4px;cursor:pointer;font-weight:600;transition:all 0.2s"
            onmouseover="this.style.opacity='0.8'"
            onmouseout="this.style.opacity='1'"
          >
            Mensal
          </button>
        </div>
      </div>

      <!-- KPIs Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:32px">
        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:16px">
          <p style="margin:0 0 8px;color:var(--text-secondary);font-size:0.9rem">Clientes Ativos</p>
          <p style="margin:0;font-size:2rem;font-weight:800;color:var(--brand)">${data.total_clients || 0}</p>
        </div>

        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:16px">
          <p style="margin:0 0 8px;color:var(--text-secondary);font-size:0.9rem">NPCs Online</p>
          <p style="margin:0;font-size:2rem;font-weight:800;color:var(--color-success)">${data.total_npcs_active || 0}</p>
        </div>

        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:16px">
          <p style="margin:0 0 8px;color:var(--text-secondary);font-size:0.9rem">Tarefas Pendentes</p>
          <p style="margin:0;font-size:2rem;font-weight:800;color:var(--color-warning)">${data.total_tasks_pending || 0}</p>
        </div>

        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:16px">
          <p style="margin:0 0 8px;color:var(--text-secondary);font-size:0.9rem">Taxa de Sucesso</p>
          <p style="margin:0;font-size:2rem;font-weight:800;color:var(--color-success)">${data.avg_performance_score || 0}%</p>
        </div>
      </div>

      <!-- Strategic Insights -->
      <div style="background:var(--color-info-bg);border:1px solid var(--color-info-border);border-radius:8px;padding:16px;margin-bottom:32px">
        <h3 style="margin:0 0 12px;color:var(--color-info);font-size:1rem">💡 Insights Estratégicos</h3>
        <p style="margin:0;color:var(--color-info);line-height:1.6">${data.strategic_insights || 'Nenhum insight disponível'}</p>
      </div>

      <!-- Tasks Overview -->
      <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:32px">
        <h3 style="margin:0 0 16px;color:var(--text-primary);font-size:1.1rem">📋 Visão Geral de Tarefas</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
          <div style="background:var(--color-success-bg);border-radius:6px;padding:12px">
            <p style="margin:0 0 4px;color:var(--color-success);font-size:0.85rem">Completas</p>
            <p style="margin:0;color:var(--color-success);font-weight:800;font-size:1.5rem">${data.total_tasks_completed || 0}</p>
          </div>
          <div style="background:var(--color-warning-bg);border-radius:6px;padding:12px">
            <p style="margin:0 0 4px;color:var(--color-warning);font-size:0.85rem">Pendentes</p>
            <p style="margin:0;color:var(--color-warning);font-weight:800;font-size:1.5rem">${data.total_tasks_pending || 0}</p>
          </div>
          <div style="background:var(--color-danger-bg);border-radius:6px;padding:12px">
            <p style="margin:0 0 4px;color:var(--color-danger);font-size:0.85rem">Falhas</p>
            <p style="margin:0;color:var(--color-danger);font-weight:800;font-size:1.5rem">${data.total_tasks_failed || 0}</p>
          </div>
        </div>
      </div>

      <!-- Top Performers -->
      ${data.top_performing_office_id ? `
        <div style="background:var(--brand-light);border:1px solid var(--brand-border);border-radius:8px;padding:16px;margin-bottom:16px">
          <h3 style="margin:0 0 8px;color:var(--brand);font-size:1rem">🏆 Melhor Desempenho</h3>
          <p style="margin:0;color:var(--brand)">Escritório ID: <strong>${data.top_performing_office_id.substring(0, 8)}...</strong></p>
        </div>
      ` : ''}

      <!-- Alerts -->
      ${data.alerts && data.alerts.length > 0 ? `
        <div style="background:var(--color-danger-bg);border:1px solid var(--color-danger-border);border-radius:8px;padding:16px">
          <h3 style="margin:0 0 12px;color:var(--color-danger);font-size:1rem">⚠️ Alertas</h3>
          ${data.alerts.map(alert => `
            <p style="margin:0 0 8px;color:var(--color-danger);font-size:0.9rem">• ${alert.message || 'Alerta indefinido'}</p>
          `).join('')}
        </div>
      ` : ''}

      <!-- Cache Status -->
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border);font-size:0.8rem;color:var(--text-muted)">
        <p style="margin:0">
          ${result?.cached ? '💾 Dados em cache' : '🔄 Calculado em tempo real'} •
          Atualizado em ${new Date().toLocaleTimeString('pt-BR')}
        </p>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// ─── Change Period ───
async function voChangePeriod(period) {
  voSelectedPeriod = period;

  // Recarregar dados
  if (voDashboardData) {
    // Aqui iria chamar voLoadDashboard com o novo período
    console.log('[VO Dashboard] Changing period to:', period);
  }

  // Re-renderizar
  await voRenderCeoDashboard();
}

// ─── Load Reports ───
async function voLoadReports(officeId = null) {
  try {
    const params = {};
    if (officeId) {
      params.office_id = officeId;
    }

    const result = await VO.apiCall('vo_get_reports', params);
    return result.reports || [];
  } catch (err) {
    console.error('[VO Dashboard] Failed to load reports:', err);
    return [];
  }
}

// ─── Render Reports ───
async function voRenderReports() {
  const container = document.getElementById('vo-reports-container');
  if (!container) return;

  try {
    const reports = await voLoadReports();

    if (reports.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:40px">Nenhum relatório disponível</p>';
      return;
    }

    let html = '<div style="display:flex;flex-direction:column;gap:12px">';

    for (const report of reports) {
      html += `
        <div style="padding:16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
            <div>
              <h4 style="margin:0;color:var(--text-primary);font-size:0.95rem">Líder: ${report.leader_name}</h4>
              <p style="margin:4px 0 0;color:var(--text-secondary);font-size:0.85rem">${new Date(report.report_date).toLocaleDateString('pt-BR')}</p>
            </div>
            <span style="display:inline-block;padding:4px 8px;background:${report.performance_score >= 80 ? 'var(--color-success-bg)' : report.performance_score >= 60 ? 'var(--color-warning-bg)' : 'var(--color-danger-bg)'};color:${report.performance_score >= 80 ? 'var(--color-success)' : report.performance_score >= 60 ? 'var(--color-warning)' : 'var(--color-danger)'};border-radius:4px;font-size:0.8rem;font-weight:600">
              ${report.performance_score || 0}%
            </span>
          </div>

          <div style="background:#f9fafb;padding:12px;border-radius:4px;font-size:0.85rem;margin-bottom:8px;color:var(--text-secondary)">
            <p style="margin:0;white-space:pre-wrap">${report.highlights || 'Sem destaques'}</p>
          </div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    console.error('[VO Dashboard] Failed to render reports:', err);
  }
}

// ─── Refresh Dashboard ───
async function voRefreshDashboard(npcCentralId) {
  const dashboard = await voLoadDashboard(npcCentralId);
  if (dashboard) {
    voDashboardData = dashboard;
    await voRenderCeoDashboard();
  }
}

// ─── Export para uso global ───
window.VO_Dashboard = {
  load: voLoadDashboard,
  render: voRenderCeoDashboard,
  changePeriod: voChangePeriod,
  loadReports: voLoadReports,
  renderReports: voRenderReports,
  refresh: voRefreshDashboard,
};
