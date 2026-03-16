const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function runCLI(command, timeout = 10000) {
  try {
    const output = execSync(`openclaw ${command}`, {
      timeout,
      encoding: 'utf-8',
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    })
    return output
  } catch (err) {
    throw new Error(err.stderr || err.message)
  }
}

function getConfig() {
  const configPath = path.join(
    process.env.HOME || process.env.USERPROFILE,
    '.openclaw',
    'openclaw.json'
  )
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
}

function getWorkspacePath(agent, config) {
  return (
    agent.workspace ||
    config.agents?.defaults?.workspace ||
    '~/.openclaw/workspace'
  ).replace('~', process.env.HOME || '')
}

function readIdentity(workspacePath) {
  const identity = {}
  try {
    const identityPath = path.join(workspacePath, 'IDENTITY.md')
    identity.raw = fs.readFileSync(identityPath, 'utf-8')
    const nameMatch = identity.raw.match(/^#\s+(.+)/m)
    if (nameMatch) identity.name = nameMatch[1]
  } catch {
    // no identity file
  }
  return identity
}

module.exports = { runCLI, getConfig, getWorkspacePath, readIdentity }
