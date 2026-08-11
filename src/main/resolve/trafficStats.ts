import dayjs from 'dayjs'
import { readFileSync } from 'fs'
import { mkdir, rename, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { dataDir } from '../utils/dirs'

const STORE_VERSION = 1
const RETENTION_DAYS = 400
const WRITE_DELAY = 1500
const RECORD_SEPARATOR = '\u001f'

interface StoredTrafficRecord {
  host: string
  strategy: string
  interfaceName: string
  upload: number
  download: number
  requests: number
}

interface StoredTrafficDay {
  records: Record<string, StoredTrafficRecord>
}

interface StoredTrafficStore {
  version: number
  days: Record<string, StoredTrafficDay>
}

interface ConnectionCounter {
  upload: number
  download: number
}

interface TrafficRow extends StoredTrafficRecord {
  date: string
}

let store: StoredTrafficStore | null = null
let writeTimer: NodeJS.Timeout | null = null
let writeQueue: Promise<void> = Promise.resolve()
const connectionCounters = new Map<string, ConnectionCounter>()

function getStorePath(): string {
  return path.join(dataDir(), 'traffic-stats.json')
}

function createStore(): StoredTrafficStore {
  return { version: STORE_VERSION, days: {} }
}

function loadStore(): StoredTrafficStore {
  if (store) return store

  try {
    const parsed = JSON.parse(readFileSync(getStorePath(), 'utf8')) as Partial<StoredTrafficStore>
    if (parsed.version === STORE_VERSION && parsed.days && typeof parsed.days === 'object') {
      store = {
        version: STORE_VERSION,
        days: parsed.days as Record<string, StoredTrafficDay>
      }
    } else {
      store = createStore()
    }
  } catch {
    store = createStore()
  }

  return store
}

function getString(values: unknown[], fallback: string): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return fallback
}

function getNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function getConnectionDimensions(connection: ControllerConnectionDetail): {
  host: string
  strategy: string
  interfaceName: string
} {
  const metadata = connection.metadata || {}
  return {
    host: getString([metadata.sniffHost, metadata.host, metadata.destinationIP], '未知主机'),
    strategy: getString([connection.chains?.[0]], '直连网络'),
    interfaceName: getString(
      [metadata.inboundName, metadata.inboundIP, metadata.sourceIP, metadata.network],
      '未知接口'
    )
  }
}

function getRecordId(host: string, strategy: string, interfaceName: string): string {
  return [host, strategy, interfaceName].join(RECORD_SEPARATOR)
}

function getTodayKey(): string {
  return dayjs().format('YYYY-MM-DD')
}

function getDay(storeValue: StoredTrafficStore, date: string): StoredTrafficDay {
  if (!storeValue.days[date]) {
    storeValue.days[date] = { records: {} }
  }
  return storeValue.days[date]
}

function pruneStore(storeValue: StoredTrafficStore): boolean {
  const cutoff = dayjs().subtract(RETENTION_DAYS, 'day').format('YYYY-MM-DD')
  let changed = false

  for (const date of Object.keys(storeValue.days)) {
    if (date < cutoff) {
      delete storeValue.days[date]
      changed = true
    }
  }

  return changed
}

function schedulePersist(): void {
  if (writeTimer) return

  writeTimer = setTimeout(() => {
    writeTimer = null
    void flushTrafficStats()
  }, WRITE_DELAY)
}

export async function flushTrafficStats(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }

  if (!store) return

  const snapshot = JSON.stringify(store)
  const targetPath = getStorePath()
  const tempPath = `${targetPath}.tmp`
  writeQueue = writeQueue
    .then(async () => {
      await mkdir(path.dirname(targetPath), { recursive: true })
      await writeFile(tempPath, snapshot, 'utf8')
      if (process.platform === 'win32') {
        try {
          await unlink(targetPath)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      }
      await rename(tempPath, targetPath)
    })
    .catch(() => {})
  await writeQueue
}

export function recordTrafficConnections(info: ControllerConnections): void {
  if (!Array.isArray(info?.connections)) return

  const storeValue = loadStore()
  const date = getTodayKey()
  const day = getDay(storeValue, date)
  const activeIds = new Set<string>()
  let changed = false

  for (const connection of info.connections) {
    if (!connection?.id) continue

    const id = connection.id
    activeIds.add(id)
    const upload = getNumber(connection.upload)
    const download = getNumber(connection.download)
    const previous = connectionCounters.get(id)
    const reset =
      previous !== undefined && (upload < previous.upload || download < previous.download)
    const uploadDelta = previous && !reset ? upload - previous.upload : upload
    const downloadDelta = previous && !reset ? download - previous.download : download
    const isNewRequest = previous === undefined || reset

    connectionCounters.set(id, { upload, download })

    if (!isNewRequest && uploadDelta <= 0 && downloadDelta <= 0) continue

    const { host, strategy, interfaceName } = getConnectionDimensions(connection)
    const recordId = getRecordId(host, strategy, interfaceName)
    const record =
      day.records[recordId] ||
      (day.records[recordId] = {
        host,
        strategy,
        interfaceName,
        upload: 0,
        download: 0,
        requests: 0
      })

    record.upload += Math.max(uploadDelta, 0)
    record.download += Math.max(downloadDelta, 0)
    if (isNewRequest) record.requests += 1
    changed = true
  }

  for (const id of connectionCounters.keys()) {
    if (!activeIds.has(id)) connectionCounters.delete(id)
  }

  if (pruneStore(storeValue)) changed = true
  if (changed) schedulePersist()
}

function getPeriodDates(period: TrafficStatsPeriod): string[] {
  const now = dayjs()
  let cursor = now.startOf('day')
  let end = now.startOf('day')

  if (period === 'month') {
    cursor = now.startOf('month').startOf('day')
    end = now.startOf('day')
  } else if (period === 'lastMonth') {
    const previousMonth = now.subtract(1, 'month')
    cursor = previousMonth.startOf('month').startOf('day')
    end = previousMonth.endOf('month').startOf('day')
  }

  const dates: string[] = []
  while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
    dates.push(cursor.format('YYYY-MM-DD'))
    cursor = cursor.add(1, 'day')
  }
  return dates
}

function getRows(period: TrafficStatsPeriod): { rows: TrafficRow[]; dates: string[] } {
  const storeValue = loadStore()
  const dates = getPeriodDates(period)
  const rows: TrafficRow[] = []

  for (const date of dates) {
    const day = storeValue.days[date]
    if (!day?.records) continue
    for (const record of Object.values(day.records)) {
      rows.push({ ...record, date })
    }
  }

  return { rows, dates }
}

function groupByValue(row: TrafficRow, groupBy: TrafficStatsGroupBy): string {
  if (groupBy === 'host') return row.host
  if (groupBy === 'strategy') return row.strategy
  return row.interfaceName
}

function summarize(
  rows: TrafficRow[]
): Pick<TrafficStatsResult, 'upload' | 'download' | 'total' | 'requests'> {
  const upload = rows.reduce((sum, row) => sum + row.upload, 0)
  const download = rows.reduce((sum, row) => sum + row.download, 0)
  const requests = rows.reduce((sum, row) => sum + row.requests, 0)
  return { upload, download, total: upload + download, requests }
}

function buildGroups(rows: TrafficRow[], groupBy: TrafficStatsGroupBy): TrafficStatsGroup[] {
  const groups = new Map<string, TrafficStatsGroup>()

  for (const row of rows) {
    const key = groupByValue(row, groupBy)
    const group = groups.get(key) || { key, upload: 0, download: 0, total: 0, requests: 0 }
    group.upload += row.upload
    group.download += row.download
    group.total += row.upload + row.download
    group.requests += row.requests
    groups.set(key, group)
  }

  return [...groups.values()].sort((left, right) => {
    if (right.total !== left.total) return right.total - left.total
    return left.key.localeCompare(right.key)
  })
}

function buildDaily(rows: TrafficRow[], dates: string[]): TrafficStatsDay[] {
  const totals = new Map<string, TrafficStatsDay>()
  for (const date of dates) totals.set(date, { date, upload: 0, download: 0, total: 0 })

  for (const row of rows) {
    const day = totals.get(row.date)
    if (!day) continue
    day.upload += row.upload
    day.download += row.download
    day.total += row.upload + row.download
  }

  return [...totals.values()]
}

function emptySummary(
  period: TrafficStatsPeriod,
  groupBy: TrafficStatsGroupBy,
  rows: TrafficRow[],
  dates: string[]
): TrafficStatsResult {
  return {
    period,
    groupBy,
    ...summarize(rows),
    daily: buildDaily(rows, dates),
    groups: buildGroups(rows, groupBy),
    updatedAt: new Date().toISOString()
  }
}

export function getTrafficStats(
  period: TrafficStatsPeriod = 'today',
  groupBy: TrafficStatsGroupBy = 'host'
): TrafficStatsResult {
  const { rows, dates } = getRows(period)
  return emptySummary(period, groupBy, rows, dates)
}

export function getTrafficStatsDetail(
  period: TrafficStatsPeriod,
  groupBy: TrafficStatsGroupBy,
  key: string
): TrafficStatsDetailResult {
  const { rows, dates } = getRows(period)
  const selectedRows = rows.filter((row) => groupByValue(row, groupBy) === key)
  const summary = emptySummary(period, groupBy, selectedRows, dates)

  return {
    ...summary,
    key,
    breakdowns: {
      host: buildGroups(selectedRows, 'host'),
      strategy: buildGroups(selectedRows, 'strategy'),
      interface: buildGroups(selectedRows, 'interface')
    }
  }
}

export async function clearTrafficStats(): Promise<void> {
  store = createStore()
  connectionCounters.clear()
  await flushTrafficStats()
}
