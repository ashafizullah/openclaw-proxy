const { Router } = require('express')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const router = Router()

const AGENTS_DIR = path.join(process.env.HOME || '', '.openclaw', 'agents')

/**
 * @swagger
 * /api/activity/{agentId}:
 *   get:
 *     summary: Get agent activity log from session JSONL
 *     tags: [Activity]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Parsed activity entries
 */
router.get('/:agentId', async (req, res) => {
  const { agentId } = req.params
  const limit = parseInt(req.query.limit) || 30

  try {
    const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions')
    if (!fs.existsSync(sessionsDir)) {
      return res.json({ activities: [], agent: agentId })
    }

    // Find latest session JSONL
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith('.jsonl') && !f.endsWith('.lock'))
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(sessionsDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime)

    if (!files.length) {
      return res.json({ activities: [], agent: agentId })
    }

    const filePath = path.join(sessionsDir, files[0].name)
    const activities = []

    // Read and parse JSONL
    const fileStream = fs.createReadStream(filePath)
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

    for await (const line of rl) {
      try {
        const entry = JSON.parse(line)
        const parsed = parseEntry(entry)
        if (parsed) activities.push(parsed)
      } catch {
        // skip malformed lines
      }
    }

    // Return last N activities
    res.json({
      activities: activities.slice(-limit),
      agent: agentId,
      sessionFile: files[0].name,
      total: activities.length,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * @swagger
 * /api/activity:
 *   get:
 *     summary: Get activity for all agents
 *     tags: [Activity]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Combined activity from all agents
 */
router.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50

  try {
    if (!fs.existsSync(AGENTS_DIR)) {
      return res.json({ activities: [] })
    }

    const agents = fs.readdirSync(AGENTS_DIR)
      .filter(f => fs.statSync(path.join(AGENTS_DIR, f)).isDirectory())

    const allActivities = []

    for (const agentId of agents) {
      const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions')
      if (!fs.existsSync(sessionsDir)) continue

      const files = fs.readdirSync(sessionsDir)
        .filter(f => f.endsWith('.jsonl') && !f.endsWith('.lock'))
        .map(f => ({
          name: f,
          mtime: fs.statSync(path.join(sessionsDir, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime)

      if (!files.length) continue

      const filePath = path.join(sessionsDir, files[0].name)
      const content = fs.readFileSync(filePath, 'utf-8')

      for (const line of content.split('\n')) {
        if (!line.trim()) continue
        try {
          const entry = JSON.parse(line)
          const parsed = parseEntry(entry, agentId)
          if (parsed) allActivities.push(parsed)
        } catch {
          // skip
        }
      }
    }

    // Sort by timestamp, return last N
    allActivities.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    res.json({
      activities: allActivities.slice(-limit),
      total: allActivities.length,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function parseEntry(entry, agentId = '') {
  if (entry.type !== 'message') return null

  const msg = entry.message
  if (!msg) return null

  const timestamp = entry.timestamp || msg.timestamp
  const base = { id: entry.id, agent: agentId, timestamp }

  if (msg.role === 'user') {
    const text = typeof msg.content === 'string'
      ? msg.content
      : msg.content?.find(c => c.type === 'text')?.text || ''
    if (!text) return null
    return { ...base, type: 'user_message', content: text.substring(0, 500) }
  }

  if (msg.role === 'assistant') {
    const contents = Array.isArray(msg.content) ? msg.content : []

    // Check for tool calls
    const toolCalls = contents.filter(c => c.type === 'toolCall')
    if (toolCalls.length > 0) {
      return {
        ...base,
        type: 'tool_call',
        tools: toolCalls.map(tc => ({
          name: tc.name,
          id: tc.id,
          args: summarizeArgs(tc.name, tc.arguments),
        })),
        model: msg.model,
      }
    }

    // Text response
    const text = contents.find(c => c.type === 'text')?.text || ''
    if (text) {
      return {
        ...base,
        type: 'assistant_message',
        content: text.substring(0, 500),
        model: msg.model,
        cost: msg.usage?.cost?.total,
      }
    }

    // Thinking
    const thinking = contents.find(c => c.type === 'thinking')
    if (thinking) {
      return {
        ...base,
        type: 'thinking',
        content: thinking.thinking?.substring(0, 200),
      }
    }
  }

  if (msg.role === 'toolResult') {
    const text = Array.isArray(msg.content)
      ? msg.content.find(c => c.type === 'text')?.text || ''
      : typeof msg.content === 'string' ? msg.content : ''

    return {
      ...base,
      type: 'tool_result',
      toolName: msg.toolName,
      content: text.substring(0, 300),
      status: msg.details?.status,
      sessionId: msg.details?.sessionId,
    }
  }

  return null
}

function summarizeArgs(toolName, args) {
  if (!args) return ''
  if (toolName === 'exec') return args.command?.substring(0, 150) || ''
  if (toolName === 'read') return args.path || ''
  if (toolName === 'write') return args.path || ''
  if (toolName === 'process') return `${args.action} ${args.sessionId || ''}`
  if (toolName === 'sessions_spawn') return `agent:${args.agentId}`
  return JSON.stringify(args).substring(0, 100)
}

module.exports = router
