const { Router } = require('express')
const { execSync } = require('child_process')

const router = Router()

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
