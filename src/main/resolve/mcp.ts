import { createHash, timingSafeEqual } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import path from 'node:path'
import { app, clipboard } from 'electron'
import express from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { getAppConfig } from '../config'
import { changeCurrentProfile, getCurrentProfileItem, getProfileConfig } from '../config/profile'
import {
  mihomoChangeProxy,
  mihomoConfig,
  mihomoGetConnections,
  mihomoGroups,
  mihomoProxyDelay,
  mihomoProxyProviders,
  mihomoRuleProviders,
  mihomoUnfixedProxy,
  mihomoVersion
} from '../core/mihomoApi'
import { dataDir } from '../utils/dirs'
import { decryptStringStrict, encryptStringStrict } from '../utils/encrypt'
import { getCachedMihomoLogs } from '../utils/log'
import { getTrafficTrend } from './trafficStats'

const host = '127.0.0.1'
const portSchema = z.number().int().min(1024).max(65535)
const settingsSchema = z.object({
  enabled: z.boolean(),
  port: portSchema,
  allowDelayTest: z.boolean(),
  allowProfileSwitch: z.boolean().default(false),
  keyHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  encryptedKey: z.string().startsWith('enc:').max(4096).optional()
})
const keySchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/)
const updateSchema = settingsSchema
  .omit({ keyHash: true, encryptedKey: true })
  .extend({
    key: keySchema.optional()
  })
  .strict()
type StoredSettings = z.infer<typeof settingsSchema>

let settings: StoredSettings = {
  enabled: false,
  port: 17890,
  allowDelayTest: false,
  allowProfileSwitch: false
}
let listener: Server | undefined
let sessionKey: string | undefined
let settingsWrite = Promise.resolve()
let stopping = false
let requestCount = 0
let switching = false
let testing = false
let lastTestTime = -Infinity

const configFile = (): string => path.join(dataDir(), 'mcp.json')
const digest = (value: string): Buffer => createHash('sha256').update(value).digest()
const name = z.string().min(1).max(512)
const offset = z.number().int().min(0).max(100_000).default(0)

export function getMcpSettings(): McpSettings {
  const { enabled, port, allowDelayTest, allowProfileSwitch, keyHash } = settings
  return {
    enabled,
    port,
    allowDelayTest,
    allowProfileSwitch,
    hasKey: Boolean(keyHash),
    running: Boolean(listener?.listening)
  }
}

function matchesKey(key: string, keyHash: string | undefined): boolean {
  return Boolean(keyHash && timingSafeEqual(digest(key), Buffer.from(keyHash, 'hex')))
}

export function copyMcpConfig(candidate?: unknown): void {
  if (!listener?.listening || stopping) throw new Error('请先开启并保存 MCP 接入设置')
  let key = sessionKey
  if (!key && settings.encryptedKey) {
    try {
      key = decryptStringStrict(settings.encryptedKey)
    } catch {
      // The OS keyring may be locked or unavailable.
    }
  }
  const supplied = keySchema.safeParse(candidate)
  if ((!key || !matchesKey(key, settings.keyHash)) && supplied.success) key = supplied.data
  if (!key || !matchesKey(key, settings.keyHash))
    throw new Error('请输入已保存的接入密钥后再复制配置')

  const config = {
    mcpServers: {
      perzike: {
        type: 'http',
        url: `http://${host}:${settings.port}/mcp`,
        headers: { Authorization: `Bearer ${key}` }
      }
    }
  }
  const tools = [
    'get_status',
    'list_proxy_groups',
    'get_active_profile',
    'get_traffic_summary',
    'select_proxy',
    'diagnose_proxy',
    'restore_auto_proxy',
    'list_providers',
    'get_traffic_trend',
    'list_profiles'
  ]
  if (settings.allowDelayTest) tools.push('test_proxy_delay', 'test_group_delay')
  if (settings.allowProfileSwitch) tools.push('switch_profile')
  clipboard.writeText(
    [
      '请将以下 Perzike MCP 服务添加到本机 Agent，使用 Streamable HTTP。按你的客户端配置格式映射 URL 和 Authorization 请求头。',
      '',
      '```json',
      JSON.stringify(config, null, 2),
      '```',
      '',
      `可用工具：${tools.join('、')}。select_proxy 会直接切换代理节点。`,
      '接入密钥仅供信任的本机客户端使用，请勿公开。'
    ].join('\n')
  )
}

export async function initMcp(): Promise<void> {
  try {
    settings = settingsSchema.parse(JSON.parse(await readFile(configFile(), 'utf8')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  if (settings.enabled) {
    if (!settings.keyHash) throw new Error('MCP 接入密钥缺失')
    listener = await startListener(settings.port)
  }
}

export function saveMcpSettings(input: unknown): Promise<McpSettings> {
  const update = updateSchema.safeParse(input)
  if (!update.success) {
    return Promise.reject(
      new Error('MCP 端口须为 1024–65535，密钥须为 32–128 位字母、数字、短横线或下划线')
    )
  }
  const { key, ...newSettings } = update.data
  const pending = settingsWrite.then(async () => {
    if (stopping) throw new Error('Perzike 正在退出')
    let encryptedKey = settings.encryptedKey
    if (key) {
      try {
        encryptedKey = encryptStringStrict(key)
      } catch {
        encryptedKey = undefined
      }
    }
    const next = {
      ...newSettings,
      keyHash: key ? digest(key).toString('hex') : settings.keyHash,
      encryptedKey
    }
    if (next.enabled && !next.keyHash) throw new Error('请设置 MCP 接入密钥')

    const previous = listener
    const nextListener = next.enabled
      ? previous?.listening && settings.port === next.port
        ? previous
        : await startListener(next.port)
      : undefined
    try {
      const file = configFile()
      await writeFile(file + '.tmp', JSON.stringify(next), { encoding: 'utf8', mode: 0o600 })
      await rename(file + '.tmp', file)
    } catch (error) {
      if (nextListener !== previous) closeListener(nextListener)
      throw error
    }
    settings = next
    if (key && !stopping) sessionKey = key
    listener = nextListener
    if (previous !== nextListener) closeListener(previous)
    if (stopping) {
      closeListener(listener)
      listener = undefined
    }
    return getMcpSettings()
  })
  settingsWrite = pending.then(
    () => {},
    () => {}
  )
  return pending
}

function closeListener(server: Server | undefined): void {
  if (!server) return
  server.close()
  server.closeAllConnections()
}

export function stopMcp(): void {
  stopping = true
  sessionKey = undefined
  closeListener(listener)
  listener = undefined
}

async function startListener(port: number): Promise<Server> {
  const api = express()
  api.disable('x-powered-by')
  const server = createServer(
    { requestTimeout: 10000, headersTimeout: 5000, maxHeaderSize: 8192 },
    api
  )
  server.maxConnections = 32
  api.all('/mcp', (req, res, next) => {
    if (req.headers.host !== `${host}:${port}` || req.headers.origin !== undefined) {
      res.sendStatus(403)
      return
    }
    const keyHash = settings.keyHash
    const key = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/i)?.[1]
    if (server !== listener || stopping || !key || !matchesKey(key, keyHash)) {
      res.setHeader('WWW-Authenticate', 'Bearer')
      res.sendStatus(401)
      return
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      res.sendStatus(405)
      return
    }
    res.locals.settings = settings
    next()
  })
  api.post('/mcp', express.json({ limit: '16kb', inflate: false }), async (req, res) => {
    const snapshot = res.locals.settings as StoredSettings
    const isAuthorized = (): boolean => server === listener && !stopping && snapshot === settings
    if (!isAuthorized()) {
      res.sendStatus(401)
      return
    }
    if (Array.isArray(req.body) || !req.body || typeof req.body !== 'object') {
      res
        .status(400)
        .json({ jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: null })
      return
    }
    if (requestCount >= 4) {
      res.sendStatus(429)
      return
    }
    requestCount++
    const mcp = createMcpServer(snapshot, isAuthorized)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    })
    try {
      await mcp.connect(transport)
      await transport.handleRequest(req, res, req.body)
    } catch {
      if (!res.headersSent) res.sendStatus(500)
    } finally {
      requestCount--
      await mcp.close()
    }
  })
  api.use(
    (
      error: { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res.sendStatus(error.status === 413 ? 413 : 400)
    }
  )
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.removeListener('error', reject)
      resolve()
    })
  }).catch(() => {
    throw new Error(`无法监听 MCP 端口 ${port}，请检查端口是否已被占用。`)
  })
  return server
}

function createMcpServer(
  { allowDelayTest, allowProfileSwitch }: StoredSettings,
  isAuthorized: () => boolean
): McpServer {
  const mcp = new McpServer({ name: 'perzike', version: app.getVersion() })
  const readOnly = { readOnlyHint: true, openWorldHint: false }
  const result = (value: Record<string, unknown>) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    structuredContent: value
  })
  const fail = (message: string) => ({
    isError: true,
    content: [{ type: 'text' as const, text: message }]
  })
  const unavailable = () => fail('Perzike 内核暂不可用，或配置已变更。')
  const write = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
  const openWorld = { readOnlyHint: true, openWorldHint: true }
  const currentGroup = async (group: string) =>
    (await mihomoGroups()).find(({ name }) => name === group)

  async function mutate(run: () => Promise<ReturnType<typeof result> | ReturnType<typeof fail>>) {
    if (switching) return fail('已有代理或配置切换正在执行。')
    switching = true
    try {
      return await run()
    } catch {
      return unavailable()
    } finally {
      switching = false
    }
  }

  async function runDelay(run: () => Promise<ReturnType<typeof result> | ReturnType<typeof fail>>) {
    if (testing || performance.now() - lastTestTime < 5000) return fail('测速限频，请稍后重试。')
    testing = true
    try {
      return await run()
    } catch {
      return unavailable()
    } finally {
      lastTestTime = performance.now()
      testing = false
    }
  }
  mcp.registerTool(
    'get_status',
    { description: '查看 Perzike 和内核运行状态。', annotations: readOnly },
    async () => {
      const [version, config, appConfig] = await Promise.allSettled([
        mihomoVersion(),
        mihomoConfig(),
        getAppConfig()
      ])
      return result({
        version: app.getVersion(),
        coreRunning: version.status === 'fulfilled',
        coreVersion: version.status === 'fulfilled' ? version.value.version : null,
        mode: config.status === 'fulfilled' ? config.value.mode : null,
        tunEnabled: config.status === 'fulfilled' ? (config.value.tun?.enable ?? null) : null,
        systemProxyEnabled:
          appConfig.status === 'fulfilled' ? (appConfig.value.sysProxy?.enable ?? false) : null
      })
    }
  )
  mcp.registerTool(
    'list_proxy_groups',
    {
      description: '分页列出代理组及当前选择。指定 group 时分页列出该组候选节点和最后一次延迟。',
      inputSchema: { group: name.optional(), offset },
      annotations: readOnly
    },
    async ({ group, offset }) => {
      try {
        const groups = await mihomoGroups()
        if (group === undefined) {
          return result({
            total: groups.length,
            groups: groups.slice(offset, offset + 50).map(({ name, now, type, all }) => ({
              name,
              selected: now,
              type,
              nodeCount: all.length
            }))
          })
        }
        const found = groups.find(({ name }) => name === group)
        if (!found) return fail('找不到当前代理组。')
        return result({
          group,
          selected: found.now,
          total: found.all.length,
          nodes: found.all
            .slice(offset, offset + 50)
            .map(({ name, history }) => ({ id: name, delayMs: history?.at(-1)?.delay || null }))
        })
      } catch {
        return unavailable()
      }
    }
  )
  mcp.registerTool(
    'get_active_profile',
    { description: '查看当前配置名称和 ID。', annotations: readOnly },
    async () => {
      try {
        const { id, name } = await getCurrentProfileItem()
        return result({ id, name })
      } catch {
        return unavailable()
      }
    }
  )
  mcp.registerTool(
    'get_traffic_summary',
    { description: '查看当前内核累计上传和下载字节数及活动连接数。', annotations: readOnly },
    async () => {
      try {
        const { uploadTotal, downloadTotal, connections } = await mihomoGetConnections()
        return result({
          uploadBytes: uploadTotal,
          downloadBytes: downloadTotal,
          connectionCount: connections?.length ?? 0
        })
      } catch {
        return unavailable()
      }
    }
  )
  if (allowDelayTest) {
    mcp.registerTool(
      'test_proxy_delay',
      {
        description: '使用 Perzike 配置的测速地址测试组内现有节点。',
        inputSchema: { group: name, node: name },
        annotations: openWorld
      },
      async ({ group, node }) =>
        runDelay(async () => {
          const found = await currentGroup(group)
          if (!found?.all.some(({ name }) => name === node)) return fail('找不到该组中的目标节点。')
          if (!isAuthorized()) return unavailable()
          const { delay } = await mihomoProxyDelay(node)
          return result({ group, node, delayMs: delay ?? null })
        })
    )
    mcp.registerTool(
      'test_group_delay',
      {
        description: '用 Perzike 配置的测速地址测试当前组中最多五个候选节点，按延迟返回。',
        inputSchema: {
          group: name,
          nodes: z.array(name).min(1).max(5).optional(),
          limit: z.number().int().min(1).max(5).default(5)
        },
        annotations: openWorld
      },
      async ({ group, nodes, limit }) =>
        runDelay(async () => {
          const profile = await getCurrentProfileItem()
          const found = await currentGroup(group)
          if (!found) return fail('找不到当前代理组。')
          const candidates = [
            ...new Set(nodes ?? found.all.slice(0, limit).map(({ name }) => name))
          ]
          if (candidates.some((node) => !found.all.some(({ name }) => name === node)))
            return fail('测速节点必须属于当前组。')
          const measurements: { node: string; delayMs: number | null }[] = []
          for (let i = 0; i < candidates.length; i += 2) {
            if ((await getCurrentProfileItem()).id !== profile.id || !isAuthorized())
              return unavailable()
            measurements.push(
              ...(await Promise.all(
                candidates.slice(i, i + 2).map(async (node) => {
                  try {
                    return { node, delayMs: (await mihomoProxyDelay(node)).delay || null }
                  } catch {
                    return { node, delayMs: null }
                  }
                })
              ))
            )
          }
          return result({
            group,
            nodes: measurements.sort((a, b) => (a.delayMs ?? Infinity) - (b.delayMs ?? Infinity))
          })
        })
    )
  }
  mcp.registerTool(
    'select_proxy',
    {
      description: '直接切换指定代理组中的现有节点。',
      inputSchema: { group: name, node: name },
      annotations: write
    },
    async ({ group, node }) =>
      mutate(async () => {
        const profile = await getCurrentProfileItem()
        const found = await currentGroup(group)
        if (!found?.all.some(({ name }) => name === node)) return fail('找不到该组中的目标节点。')
        if ((await getCurrentProfileItem()).id !== profile.id || !isAuthorized())
          return unavailable()
        await mihomoChangeProxy(group, node)
        const groups = await mihomoGroups().catch(() => [])
        const selected = groups.find(({ name }) => name === group)?.now ?? null
        return result({ group, previous: found.now, selected, requested: node, applied: true })
      })
  )
  mcp.registerTool(
    'restore_auto_proxy',
    {
      description: '解除 URLTest、Fallback 或 LoadBalance 代理组的手动固定。',
      inputSchema: { group: name },
      annotations: write
    },
    async ({ group }) =>
      mutate(async () => {
        const profile = await getCurrentProfileItem()
        const found = await currentGroup(group)
        if (!found || !['URLTest', 'Fallback', 'LoadBalance'].includes(found.type))
          return fail('该代理组不支持恢复自动选点。')
        if ((await getCurrentProfileItem()).id !== profile.id || !isAuthorized())
          return unavailable()
        if (!found.fixed)
          return result({ group, previous: found.now, selected: found.now, changed: false })
        await mihomoUnfixedProxy(group)
        const after = await currentGroup(group).catch(() => undefined)
        return result({ group, previous: found.now, selected: after?.now ?? null, changed: true })
      })
  )
  mcp.registerTool(
    'list_profiles',
    {
      description: '分页查看本机配置的名称、ID 和当前选择。',
      inputSchema: { offset },
      annotations: readOnly
    },
    async ({ offset }) => {
      try {
        const { items, current } = await getProfileConfig()
        return result({
          current: current ?? 'default',
          total: items.length,
          profiles: items.slice(offset, offset + 50).map(({ id, name }) => ({ id, name }))
        })
      } catch {
        return unavailable()
      }
    }
  )
  if (allowProfileSwitch) {
    mcp.registerTool(
      'switch_profile',
      {
        description: '直接切换到本机已有的配置。会重载内核，现有连接可能中断。',
        inputSchema: { id: name },
        annotations: { ...write, destructiveHint: true }
      },
      async ({ id }) =>
        mutate(async () => {
          const { items } = await getProfileConfig()
          const target = items.find((item) => item.id === id)
          if (!target) return fail('找不到该本机配置。')
          const { id: previous } = await getCurrentProfileItem()
          if (!isAuthorized()) return unavailable()
          if (previous !== id) await changeCurrentProfile(id)
          return result({ previous, current: id, name: target.name, changed: previous !== id })
        })
    )
  }
  mcp.registerTool(
    'list_providers',
    {
      description: '分页查看代理或规则提供者的名称、条目数和更新时间。',
      inputSchema: { kind: z.enum(['proxy', 'rule']), offset },
      annotations: readOnly
    },
    async ({ kind, offset }) => {
      try {
        const { providers } =
          kind === 'proxy' ? await mihomoProxyProviders() : await mihomoRuleProviders()
        const entries = Object.values(providers)
        return result({
          kind,
          total: entries.length,
          providers: entries.slice(offset, offset + 50).map((entry) => ({
            name: entry.name,
            count: 'ruleCount' in entry ? entry.ruleCount : (entry.proxies?.length ?? null),
            updatedAt:
              entry.updatedAt && Number.isFinite(Date.parse(entry.updatedAt))
                ? new Date(entry.updatedAt).toISOString()
                : null
          }))
        })
      } catch {
        return unavailable()
      }
    }
  )
  mcp.registerTool(
    'get_traffic_trend',
    {
      description: '返回小时、日或周窗口的流量趋势。缺少观察样本的区间表示暂无数据。',
      inputSchema: { period: z.enum(['hour', 'day', 'week']) },
      annotations: readOnly
    },
    async ({ period }) => result(getTrafficTrend(period))
  )
  mcp.registerTool(
    'diagnose_proxy',
    {
      description: '查看核心状态、可选代理组的当前节点和延迟摘要，以及近期错误类别。',
      inputSchema: { group: name.optional() },
      annotations: readOnly
    },
    async ({ group }) => {
      const [core, config, target] = await Promise.allSettled([
        mihomoVersion(),
        mihomoConfig(),
        mihomoGroups()
      ])
      const groups = target.status === 'fulfilled' ? target.value : []
      const focused =
        group === undefined ? groups.slice(0, 20) : groups.filter(({ name }) => name === group)
      const counts = { timeout: 0, dns: 0, connection: 0, tls: 0, other: 0 }
      for (const { type, payload } of getCachedMihomoLogs().slice(-100)) {
        if (type !== 'warning' && type !== 'error') continue
        const message = payload.slice(0, 2048)
        if (/timeout|timed out/i.test(message)) counts.timeout++
        else if (/dns|no such host|lookup/i.test(message)) counts.dns++
        else if (/tls|certificate|handshake/i.test(message)) counts.tls++
        else if (/connect|unreachable|refused|reset/i.test(message)) counts.connection++
        else counts.other++
      }
      return result({
        coreRunning: core.status === 'fulfilled',
        mode: config.status === 'fulfilled' ? config.value.mode : null,
        group: group ?? null,
        groupsAvailable: target.status === 'fulfilled',
        groups: focused.map(({ name, now, all }) => {
          const delays = all
            .map(({ history }) => history?.at(-1)?.delay)
            .filter((delay) => typeof delay === 'number')
          return {
            name,
            selected: now,
            measuredNodes: delays.length,
            failedMeasurements: delays.filter((delay) => delay <= 0).length
          }
        }),
        recentWarningsAndErrors: counts
      })
    }
  )
  return mcp
}
