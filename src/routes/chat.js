const { Router } = require('express')
const { exec } = require('child_process')

const router = Router()

router.post('/', (req, res) => {
  const { message, agent = 'main' } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })

  const escaped = message.replace(/'/g, "'\\''")
  exec(
    `openclaw agent --agent ${agent} --message '${escaped}' --json 2>&1`,
    { timeout: 120000, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } },
    (err, stdout, stderr) => {
      if (err) {
        return res.status(500).json({ error: err.message, stderr })
      }
      try {
        const json = JSON.parse(stdout.trim())
        const text = json.result?.payloads?.[0]?.text || json.reply || json.message || stdout.trim()
        const cleaned = text.replace(/\n---\n\*Token:.*\*$/s, '').trim()
        res.json({
          response: cleaned,
          model: json.result?.meta?.agentMeta?.model,
          durationMs: json.result?.meta?.durationMs,
          sessionId: json.result?.meta?.agentMeta?.sessionId,
        })
      } catch {
        res.json({ response: stdout.trim() })
      }
    }
  )
})

module.exports = router
