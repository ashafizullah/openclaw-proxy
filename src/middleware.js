const API_KEY = process.env.API_KEY || ''

function auth(req, res, next) {
  if (!API_KEY) return next()
  const key = req.headers['x-api-key'] || req.query.apiKey
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

module.exports = { auth }
