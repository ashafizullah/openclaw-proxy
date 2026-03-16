const { Router } = require('express')
const { getConfig } = require('../helpers')

const router = Router()

/**
 * @swagger
 * /api/channels:
 *   get:
 *     summary: List channels
 *     tags: [Channels]
 *     responses:
 *       200:
 *         description: List of configured channels
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 channels:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       enabled:
 *                         type: boolean
 */
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
