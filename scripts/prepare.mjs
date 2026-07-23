/* eslint-disable @typescript-eslint/explicit-function-return-type */
import fs from 'fs'
import AdmZip from 'adm-zip'
import path from 'path'
import zlib from 'zlib'
import { extract } from 'tar'
import { execFileSync, execSync } from 'child_process'
import { pathToFileURL } from 'url'

const cwd = process.cwd()
const TEMP_DIR = path.join(cwd, 'node_modules/.temp')
const PERZIKE_SERVICE_REPO = 'https://github.com/Oranjekop/perzike-service'
const PERZIKE_RUN_REPO = 'https://github.com/Oranjekop/perzike-run'
const TRAFFIC_MONITOR_RELEASE_API =
  'https://api.github.com/repos/zhongyang219/TrafficMonitor/releases/latest'
let arch = process.arch
const platform = process.platform
const requestedArch = process.argv
  .slice(2)
  .map((argument) => argument.replace(/^--/, ''))
  .find((argument) => ['x64', 'ia32', 'arm64', 'loong64'].includes(argument))
if (requestedArch) {
  arch = requestedArch
}

if (process.env.SKIP_PREPARE === '1') {
  console.log('Skipping prepare script...')
  process.exit(0)
}

/* ======= mihomo alpha======= */
const MIHOMO_ALPHA_VERSION_URL =
  'https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt'
const MIHOMO_ALPHA_URL_PREFIX = `https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha`
let MIHOMO_ALPHA_VERSION

const MIHOMO_ALPHA_MAP = {
  'win32-x64': 'mihomo-windows-amd64-v3',
  'win32-ia32': 'mihomo-windows-386',
  'win32-arm64': 'mihomo-windows-arm64',
  'darwin-x64': 'mihomo-darwin-amd64-v3',
  'darwin-arm64': 'mihomo-darwin-arm64',
  'linux-x64': 'mihomo-linux-amd64-v3',
  'linux-arm64': 'mihomo-linux-arm64',
  'linux-loong64': 'mihomo-linux-loong64-abi2'
}

// Fetch the latest alpha release version from the version.txt file
async function getLatestAlphaVersion() {
  try {
    const response = await fetch(MIHOMO_ALPHA_VERSION_URL, {
      method: 'GET'
    })
    let v = await response.text()
    MIHOMO_ALPHA_VERSION = v.trim() // Trim to remove extra whitespaces
    console.log(`Latest alpha version: ${MIHOMO_ALPHA_VERSION}`)
  } catch (error) {
    console.error('Error fetching latest alpha version:', error.message)
    process.exit(1)
  }
}

/* ======= mihomo release ======= */
const MIHOMO_VERSION_URL =
  'https://github.com/MetaCubeX/mihomo/releases/latest/download/version.txt'
const MIHOMO_URL_PREFIX = `https://github.com/MetaCubeX/mihomo/releases/download`
let MIHOMO_VERSION

const MIHOMO_MAP = {
  'win32-x64': 'mihomo-windows-amd64-v3',
  'win32-ia32': 'mihomo-windows-386',
  'win32-arm64': 'mihomo-windows-arm64',
  'darwin-x64': 'mihomo-darwin-amd64-v3',
  'darwin-arm64': 'mihomo-darwin-arm64',
  'linux-x64': 'mihomo-linux-amd64-v3',
  'linux-arm64': 'mihomo-linux-arm64',
  'linux-loong64': 'mihomo-linux-loong64-abi2'
}

// Fetch the latest release version from the version.txt file
async function getLatestReleaseVersion() {
  try {
    const response = await fetch(MIHOMO_VERSION_URL, {
      method: 'GET'
    })
    let v = await response.text()
    MIHOMO_VERSION = v.trim() // Trim to remove extra whitespaces
    console.log(`Latest release version: ${MIHOMO_VERSION}`)
  } catch (error) {
    console.error('Error fetching latest release version:', error.message)
    process.exit(1)
  }
}

/*
 * check available
 */
if (!MIHOMO_MAP[`${platform}-${arch}`]) {
  throw new Error(`unsupported platform "${platform}-${arch}"`)
}

if (!MIHOMO_ALPHA_MAP[`${platform}-${arch}`]) {
  throw new Error(`unsupported platform "${platform}-${arch}"`)
}

/**
 * core info
 */
function MihomoAlpha() {
  const name = MIHOMO_ALPHA_MAP[`${platform}-${arch}`]
  const isWin = platform === 'win32'
  const urlExt = isWin ? 'zip' : 'gz'
  const downloadURL = `${MIHOMO_ALPHA_URL_PREFIX}/${name}-${MIHOMO_ALPHA_VERSION}.${urlExt}`
  const exeFile = `${name}${isWin ? '.exe' : ''}`
  const zipFile = `${name}-${MIHOMO_ALPHA_VERSION}.${urlExt}`

  return {
    name: 'mihomo-alpha',
    targetFile: `mihomo-alpha${isWin ? '.exe' : ''}`,
    exeFile,
    zipFile,
    downloadURL
  }
}

function mihomo() {
  const name = MIHOMO_MAP[`${platform}-${arch}`]
  const isWin = platform === 'win32'
  const urlExt = isWin ? 'zip' : 'gz'
  const downloadURL = `${MIHOMO_URL_PREFIX}/${MIHOMO_VERSION}/${name}-${MIHOMO_VERSION}.${urlExt}`
  const exeFile = `${name}${isWin ? '.exe' : ''}`
  const zipFile = `${name}-${MIHOMO_VERSION}.${urlExt}`

  return {
    name: 'mihomo',
    targetFile: `mihomo${isWin ? '.exe' : ''}`,
    exeFile,
    zipFile,
    downloadURL
  }
}
/**
 * download sidecar and rename
 */
async function resolveSidecar(binInfo) {
  const { name, targetFile, zipFile, exeFile, downloadURL } = binInfo

  const sidecarDir = path.join(cwd, 'extra', 'sidecar')
  const sidecarPath = path.join(sidecarDir, targetFile)

  fs.mkdirSync(sidecarDir, { recursive: true })
  ensureWindowsDirectoryAccess(sidecarDir)
  if (fs.existsSync(sidecarPath)) {
    fs.rmSync(sidecarPath)
  }
  const tempDir = path.join(TEMP_DIR, name)
  const tempZip = path.join(tempDir, zipFile)
  const tempExe = path.join(tempDir, exeFile)

  fs.mkdirSync(tempDir, { recursive: true })
  try {
    if (!fs.existsSync(tempZip)) {
      await downloadFile(downloadURL, tempZip)
    }

    if (zipFile.endsWith('.zip')) {
      const zip = new AdmZip(tempZip)
      zip.getEntries().forEach((entry) => {
        console.log(`[DEBUG]: "${name}" entry name`, entry.entryName)
      })
      zip.extractAllTo(tempDir, true)
      fs.renameSync(tempExe, sidecarPath)
      console.log(`[INFO]: "${name}" unzip finished`)
    } else if (zipFile.endsWith('.tgz')) {
      // tgz
      fs.mkdirSync(tempDir, { recursive: true })
      await extract({
        cwd: tempDir,
        file: tempZip
      })
      const files = fs.readdirSync(tempDir)
      console.log(`[DEBUG]: "${name}" files in tempDir:`, files)
      const extractedFile = files.find((file) => file.startsWith('虚空终端-'))
      if (extractedFile) {
        const extractedFilePath = path.join(tempDir, extractedFile)
        fs.renameSync(extractedFilePath, sidecarPath)
        console.log(`[INFO]: "${name}" file renamed to "${sidecarPath}"`)
        execSync(`chmod 755 ${sidecarPath}`)
        console.log(`[INFO]: "${name}" chmod binary finished`)
      } else {
        throw new Error(`Expected file not found in ${tempDir}`)
      }
    } else {
      // gz
      const readStream = fs.createReadStream(tempZip)
      const writeStream = fs.createWriteStream(sidecarPath)
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          console.error(`[ERROR]: "${name}" gz failed:`, error.message)
          reject(error)
        }
        readStream
          .pipe(zlib.createGunzip().on('error', onError))
          .pipe(writeStream)
          .on('finish', () => {
            console.log(`[INFO]: "${name}" gunzip finished`)
            execSync(`chmod 755 ${sidecarPath}`)
            console.log(`[INFO]: "${name}" chmod binary finished`)
            resolve()
          })
          .on('error', onError)
      })
    }

    ensureWindowsExecutableAccess(sidecarPath)
  } catch (err) {
    // 需要删除文件
    if (fs.existsSync(sidecarPath)) {
      fs.rmSync(sidecarPath)
    }
    throw err
  } finally {
    fs.rmSync(tempDir, { recursive: true })
  }
}

function ensureWindowsDirectoryAccess(targetPath) {
  if (platform !== 'win32') {
    return
  }

  try {
    execFileSync('icacls.exe', [targetPath, '/grant', '*S-1-5-32-545:(OI)(CI)RX'], {
      stdio: 'ignore'
    })
  } catch (error) {
    console.warn(
      `[WARN]: failed to grant read/execute permission for "${targetPath}":`,
      error.message
    )
  }
}

function ensureWindowsExecutableAccess(targetPath) {
  if (platform !== 'win32') {
    return
  }

  try {
    execFileSync('icacls.exe', [targetPath, '/grant', '*S-1-5-32-545:RX'], { stdio: 'ignore' })
  } catch (error) {
    console.warn(
      `[WARN]: failed to grant read/execute permission for "${targetPath}":`,
      error.message
    )
  }
}

/**
 * download the file to the extra dir
 */
async function resolveResource(binInfo) {
  const { file, downloadURL, needExecutable = false } = binInfo

  const resDir = path.join(cwd, 'extra', 'files')
  const targetPath = path.join(resDir, file)

  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath)
  }

  fs.mkdirSync(resDir, { recursive: true })
  await downloadFile(downloadURL, targetPath)

  if (needExecutable && platform !== 'win32') {
    execSync(`chmod 755 ${targetPath}`)
    console.log(`[INFO]: ${file} chmod finished`)
  }

  console.log(`[INFO]: ${file} finished`)
}

/**
 * download file and save to `path`
 */
async function downloadFile(url, path) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/octet-stream' }
  })
  if (!response.ok) {
    throw new Error(`download failed (${response.status} ${response.statusText}): ${url}`)
  }
  const buffer = await response.arrayBuffer()
  fs.writeFileSync(path, new Uint8Array(buffer))

  console.log(`[INFO]: download finished "${url}"`)
}

const resolveMmdb = () =>
  resolveResource({
    file: 'country.mmdb',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country-lite.mmdb`
  })
const resolveMetadb = () =>
  resolveResource({
    file: 'geoip.metadb',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb`
  })
const resolveGeosite = () =>
  resolveResource({
    file: 'geosite.dat',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat`
  })
const resolveGeoIP = () =>
  resolveResource({
    file: 'geoip.dat',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat`
  })
const resolveASN = () =>
  resolveResource({
    file: 'ASN.mmdb',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb`
  })
const resolveEnableLoopback = () =>
  resolveResource({
    file: 'enableLoopback.exe',
    downloadURL: `https://github.com/Kuingsmile/uwp-tool/releases/download/latest/enableLoopback.exe`
  })
const resolvePerzikeService = () => {
  const map = {
    'win32-x64': 'perzike-service-windows-amd64-v3',
    'win32-ia32': 'perzike-service-windows-386',
    'win32-arm64': 'perzike-service-windows-arm64',
    'darwin-x64': 'perzike-service-darwin-amd64-v3',
    'darwin-arm64': 'perzike-service-darwin-arm64',
    'linux-x64': 'perzike-service-linux-amd64-v3',
    'linux-arm64': 'perzike-service-linux-arm64',
    'linux-loong64': 'perzike-service-linux-loong64-abi2'
  }
  if (!map[`${platform}-${arch}`]) {
    throw new Error(`unsupported platform "${platform}-${arch}"`)
  }
  const base = map[`${platform}-${arch}`]
  const ext = platform == 'win32' ? '.exe' : ''

  return resolveResource({
    file: `perzike-service${ext}`,
    downloadURL: `${PERZIKE_SERVICE_REPO}/releases/download/pre-release/${base}${ext}`,
    needExecutable: true
  })
}
const resolveRunner = () =>
  resolveResource({
    file: 'perzike-run.exe',
    downloadURL: `${PERZIKE_RUN_REPO}/releases/download/${arch}/perzike-run.exe`
  })

export const resolveMonitor = async (targetArch = arch) => {
  const assetSuffix = {
    ia32: '_x86.zip',
    x64: '_x64.zip',
    arm64: '_arm64ec.zip'
  }[targetArch]
  if (!assetSuffix) {
    throw new Error(`unsupported TrafficMonitor architecture "${targetArch}"`)
  }

  const releaseHeaders = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Perzike-build'
  }
  if (process.env.GITHUB_TOKEN) {
    releaseHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  const releaseResponse = await fetch(TRAFFIC_MONITOR_RELEASE_API, { headers: releaseHeaders })
  if (!releaseResponse.ok) {
    throw new Error(
      `TrafficMonitor release lookup failed (${releaseResponse.status} ${releaseResponse.statusText})`
    )
  }
  const release = await releaseResponse.json()
  const asset = release.assets?.find((item) => item.name?.endsWith(assetSuffix))
  if (!asset?.browser_download_url) {
    throw new Error(
      `TrafficMonitor ${release.tag_name ?? 'latest'} asset not found: *${assetSuffix}`
    )
  }

  const tempDir = path.join(TEMP_DIR, 'TrafficMonitor')
  const tempZip = path.join(tempDir, asset.name)
  const extractedDir = path.join(tempDir, 'extracted')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  await downloadFile(asset.browser_download_url, tempZip)

  const zip = new AdmZip(tempZip)
  const executableEntry = zip
    .getEntries()
    .find(
      (entry) =>
        !entry.isDirectory &&
        path.posix.basename(entry.entryName).toLowerCase() === 'trafficmonitor.exe'
    )
  if (!executableEntry) {
    throw new Error(`TrafficMonitor.exe not found in ${asset.name}`)
  }

  if (fs.existsSync(extractedDir)) {
    fs.rmSync(extractedDir, { recursive: true })
  }
  zip.extractAllTo(extractedDir, true)

  const resDir = path.join(cwd, 'extra', 'files')
  const targetPath = path.join(resDir, 'TrafficMonitor')
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true })
  }
  fs.mkdirSync(resDir, { recursive: true })
  const packageDir = path.dirname(
    path.join(extractedDir, ...executableEntry.entryName.split('/').filter(Boolean))
  )
  fs.renameSync(packageDir, targetPath)
  fs.writeFileSync(path.join(targetPath, 'global_cfg.ini'), '\n[config]\nportable_mode = false\n')

  console.log(`[INFO]: TrafficMonitor ${release.tag_name} (${asset.name}) finished`)
}

const resolve7zip = () =>
  resolveResource({
    file: '7za.exe',
    downloadURL: `https://github.com/develar/7zip-bin/raw/master/win/${arch}/7za.exe`
  })
const resolveSubstore = () =>
  resolveResource({
    file: 'sub-store.bundle.js',
    downloadURL:
      'https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.bundle.js'
  })
const resolveSubstoreFrontend = async () => {
  const tempDir = path.join(TEMP_DIR, 'substore-frontend')
  const tempZip = path.join(tempDir, 'dist.zip')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  await downloadFile(
    'https://github.com/sub-store-org/Sub-Store-Front-End/releases/latest/download/dist.zip',
    tempZip
  )
  const zip = new AdmZip(tempZip)
  const resDir = path.join(cwd, 'extra', 'files')
  const targetPath = path.join(resDir, 'sub-store-frontend')
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true })
  }
  zip.extractAllTo(resDir, true)
  fs.renameSync(path.join(resDir, 'dist'), targetPath)

  if (platform !== 'win32') {
    try {
      const fixPermissions = (dir) => {
        const items = fs.readdirSync(dir, { withFileTypes: true })
        for (const item of items) {
          const fullPath = path.join(dir, item.name)
          if (item.isDirectory()) {
            fs.chmodSync(fullPath, 0o755)
            fixPermissions(fullPath)
          } else {
            fs.chmodSync(fullPath, 0o644)
          }
        }
      }
      fs.chmodSync(targetPath, 0o755)
      fixPermissions(targetPath)
      console.log(`[INFO]: sub-store-frontend permissions fixed`)
    } catch (error) {
      console.warn(`[WARN]: Failed to fix permissions: ${error.message}`)
    }
  }

  console.log(`[INFO]: sub-store-frontend finished`)
}
const resolveFont = async () => {
  // const targetPath = path.join(cwd, 'src', 'renderer', 'src', 'assets', 'NotoColorEmoji.ttf')
  const targetPath = path.join(cwd, 'src', 'renderer', 'src', 'assets', 'twemoji.ttf')

  if (fs.existsSync(targetPath)) {
    return
  }
  await downloadFile(
    // 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf',
    'https://github.com/Sav22999/emoji/raw/refs/heads/master/font/twemoji.ttf',
    targetPath
  )

  console.log(`[INFO]: twemoji.ttf finished`)
}

const tasks = [
  {
    name: 'mihomo-alpha',
    func: () => getLatestAlphaVersion().then(() => resolveSidecar(MihomoAlpha())),
    retry: 5
  },
  {
    name: 'mihomo',
    func: () => getLatestReleaseVersion().then(() => resolveSidecar(mihomo())),
    retry: 5
  },
  { name: 'mmdb', func: resolveMmdb, retry: 5 },
  { name: 'metadb', func: resolveMetadb, retry: 5 },
  { name: 'geosite', func: resolveGeosite, retry: 5 },
  { name: 'geoip', func: resolveGeoIP, retry: 5 },
  { name: 'asn', func: resolveASN, retry: 5 },
  {
    name: 'font',
    func: resolveFont,
    retry: 5
  },
  {
    name: 'enableLoopback',
    func: resolveEnableLoopback,
    retry: 5,
    winOnly: true
  },
  {
    name: 'perzike-service',
    func: resolvePerzikeService,
    retry: 5
  },
  {
    name: 'runner',
    func: resolveRunner,
    retry: 5,
    winOnly: true
  },
  {
    name: 'monitor',
    func: resolveMonitor,
    retry: 5,
    winOnly: true
  },
  {
    name: 'substore',
    func: resolveSubstore,
    retry: 5
  },
  {
    name: 'substorefrontend',
    func: resolveSubstoreFrontend,
    retry: 5
  },
  {
    name: '7zip',
    func: resolve7zip,
    retry: 5,
    winOnly: true
  }
]

async function runTask() {
  const task = tasks.shift()
  if (!task) return
  if (task.winOnly && platform !== 'win32') return runTask()
  if (task.linuxOnly && platform !== 'linux') return runTask()
  if (task.unixOnly && platform === 'win32') return runTask()

  for (let i = 0; i < task.retry; i++) {
    try {
      await task.func()
      break
    } catch (err) {
      console.error(`[ERROR]: task::${task.name} try ${i} ==`, err.message)
      if (i === task.retry - 1) throw err
    }
  }
  return runTask()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTask()
  runTask()
}
