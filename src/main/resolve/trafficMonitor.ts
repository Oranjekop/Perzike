import { ChildProcess, spawn } from 'child_process'
import { getAppConfig } from '../config'
import { dataDir, resourcesFilesDir } from '../utils/dirs'
import path from 'path'
import { existsSync } from 'fs'
import { readFile, rm, writeFile } from 'fs/promises'
import { startProcessWithElevation, stopProcessWithElevation } from '../utils/elevation'

let child: ChildProcess | undefined
let elevatedMonitorPid: number | undefined

async function stopMonitorPid(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGINT')
  } catch (error) {
    const errorCode = error && typeof error === 'object' && 'code' in error ? error.code : undefined
    if (errorCode === 'ESRCH') return
    await stopProcessWithElevation(pid)
  }
}

export async function startMonitor(detached = false): Promise<void> {
  if (process.platform !== 'win32') return
  if (existsSync(path.join(dataDir(), 'monitor.pid'))) {
    const pid = parseInt(await readFile(path.join(dataDir(), 'monitor.pid'), 'utf-8'))
    try {
      await stopMonitorPid(pid)
    } catch {
      // ignore
    } finally {
      await rm(path.join(dataDir(), 'monitor.pid'))
    }
  }
  const { showTraffic = false } = await getAppConfig()
  if (detached && showTraffic && elevatedMonitorPid) {
    await writeFile(path.join(dataDir(), 'monitor.pid'), elevatedMonitorPid.toString())
    return
  }
  await stopMonitor()
  if (!showTraffic) return
  const monitorDir = path.join(resourcesFilesDir(), 'TrafficMonitor')
  const monitorPath = path.join(monitorDir, 'TrafficMonitor.exe')
  const monitor = spawn(monitorPath, [], {
    cwd: monitorDir,
    detached: detached,
    stdio: detached ? 'ignore' : undefined
  })

  try {
    await new Promise<void>((resolve, reject) => {
      monitor.once('spawn', resolve)
      monitor.once('error', reject)
    })
  } catch (error) {
    monitor.removeAllListeners()
    const errorCode = error && typeof error === 'object' && 'code' in error ? error.code : undefined
    if (errorCode !== 'EACCES') throw error

    elevatedMonitorPid = await startProcessWithElevation(monitorPath, [])
    if (detached) {
      await writeFile(path.join(dataDir(), 'monitor.pid'), elevatedMonitorPid.toString())
    }
    return
  }

  child = monitor
  if (detached) {
    if (child && child.pid) {
      await writeFile(path.join(dataDir(), 'monitor.pid'), child.pid.toString())
    }
    child.unref()
  }
}

async function stopMonitor(): Promise<void> {
  if (child) {
    child.kill('SIGINT')
    child = undefined
  }
  if (elevatedMonitorPid) {
    await stopMonitorPid(elevatedMonitorPid)
    elevatedMonitorPid = undefined
  }
}
