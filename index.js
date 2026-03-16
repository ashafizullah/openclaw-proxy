require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { execSync, exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3100
const API_KEY = process.env.API_KEY || ''

// Simple API key auth middleware
function auth(req, res, next) {
  if (!API_KEY) return next()
  const key = req.headers['x-api-key'] || req.query.apiKey
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

// Helper: run openclaw CLI command
function runCLI(command, timeout = 10000) {
  try {
    const output = execSync(`openclaw ${command}`, {
      timeout,
      encoding: 'utf-8',
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    })
    return output
  } catch (err) {
    throw new Error(err.stderr || err.message)
  }
}

// Helper: parse openclaw config
function getConfig() {
  const configPath = path.join(
    process.env.HOME || process.env.USERPROFILE,
    '.openclaw',
    'openclaw.json'
  )
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
}

// GET /api/health
app.get('/api/health', auth, (req, res) => {
  try {
    const output = runCLI('gateway status')
    const running = output.includes('running')
    res.json({ status: running ? 'ok' : 'down', raw: output })
  } catch (err) {
    res.json({ status: 'down', error: err.message })
  }
})

// GET /api/agents - list all agents with config details
app.get('/api/agents', auth, (req, res) => {
  try {
    const config = getConfig()
    const agents = (config.agents?.list || []).map((agent) => {
      // Read identity file if exists
      let identity = {}
      const workspacePath =
        agent.workspace || config.agents?.defaults?.workspace || '~/.openclaw/workspace'
      const expandedPath = workspacePath.replace('~', process.env.HOME || '')
      const identityPath = path.join(expandedPath, 'IDENTITY.md')
      try {
        identity.raw = fs.readFileSync(identityPath, 'utf-8')
        // Extract name from identity
        const nameMatch = identity.raw.match(/^#\s+(.+)/m)
        if (nameMatch) identity.name = nameMatch[1]
      } catch {
        // no identity file
      }

      return {
        id: agent.id,
        model: agent.model || config.agents?.defaults?.model?.primary || 'unknown',
        workspace: agent.workspace || config.agents?.defaults?.workspace,
        identity,
        isDefault: config.agents?.list?.indexOf(agent) === 0,
      }
    })

    res.json({ agents })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/agents/:id - single agent detail
app.get('/api/agents/:id', auth, (req, res) => {
  try {
    const config = getConfig()
    const agent = config.agents?.list?.find((a) => a.id === req.params.id)
    if (!agent) return res.status(404).json({ error: 'Agent not found' })

    const workspacePath = (
      agent.workspace ||
      config.agents?.defaults?.workspace ||
      '~/.openclaw/workspace'
    ).replace('~', process.env.HOME || '')

    let identity = {}
    try {
      const raw = fs.readFileSync(path.join(workspacePath, 'IDENTITY.md'), 'utf-8')
      identity.raw = raw
      const nameMatch = raw.match(/^#\s+(.+)/m)
      if (nameMatch) identity.name = nameMatch[1]
    } catch {}

    let sessions = []
    const agentDir = path.join(
      process.env.HOME || '',
      '.openclaw',
      'agents',
      agent.id
    )
    try {
      const sessionDirs = fs
        .readdirSync(path.join(agentDir, 'sessions'))
        .filter((f) => !f.startsWith('.'))
      sessions = sessionDirs.map((dir) => {
        const sessionPath = path.join(agentDir, 'sessions', dir)
        const stat = fs.statSync(sessionPath)
        return { id: dir, lastModified: stat.mtime }
      })
      sessions.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
    } catch {}

    res.json({
      id: agent.id,
      model: agent.model || config.agents?.defaults?.model?.primary,
      workspace: agent.workspace || config.agents?.defaults?.workspace,
      identity,
      sessions: sessions.slice(0, 10),
      isDefault: config.agents?.list?.indexOf(agent) === 0,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/gateway/status
app.get('/api/gateway/status', auth, (req, res) => {
  try {
    const config = getConfig()
    const gateway = config.gateway || {}
    let cliStatus = 'unknown'
    try {
      const output = runCLI('gateway status')
      if (output.includes('running')) cliStatus = 'running'
      else if (output.includes('stopped')) cliStatus = 'stopped'
    } catch {
      cliStatus = 'error'
    }

    res.json({
      status: cliStatus,
      port: gateway.port || 18789,
      bind: gateway.bind || 'loopback',
      channels: Object.keys(config.channels || {}).filter(
        (ch) => config.channels[ch]?.enabled
      ),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/channels - list enabled channels
app.get('/api/channels', auth, (req, res) => {
  try {
    const config = getConfig()
    const channels = Object.entries(config.channels || {}).map(([name, cfg]) => ({
      name,
      enabled: cfg.enabled || false,
    }))
    res.json({ channels })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/chat - send message to agent (via CLI)
app.post('/api/chat', auth, (req, res) => {
  const { message, agent = 'main' } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })

  // Run async to avoid blocking
  const escaped = message.replace(/'/g, "'\\''")
  exec(
    `openclaw run --agent ${agent} --text '${escaped}' --no-stream 2>&1`,
    { timeout: 120000, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } },
    (err, stdout, stderr) => {
      if (err) {
        return res.status(500).json({ error: err.message, stderr })
      }
      res.json({ response: stdout.trim() })
    }
  )
})

// GET /api/logs - recent logs
app.get('/api/logs', auth, (req, res) => {
  const lines = parseInt(req.query.lines) || 50
  try {
    const today = new Date().toISOString().split('T')[0]
    const logFile = `/tmp/openclaw/openclaw-${today}.log`
    const output = execSync(`tail -n ${lines} "${logFile}"`, { encoding: 'utf-8' })
    res.json({ logs: output.split('\n').filter(Boolean) })
  } catch (err) {
    res.json({ logs: [], error: err.message })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OpenClaw Proxy running at http://0.0.0.0:${PORT}`)
  console.log(`Auth: ${API_KEY ? 'enabled' : 'disabled (set API_KEY in .env)'}`)
})
