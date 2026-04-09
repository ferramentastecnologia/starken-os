/**
 * DeskRPG Webhook Handler - Phase 5B
 *
 * Receives callbacks from DeskRPG when tasks complete and syncs results back to Starken OS.
 *
 * Flow:
 * 1. DeskRPG completes a task
 * 2. DeskRPG POSTs to /api/deskrpg-webhook with task result
 * 3. This handler updates:
 *    - virtual_npc_tasks.status = 'completed'
 *    - virtual_npc_tasks.result_data = result from DeskRPG
 *    - virtual_npcs.last_task_completed_at
 *    - virtual_activity_log (audit trail)
 *    - Triggers real-time UI update
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * POST /api/deskrpg-webhook
 *
 * Expected body:
 * {
 *   taskId: "deskrpg-task-uuid",
 *   npcId: "deskrpg-npc-uuid",
 *   channelId: "deskrpg-channel-uuid",
 *   status: "completed" | "failed" | "cancelled",
 *   result: { ... execution result ... },
 *   resultSummary: "Brief summary of result",
 *   timestamp: "2026-04-09T12:34:56Z"
 * }
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId, npcId, channelId, status, result, resultSummary, timestamp } = req.body;

    // Validate required fields
    if (!taskId || !npcId || !status) {
      return res.status(400).json({
        error: 'Missing required fields: taskId, npcId, status',
      });
    }

    if (!['completed', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be: completed, failed, cancelled',
      });
    }

    console.log(`[DeskRPG Webhook] Received callback: task=${taskId}, status=${status}`);

    // Step 1: Find the Starken OS task that corresponds to this DeskRPG task
    // (assumes we stored deskrpgTaskId in virtual_npc_tasks when we created the task)
    const { data: starkenTask, error: taskError } = await supabase
      .from('virtual_npc_tasks')
      .select('id, npc_id, status')
      .eq('deskrpg_task_id', taskId)
      .single();

    if (taskError || !starkenTask) {
      console.error(
        `[DeskRPG Webhook] Could not find Starken task for deskrpgTaskId=${taskId}`,
        taskError
      );
      // Log webhook event anyway for debugging
      await logWebhookEvent({
        deskrpgTaskId: taskId,
        deskrpgNpcId: npcId,
        status,
        errorReason: 'Task not found in Starken OS',
      });
      return res.status(404).json({ error: 'Task not found in Starken OS' });
    }

    // Step 2: Update virtual_npc_tasks with result
    const updatePayload = {
      status: status === 'completed' ? 'completed' : 'failed',
      result_data: result || null,
      result_summary: resultSummary || null,
      completed_at: new Date().toISOString(),
      deskrpg_status: status, // Store DeskRPG status separately
    };

    const { error: updateError } = await supabase
      .from('virtual_npc_tasks')
      .update(updatePayload)
      .eq('id', starkenTask.id);

    if (updateError) {
      console.error(`[DeskRPG Webhook] Failed to update task ${starkenTask.id}:`, updateError);
      return res.status(500).json({ error: 'Failed to update task', details: updateError });
    }

    // Step 3: Update NPC's last_task_completed_at timestamp
    if (starkenTask.npc_id) {
      await supabase
        .from('virtual_npcs')
        .update({ last_task_completed_at: new Date().toISOString() })
        .eq('id', starkenTask.npc_id)
        .catch((err) => console.error('[DeskRPG Webhook] Failed to update NPC timestamp:', err));
    }

    // Step 4: Create activity log entry
    await logActivityEvent({
      event_type: 'task_completed_deskrpg',
      object_type: 'virtual_npc_task',
      object_id: starkenTask.id,
      description: `Task completed via DeskRPG: ${resultSummary || ''}`,
      metadata: {
        deskrpgTaskId: taskId,
        deskrpgNpcId: npcId,
        deskrpgStatus: status,
      },
    });

    console.log(`[DeskRPG Webhook] Successfully processed callback for task ${starkenTask.id}`);

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      starkenTaskId: starkenTask.id,
    });
  } catch (err) {
    console.error('[DeskRPG Webhook] Unexpected error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  }
};

/**
 * Helper: Log webhook event for debugging
 */
async function logWebhookEvent(payload) {
  try {
    await supabase
      .from('virtual_activity_log')
      .insert({
        event_type: 'webhook_received_deskrpg',
        object_type: 'webhook',
        object_id: payload.deskrpgTaskId,
        description: `DeskRPG webhook: ${payload.status}`,
        metadata: payload,
        created_at: new Date().toISOString(),
      });
  } catch (err) {
    console.error('[DeskRPG Webhook] Failed to log webhook event:', err);
  }
}

/**
 * Helper: Log activity event
 */
async function logActivityEvent(payload) {
  try {
    await supabase.from('virtual_activity_log').insert({
      created_at: new Date().toISOString(),
      ...payload,
    });
  } catch (err) {
    console.error('[DeskRPG Webhook] Failed to log activity:', err);
  }
}
