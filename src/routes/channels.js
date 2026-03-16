const { Router } = require('express')
const { getConfig } = require('../helpers')

const router = Router()

router.get('/', (req, res) => {
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

module.exports = router
