/**
 * GET /api/trello/export
 * Lista boards do usuário ou exporta dados de um board específico.
 * 
 * Query:
 *   boardId (optional) — Se omitido, lista todos os boards abertos.
 *                      — Se presente, exporta [lists, cards, checklists, members].
 */

const TRELLO_BASE = 'https://api.trello.com/1';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;

  if (!key || !token) {
    return res.status(500).json({ error: 'TRELLO_KEY or TRELLO_TOKEN not configured on Vercel' });
  }

  const auth = `key=${key}&token=${token}`;
  const boardId = req.query.boardId;

  try {
    // ─── LISTAR BOARDS ─────────────────────────────────────────
    if (!boardId) {
      const response = await fetch(`${TRELLO_BASE}/members/me/boards?filter=open&fields=name,desc,url&${auth}`);
      if (!response.ok) throw new Error('Trello API Error listing boards');
      const boards = await response.json();
      return res.status(200).json(boards);
    }

    // ─── EXPORTAR BOARD ESPECÍFICO ─────────────────────────────
    // Buscamos board, listas e cards (com checklists e attachments) em paralelo
    const [boardRes, listsRes, cardsRes] = await Promise.all([
      fetch(`${TRELLO_BASE}/boards/${boardId}?fields=name,desc&${auth}`),
      fetch(`${TRELLO_BASE}/boards/${boardId}/lists?filter=open&fields=name&${auth}`),
      fetch(`${TRELLO_BASE}/boards/${boardId}/cards?filter=open&checklists=all&attachments=true&fields=name,desc,due,idList,labels,idMembers&${auth}`)
    ]);

    if (!boardRes.ok || !listsRes.ok || !cardsRes.ok) {
      return res.status(502).json({ error: 'Trello API Error fetching detailed board info' });
    }

    const board = await boardRes.json();
    const lists = await listsRes.json();
    const cards = await cardsRes.json();

    return res.status(200).json({
      board,
      lists,
      cards: cards.map(c => ({
        id: c.id,
        name: c.name,
        desc: c.desc,
        due: c.due,
        idList: c.idList,
        labels: c.labels,
        attachments: c.attachments,
        checklists: c.checklists
      }))
    });

  } catch (e) {
    return res.status(500).json({ error: 'Internal server error', message: e.message });
  }
};
