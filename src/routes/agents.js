const { Router } = require('express')
const fs = require('fs')
const path = require('path')
const { getConfig, getWorkspacePath, readIdentity } = require('../helpers')

const router = Router()

/**
 * @swagger
 * /api/agents:
 *   get:
 *     summary: List all agents
 *     tags: [Agents]
 *     responses:
 *       200:
 *         description: List of agents with identity and config
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       model:
 *                         type: string
 *                       workspace:
 *                         type: string
 *                       identity:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           raw:
 *                             type: string
 *                       isDefault:
 *                         type: boolean
 */
router.get('/', (req, res) => {
  try {
    const config = getConfig()
    const agents = (config.agents?.list || []).map((agent) => {
      const workspacePath = getWorkspacePath(agent, config)
      const identity = readIdentity(workspacePath)

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

/**
 * @swagger
 * /api/agents/{id}:
 *   get:
 *     summary: Get agent detail
 *     tags: [Agents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Agent detail with sessions
 *       404:
 *         description: Agent not found
 */
router.get('/:id', (req, res) => {
  try {
    const config = getConfig()
    const agent = config.agents?.list?.find((a) => a.id === req.params.id)
    if (!agent) return res.status(404).json({ error: 'Agent not found' })

    const workspacePath = getWorkspacePath(agent, config)
    const identity = readIdentity(workspacePath)

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

module.exports = router
