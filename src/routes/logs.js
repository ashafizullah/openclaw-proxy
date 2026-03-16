const { Router } = require('express')
const { execSync } = require('child_process')

const router = Router()

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: Get recent gateway logs
 *     tags: [Logs]
 *     parameters:
 *       - in: query
 *         name: lines
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of log lines to return
 *     responses:
 *       200:
 *         description: Recent log lines
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: string
 *                 error:
 *                   type: string
 */
router.get('/', (req, res) => {
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

module.exports = router
