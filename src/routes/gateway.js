const { Router } = require('express')
const { runCLI, getConfig } = require('../helpers')

const router = Router()

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
