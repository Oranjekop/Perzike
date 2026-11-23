import axios, { AxiosRequestConfig, CancelTokenSource } from 'axios'
import { parseYaml } from '../utils/yaml'
import { app, shell } from 'electron'
import { getAppConfig, getControledMihomoConfig } from '../config'
import { dataDir, exeDir, exePath, isPortable, resourcesFilesDir } from '../utils/dirs'
import { copyFile, rm, writeFile, readFile } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { createHash } from 'crypto'
import { setNotQuitDialog, mainWindow } from '..'
import { disableSysProxy } from '../sys/sysproxy'
import { serviceStatus, stopService } from '../service/manager'
import { appendAppLog } from '../utils/log'

let downloadCancelToken: CancelTokenSource | null = null

interface GithubReleaseAsset {
  name: string
  digest?: string
  browser_download_url: string
}

interface GithubRelease {
  tag_name: string
  draft: boolean
  prerelease: boolean
  assets: GithubReleaseAsset[]
}

interface UpdateMetadata extends AppVersion {
  sha256?: Record<string, string>
}

const releaseBaseUrl = 'https://github.com/Oranjekop/Perzike/releases'
const updateVersionPattern = /^\d+\.\d+\.\d+(?:-beta-[a-f0-9]{7,40})?$/i
const sha256Pattern = /^[a-f0-9]{64}$/i

function quotePowerShellString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function quoteWindowsArgument(value: string): string {
  if (value === '') return '""'
  if (!/[ \t"]/.test(value)) return value

  return `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`
}

const installedMacAppPath = '/Applications/Perzike.app'

async function installMacUpdate(installerPath: string, version: string): Promise<void> {
  const execFilePromise = promisify(execFile)
  const script = [
    'on run argv',
    'do shell script ("/usr/sbin/installer -pkg " & quoted form of (item 1 of argv) & " -target /") with administrator privileges',
    'end run'
  ].join('\n')

  await execFilePromise('/usr/bin/osascript', ['-e', script, '--', installerPath], {
    timeout: 10 * 60 * 1000
  })

  const { stdout } = await execFilePromise(
    '/usr/libexec/PlistBuddy',
    [
      '-c',
      'Print :CFBundleShortVersionString',
      path.join(installedMacAppPath, 'Contents', 'Info.plist')
    ],
    { timeout: 10000 }
  )
  const installedVersion = stdout.trim()
  if (installedVersion !== version) {
    throw new Error(`安装后的版本仍为 ${installedVersion || '未知'}，预期为 ${version}`)
  }

  const relaunch = spawn(
    '/bin/sh',
    [
      '-c',
      'while kill -0 "$1" 2>/dev/null; do sleep 0.2; done; /usr/bin/open "$2"',
      'perzike-updater',
      String(process.pid),
      installedMacAppPath
    ],
    { detached: true, stdio: 'ignore' }
  )
  relaunch.unref()
}

async function launchWindowsInstaller(installerPath: string, args: string[]): Promise<void> {
  const execFilePromise = promisify(execFile)
  const argumentList = args.map(quoteWindowsArgument).join(' ')
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `Start-Process -FilePath ${quotePowerShellString(installerPath)} -ArgumentList ${quotePowerShellString(argumentList)} -Verb RunAs -WindowStyle Hidden`
  ].join('; ')

  await execFilePromise(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { timeout: 120000 }
  )
}

async function stopServiceForPortableUpdate(): Promise<void> {
  const status = await serviceStatus().catch(async (error) => {
    await appendAppLog(`[Updater]: query service status failed before portable update, ${error}\n`)
    return 'unknown' as const
  })

  if (status === 'not-installed' || status === 'stopped') {
    return
  }

  await appendAppLog(`[Updater]: stop service before portable update, status: ${status}\n`)
  await stopService()
}

function createAxiosConfig(
  mixedPort: number,
  cancelToken?: CancelTokenSource['token']
): AxiosRequestConfig {
  return {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Perzike-Updater'
    },
    ...(mixedPort != 0 && {
      proxy: {
        protocol: 'http',
        host: '127.0.0.1',
        port: mixedPort
      }
    }),
    ...(cancelToken && { cancelToken })
  }
}

function createReleaseLookupConfig(mixedPort: number): AxiosRequestConfig {
  const config = createAxiosConfig(mixedPort)
  return {
    ...config,
    headers: {
      ...config.headers,
      'Cache-Control': 'no-cache'
    },
    params: { _: Date.now() }
  }
}

async function fetchReleaseByTag(
  tag: string,
  mixedPort: number
): Promise<GithubRelease | undefined> {
  try {
    const res = await axios.get<GithubRelease>(
      `https://api.github.com/repos/Oranjekop/Perzike/releases/tags/${tag}`,
      createReleaseLookupConfig(mixedPort)
    )
    return res.data
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      return undefined
    }
    throw e
  }
}

async function fetchReleases(mixedPort: number): Promise<GithubRelease[]> {
  const res = await axios.get<GithubRelease[]>(
    'https://api.github.com/repos/Oranjekop/Perzike/releases?per_page=20',
    createReleaseLookupConfig(mixedPort)
  )
  return res.data
}

async function resolveReleaseForChannel(
  updateChannel: AppConfig['updateChannel'],
  mixedPort: number
): Promise<GithubRelease | undefined> {
  if (updateChannel === 'beta') {
    const betaRelease = await fetchReleaseByTag('pre-release', mixedPort)
    if (betaRelease && !betaRelease.draft) {
      return betaRelease
    }
  }

  const releases = await fetchReleases(mixedPort)
  return releases.find((release) => {
    if (release.draft) return false
    if (updateChannel === 'stable' && release.prerelease) return false
    if (updateChannel === 'beta' && !release.prerelease) return false
    return true
  })
}

async function resolveReleaseForVersion(
  version: string,
  mixedPort: number
): Promise<GithubRelease | undefined> {
  if (version.includes('beta')) {
    return await resolveReleaseForChannel('beta', mixedPort)
  }

  const releases = await fetchReleases(mixedPort)
  return releases.find((release) => {
    if (release.draft || release.prerelease) return false
    return release.tag_name === version || release.tag_name === `v${version}`
  })
}

export async function checkUpdate(): Promise<AppVersion | undefined> {
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  const { updateChannel = 'stable' } = await getAppConfig()
  const isBeta = updateChannel === 'beta'
  const endpoint = isBeta ? 'download/pre-release' : 'latest/download'
  const latest = await fetchUpdateMetadata(endpoint, mixedPort)
  if (!latest && isBeta) return undefined
  if (!latest) throw new Error('正式版更新文件暂不可用，请稍后重试')
  if (latest.version.includes('-beta-') !== isBeta) throw new Error('更新文件与所选更新通道不符')
  if (latest.version === app.getVersion()) return undefined
  return { version: latest.version, changelog: latest.changelog }
}

async function fetchUpdateMetadata(
  endpoint: string,
  mixedPort: number
): Promise<UpdateMetadata | undefined> {
  try {
    const response = await axios.get<string>(`${releaseBaseUrl}/${endpoint}/latest.yml`, {
      ...createAxiosConfig(mixedPort),
      headers: { Accept: 'application/yaml, text/plain, */*', 'User-Agent': 'Perzike-Updater' },
      responseType: 'text',
      timeout: 15000,
      maxContentLength: 256 * 1024
    })
    const metadata = parseYaml<UpdateMetadata>(response.data)
    if (
      !metadata ||
      typeof metadata.version !== 'string' ||
      !updateVersionPattern.test(metadata.version) ||
      typeof metadata.changelog !== 'string'
    ) {
      throw new Error('GitHub 发布的更新文件格式无效')
    }
    return metadata
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return undefined
    throw error
  }
}

async function resolveUpdateAsset(
  version: string,
  file: string,
  mixedPort: number
): Promise<{ url: string; hash: string }> {
  const tags = version.includes('-beta-') ? ['pre-release'] : [version, `v${version}`]
  for (const tag of tags) {
    const metadata = await fetchUpdateMetadata(`download/${tag}`, mixedPort)
    if (!metadata) continue
    if (metadata.version !== version) throw new Error('发布版本已变化，请重新检测更新')
    if (metadata.sha256 === undefined) break
    const hash = metadata.sha256?.[file]
    if (typeof hash !== 'string' || !sha256Pattern.test(hash))
      throw new Error(`更新文件缺少 ${file} 的有效 SHA-256`)
    return { url: `${releaseBaseUrl}/download/${tag}/${file}`, hash: hash.toLowerCase() }
  }

  let release: GithubRelease | undefined
  try {
    release = await resolveReleaseForVersion(version, mixedPort)
  } catch (error) {
    if (axios.isAxiosError(error) && [403, 429].includes(error.response?.status ?? 0)) {
      throw new Error('GitHub 暂时限制了旧版更新的校验信息查询，请从 Releases 手动下载或稍后重试')
    }
    throw error
  }
  const asset = release?.assets.find(({ name }) => name === file)
  const hash = asset?.digest?.match(/^sha256:([a-f0-9]{64})$/i)?.[1]
  if (!asset || !hash) throw new Error(`无法从 GitHub Release 中找到 ${file} 的 SHA-256`)
  return { url: asset.browser_download_url, hash: hash.toLowerCase() }
}

export async function downloadAndInstallUpdate(version: string): Promise<void> {
  if (!updateVersionPattern.test(version)) throw new Error('更新版本无效')
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  const fileMap = {
    'win32-x64': `perzike-windows-${version}-x64-setup.exe`,
    'win32-arm64': `perzike-windows-${version}-arm64-setup.exe`,
    'darwin-x64': `perzike-macos-${version}-x64.pkg`,
    'darwin-arm64': `perzike-macos-${version}-arm64.pkg`
  }
  let file = fileMap[`${process.platform}-${process.arch}`]
  if (!file) {
    throw new Error('不支持自动更新，请手动下载更新')
  }
  if (isPortable()) {
    file = file.replace('-setup.exe', '-portable.7z')
  }
  downloadCancelToken = axios.CancelToken.source()

  try {
    mainWindow?.webContents.send('update-status', {
      downloading: true,
      progress: 0
    })

    const { url, hash: expectedHash } = await resolveUpdateAsset(version, file, mixedPort)

    if (!existsSync(path.join(dataDir(), file))) {
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        ...createAxiosConfig(mixedPort, downloadCancelToken.token),
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        onDownloadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          )
          mainWindow?.webContents.send('update-status', {
            downloading: true,
            progress: percentCompleted
          })
        }
      })
      await writeFile(path.join(dataDir(), file), res.data)
    }

    const fileBuffer = await readFile(path.join(dataDir(), file))
    const hashSum = createHash('sha256')
    hashSum.update(fileBuffer)
    const localHash = hashSum.digest('hex').toLowerCase()
    if (localHash !== expectedHash) {
      await rm(path.join(dataDir(), file), { force: true })
      throw new Error(`SHA-256 校验失败：本地哈希 ${localHash} 与预期 ${expectedHash} 不符`)
    }

    mainWindow?.webContents.send('update-status', {
      downloading: false,
      progress: 100
    })

    await disableSysProxy(false).catch(() => undefined)
    if (file.endsWith('.exe')) {
      await launchWindowsInstaller(path.join(dataDir(), file), ['/S', '--force-run'])
      setNotQuitDialog()
      app.quit()
    }
    if (file.endsWith('.7z')) {
      await stopServiceForPortableUpdate()
      await copyFile(path.join(resourcesFilesDir(), '7za.exe'), path.join(dataDir(), '7za.exe'))
      spawn(
        'cmd',
        [
          '/C',
          `"timeout /t 2 /nobreak >nul && "${path.join(dataDir(), '7za.exe')}" x -o"${exeDir()}" -y "${path.join(dataDir(), file)}" & start "" "${exePath()}""`
        ],
        {
          shell: true,
          detached: true
        }
      ).unref()
      setNotQuitDialog()
      app.quit()
    }
    if (file.endsWith('.pkg')) {
      try {
        await installMacUpdate(path.join(dataDir(), file), version)
        setNotQuitDialog()
        app.quit()
      } catch (error) {
        await appendAppLog(`[Updater]: macOS package install failed, ${error}\n`)
        const openError = await shell.openPath(path.join(dataDir(), file))
        if (openError) {
          throw new Error(
            `${error instanceof Error ? error.message : String(error)}；打开安装包失败：${openError}`
          )
        }
      }
    }
  } catch (e) {
    await rm(path.join(dataDir(), file), { force: true })
    if (axios.isCancel(e)) {
      mainWindow?.webContents.send('update-status', {
        downloading: false,
        progress: 0,
        error: '下载已取消'
      })
      return
    } else {
      mainWindow?.webContents.send('update-status', {
        downloading: false,
        progress: 0,
        error: e instanceof Error ? e.message : '下载失败'
      })
    }
    throw e
  } finally {
    downloadCancelToken = null
  }
}

export async function cancelUpdate(): Promise<void> {
  if (downloadCancelToken) {
    downloadCancelToken.cancel('用户取消下载')
    downloadCancelToken = null
  }
}
