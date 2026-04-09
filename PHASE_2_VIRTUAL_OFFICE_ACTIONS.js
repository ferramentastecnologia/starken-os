// =============================================================================
// VIRTUAL OFFICE ACTIONS (Inserir antes do objeto ACTIONS final)
// =============================================================================

// ─── VO: List Offices ───
async function voListOffices(params) {
  try {
    const { building_id } = params;
    let query = '';
    if (building_id) {
      query = `building_id=eq.${building_id}`;
    }
    const offices = await supaSelect('virtual_offices', query);
    return ok({ offices, total: offices.length });
  } catch (err) {
    return fail(err.message, 500);
  }
}

// ─── VO: List NPCs ───
async function voListNpcs(params) {
  try {
    const { office_id, room_id, status } = params;
    let query = '';
    if (office_id) {
      query += `office_id=eq.${office_id}`;
    }
    if (room_id) {
      query += (query ? '&' : '') + `room_id=eq.${room_id}`;
    }
    if (status) {
      query += (query ? '&' : '') + `status=eq.${status}`;
    }
    const npcs = await supaSelect('virtual_npcs', query);
    return ok({ npcs, total: npcs.length });
  } catch (err) {
    return fail(err.message, 500);
  }
}

// ─── VO: Create Task ───
async function voCreateTask(params) {
  try {
    const {
      office_id,
      room_id,
      npc_id,
      task_type,
      task_name,
      task_description,
      task_content,
      priority = 'normal',
      created_by,
    } = params;

    if (!office_id || !room_id || !task_type || !task_name) {
      return fail('office_id, room_id, task_type, task_name são obrigatórios', 400);
    }

    const task = await supaInsert('virtual_npc_tasks', {
      office_id,
      room_id,
      npc_id: npc_id || null,
      task_type,
      task_name,
      task_description: task_description || null,
      task_content: task_content ? JSON.stringify(task_content) : null,
      priority,
      status: 'pending',
      created_by: created_by || 'system',
      assigned_at: new Date().toISOString(),
    });

    // Log activity
    await supaInsert('virtual_activity_log', {
      office_id,
      room_id,
      npc_id: npc_id || null,
      action: 'task_created',
      action_type: 'task_management',
      entity_id: task[0]?.id,
      details: JSON.stringify({ task_type, task_name }),
      severity: 'info',
      created_at: new Date().toISOString(),
    });

    return ok({ task: task[0], message: 'Tarefa criada com sucesso' });
  } catch (err) {
    return fail(err.message, 500);
  }
}

// ─── VO: Get Reports ───
async function voGetReports(params) {
  try {
    const { office_id, leader_name, report_date, period_type = 'daily' } = params;
    let query = '';

    if (office_id) {
      query += `office_id=eq.${office_id}`;
    }
    if (leader_name) {
      query += (query ? '&' : '') + `leader_name=eq.${leader_name}`;
    }
    if (report_date) {
      query += (query ? '&' : '') + `report_date=eq.${report_date}`;
    }

    // Ordenar por data decrescente
    query += (query ? '&' : '') + 'order=report_date.desc';

    const reports = await supaSelect('virtual_squad_reports', query);

    return ok({
      reports,
      total: reports.length,
      period_type,
    });
  } catch (err) {
    return fail(err.message, 500);
  }
}

// ─── VO: CEO Dashboard ───
async function voCeoDashboard(params) {
  try {
    const { npc_central_id, report_period, period_type = 'daily' } = params;

    if (!npc_central_id) {
      return fail('npc_central_id é obrigatório', 400);
    }

    // Buscar dashboard consolidado
    let query = `npc_central_id=eq.${npc_central_id}`;
    if (report_period) {
      query += `&report_period=eq.${report_period}`;
    }
    query += '&order=report_period.desc&limit=1';

    const dashboard = await supaSelect('virtual_ceo_dashboard', query);

    if (!dashboard.length) {
      // Se não existir, calcular
      const offices = await supaSelect('virtual_offices', 'is_active=eq.true');
      const npcs = await supaSelect('virtual_npcs', 'status=neq.offline');
      const tasks = await supaSelect(
        'virtual_npc_tasks',
        'status=in.(pending,in_progress)'
      );
      const reports = await supaSelect('virtual_squad_reports', `report_date=eq.${report_period}`);

      const aggregated = {
        npc_central_id,
        report_period: report_period || new Date().toISOString().split('T')[0],
        period_type,
        total_clients: offices.length,
        total_offices: offices.length,
        total_rooms: 0, // Seria buscado separadamente se necessário
        total_npcs_active: npcs.length,
        total_tasks_completed: 0, // Seria consultado com status=completed
        total_tasks_pending: tasks.length,
        total_tasks_failed: 0, // Seria consultado com status=failed
        avg_performance_score: Math.round(
          reports.reduce((sum, r) => sum + (r.performance_score || 0), 0) /
            (reports.length || 1)
        ),
        strategic_insights: `Período: ${period_type}. Clientes ativos: ${offices.length}. NPCs online: ${npcs.length}.`,
        alerts: [],
      };

      return ok({
        dashboard: aggregated,
        cached: false,
        message: 'Dashboard calculado em tempo real',
      });
    }

    return ok({
      dashboard: dashboard[0],
      cached: true,
      message: 'Dashboard carregado do cache',
    });
  } catch (err) {
    return fail(err.message, 500);
  }
}

// =============================================================================
// Adicionar ao objeto ACTIONS:
// =============================================================================
// Copiar e colar o seguinte para dentro do objeto ACTIONS (antes do último }):

/*
  // Virtual Office
  vo_list_offices: voListOffices,
  vo_list_npcs: voListNpcs,
  vo_create_task: voCreateTask,
  vo_get_reports: voGetReports,
  vo_ceo_dashboard: voCeoDashboard,
*/
