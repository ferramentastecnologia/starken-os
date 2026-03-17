/**
 * POST /api/trello/migrate
 * Executa a migração de um board do Trello para um projeto do Asana.
 * 
 * Body:
 *   { asanaProjectGid, cards, listMapping }
 *   - cards: array de cards do Trello vindos do /export
 *   - listMapping: objeto { trelloListId: asanaSectionGid }
 */

const ASANA_BASE = 'https://app.asana.com/api/1.0';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).end();

  const asanaToken = process.env.ASANA_PAT;
  const { asanaProjectGid, cards, listMapping } = req.body || {};

  if (!asanaToken || !asanaProjectGid || !cards) {
    return res.status(400).json({ error: 'Missing parameters for migration' });
  }

  const results = {
    total: cards.length,
    success: 0,
    failed: 0,
    errors: []
  };

  // Funçao auxiliar para criar uma task no Asana
  const createAsanaTask = async (card) => {
    const sectionGid = listMapping[card.idList];
    const payload = {
      data: {
        name: card.name,
        notes: card.desc + (card.due ? `\n\nPrazo original (Trello): ${card.due}` : ''),
        projects: [asanaProjectGid],
        due_on: card.due ? card.due.split('T')[0] : null
      }
    };

    if (sectionGid) {
      payload.data.memberships = [{ project: asanaProjectGid, section: sectionGid }];
    }

    const res = await fetch(`${ASANA_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${asanaToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.errors ? err.errors[0].message : 'Asana error');
    }
    return res.json();
  };

  // Processamos sequencialmente para não estourar rate limit do Asana
  for (const card of cards) {
    try {
      await createAsanaTask(card);
      results.success++;
    } catch (e) {
      results.failed++;
      results.errors.push({ card: card.name, error: e.message });
    }
  }

  return res.status(200).json(results);
};
