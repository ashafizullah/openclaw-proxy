const swaggerJsdoc = require('swagger-jsdoc')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OpenClaw Proxy API',
      version: '1.0.0',
      description: 'REST API proxy for OpenClaw CLI. Exposes OpenClaw agent data via simple HTTP endpoints.',
    },
    servers: [
      { url: '/', description: 'Current server' },
    ],
    components: {
      securitySchemes: {
        ApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
    },
    security: [{ ApiKey: [] }],
  },
  apis: ['./src/routes/*.js'],
}

module.exports = swaggerJsdoc(options)
