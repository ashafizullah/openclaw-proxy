const { Router } = require('express')
const { runCLI } = require('../helpers')

const router = Router()

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Gateway health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Gateway health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, down]
 *                 raw:
 *                   type: string
 *                 error:
 *                   type: string
 */
router.get('/', (req, res) => {
  try {
    const output = runCLI('gateway status')
    const running = output.includes('running')
    res.json({ status: running ? 'ok' : 'down', raw: output })
  } catch (err) {
    res.json({ status: 'down', error: err.message })
  }
})

module.exports = router
