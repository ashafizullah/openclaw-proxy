const { Router } = require('express')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const router = Router()

const DATA_DIR = path.join(process.env.HOME || '', '.openclaw-proxy')
const HISTORY_FILE = path.join(DATA_DIR, 'chat-history.json')
const PAGE_SIZE = 20

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

function readHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveHistory(messages) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(messages, null, 2))
}

function addMessage(role, content, meta = {}) {
  const messages = readHistory()
  messages.push({
    id: messages.length + 1,
    role,
    content,
    time: new Date().toISOString(),
    ...meta,
  })
  saveHistory(messages)
  return messages
}

// GET /api/chat/history?page=1&agent=main
router.get('/history', (req, res) => {
  const page = parseInt(req.query.page) || 1
  const messages = readHistory()
  const total = messages.length
  const totalPages = Math.ceil(total / PAGE_SIZE)
  // Page 1 = newest, page N = oldest
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

// POST /api/chat
router.post('/', (req, res) => {
  const { message, agent = 'main' } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })

  // Save user message
  addMessage('user', message, { agent })

  const escaped = message.replace(/'/g, "'\\''")
  exec(
    `openclaw agent --agent ${agent} --message '${escaped}' --json 2>&1`,
    { timeout: 120000, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } },
    (err, stdout, stderr) => {
      if (err) {
        const errMsg = `Error: ${err.message}`
        addMessage('assistant', errMsg, { agent, error: true })
        return res.status(500).json({ error: err.message, stderr })
      }
      try {
        const json = JSON.parse(stdout.trim())
        const text = json.result?.payloads?.[0]?.text || json.reply || json.message || stdout.trim()
        const cleaned = text.replace(/\n---\n\*Token:.*\*$/s, '').trim()

        addMessage('assistant', cleaned, {
          agent,
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
        addMessage('assistant', stdout.trim(), { agent })
        res.json({ response: stdout.trim() })
      }
    }
  )
})

// DELETE /api/chat/history - clear history
router.delete('/history', (req, res) => {
  saveHistory([])
  res.json({ ok: true })
})

module.exports = router
