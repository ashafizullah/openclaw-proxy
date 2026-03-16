require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { auth } = require('./src/middleware')

const app = express()
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/health', auth, require('./src/routes/health'))
app.use('/api/agents', auth, require('./src/routes/agents'))
app.use('/api/gateway', auth, require('./src/routes/gateway'))
app.use('/api/channels', auth, require('./src/routes/channels'))
app.use('/api/chat', auth, require('./src/routes/chat'))
app.use('/api/logs', auth, require('./src/routes/logs'))

const PORT = process.env.PORT || 3100
app.listen(PORT, '0.0.0.0', () => {
  console.log(`OpenClaw Proxy running at http://0.0.0.0:${PORT}`)
  console.log(`Auth: ${process.env.API_KEY ? 'enabled' : 'disabled (set API_KEY in .env)'}`)
})
