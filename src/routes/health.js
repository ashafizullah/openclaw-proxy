const { Router } = require('express')
const { runCLI } = require('../helpers')

const router = Router()

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
