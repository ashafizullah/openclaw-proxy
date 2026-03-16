const { Router } = require('express')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const router = Router()

const DATA_DIR = path.join(process.env.HOME || '', '.openclaw-proxy')
const PAGE_SIZE = 20

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

function getHistoryFile(agent) {
  return path.join(DATA_DIR, `chat-history-${agent || 'main'}.json`)
}

function readHistory(agent) {
  try {
    return JSON.parse(fs.readFileSync(getHistoryFile(agent), 'utf-8'))
  } catch {
    return []
  }
}

function saveHistory(agent, messages) {
  fs.writeFileSync(getHistoryFile(agent), JSON.stringify(messages, null, 2))
}

function addMessage(agent, role, content, meta = {}) {
  const messages = readHistory(agent)
  messages.push({
    id: messages.length + 1,
    role,
    content,
    time: new Date().toISOString(),
    agent,
    ...meta,
  })
  saveHistory(agent, messages)
  return messages
}

/**
 * @swagger
 * /api/chat/history:
 *   get:
 *     summary: Get chat history (paginated, per agent)
 *     tags: [Chat]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1 = newest)
 *       - in: query
 *         name: agent
 *         schema:
 *           type: string
 *           default: main
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Paginated chat messages
 */
router.get('/history', (req, res) => {
  const page = parseInt(req.query.page) || 1
  const agent = req.query.agent || 'main'
  const messages = readHistory(agent)
  const total = messages.length
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const end = total - (page - 1) * PAGE_SIZE
  const start = Math.max(0, end - PAGE_SIZE)
  const items = messages.slice(start, end)

  res.json({
    messages: items,
    page,
    totalPages,
    total,
    hasMore: start > 0,
  })
})

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Send message to agent
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               agent:
 *                 type: string
 *                 default: main
 *     responses:
 *       200:
 *         description: Agent response
 */
router.post('/', (req, res) => {
  const { message, agent = 'main' } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })

  addMessage(agent, 'user', message)

  const escaped = message.replace(/'/g, "'\\''")
  exec(
    `openclaw agent --agent ${agent} --message '${escaped}' --json 2>&1`,
    { timeout: 120000, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } },
    (err, stdout, stderr) => {
      if (err) {
        const errMsg = `Error: ${err.message}`
        addMessage(agent, 'assistant', errMsg, { error: true })
        return res.status(500).json({ error: err.message, stderr })
      }
      try {
        const json = JSON.parse(stdout.trim())
        const text = json.result?.payloads?.[0]?.text || json.reply || json.message || stdout.trim()
        const cleaned = text.replace(/\n---\n\*Token:.*\*$/s, '').trim()

        addMessage(agent, 'assistant', cleaned, {
          model: json.result?.meta?.agentMeta?.model,
          durationMs: json.result?.meta?.durationMs,
          sessionId: json.result?.meta?.agentMeta?.sessionId,
        })

        res.json({
          response: cleaned,
          model: json.result?.meta?.agentMeta?.model,
          durationMs: json.result?.meta?.durationMs,
          sessionId: json.result?.meta?.agentMeta?.sessionId,
        })
      } catch {
        addMessage(agent, 'assistant', stdout.trim())
        res.json({ response: stdout.trim() })
      }
    }
  )
})

/**
 * @swagger
 * /api/chat/history:
 *   delete:
 *     summary: Clear chat history for an agent
 *     tags: [Chat]
 *     parameters:
 *       - in: query
 *         name: agent
 *         schema:
 *           type: string
 *           default: main
 *     responses:
 *       200:
 *         description: History cleared
 */
router.delete('/history', (req, res) => {
  const agent = req.query.agent || 'main'
  saveHistory(agent, [])
  res.json({ ok: true })
})

module.exports = router
