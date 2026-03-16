const { Router } = require('express')
const { runCLI, getConfig } = require('../helpers')

const router = Router()

/**
 * @swagger
 * /api/gateway/status:
 *   get:
 *     summary: Gateway status
 *     tags: [Gateway]
 *     responses:
 *       200:
 *         description: Gateway runtime status and config
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [running, stopped, error, unknown]
 *                 port:
 *                   type: integer
 *                 bind:
 *                   type: string
 *                 channels:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/status', (req, res) => {
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

module.exports = router
