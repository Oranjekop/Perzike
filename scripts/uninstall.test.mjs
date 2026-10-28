/* eslint @typescript-eslint/explicit-function-return-type: "off" */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { parse } from 'yaml'
import createUninstallArtifacts from './uninstall-artifact.cjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const bash =
  process.env.BASH || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash')
const linuxSource = await readFile(path.join(root, 'build/linux/uninstall-service.sh'), 'utf8')
const macSource = await readFile(path.join(root, 'build/macos/perzike-uninstall.command'), 'utf8')
const prermSource = await readFile(path.join(root, 'build/linux/prerm'), 'utf8')
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`

async function fixture(t) {
  const base = path.join(root, 'out/uninstall-tests')
  await mkdir(base, { recursive: true })
  const dir = await mkdtemp(path.join(base, 'case-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

async function shell(t, source, args = []) {
  const dir = await fixture(t)
  const script = path.join(dir, 'test.sh')
  await writeFile(script, source)
  return spawnSync(bash, ['--posix', script.replaceAll('\\', '/'), ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000
  })
}

async function linux(t, overrides = '', env = {}) {
  const dir = await fixture(t)
  const script = path.join(dir, 'test.sh')
  const log = path.join(dir, 'commands')
  const shellDir = dir
    .replaceAll('\\', '/')
    .replace(/^([a-z]):/i, (_, drive) => `/${drive.toLowerCase()}`)
  const source = linuxSource.replace(/\nremove_perzike_service\s*$/, '')
  await writeFile(log, '')
  await writeFile(
    script,
    `${source}
SERVICE_BINARY=${quote(`${shellDir}/missing-service`)}
UNIT_FILE=${quote(`${shellDir}/PerzikeService.service`)}
INIT_FILE=${quote(`${shellDir}/init`)}
UPSTART_FILE=${quote(`${shellDir}/upstart`)}
RUNTIME_DIR=${quote(`${shellDir}/runtime`)}
SYSTEMD_DIR=${quote(shellDir)}
TEST_LOG=${quote(log.replaceAll('\\', '/'))}
systemctl() {
    printf 'systemctl %s\\n' "$*" >> "$TEST_LOG"
    case "$1" in
        show) printf '%s\\n' "\${LOAD_STATE:-loaded}"; return "\${SHOW_CODE:-0}" ;;
        stop) return "\${STOP_CODE:-0}" ;;
        disable) return "\${DISABLE_CODE:-0}" ;;
    esac
}
rm() { printf 'remove %s\\n' "$*" >> "$TEST_LOG"; }
rmdir() { :; }
service_pid() { return 1; }
${overrides}
remove_perzike_service
`
  )
  const result = spawnSync(bash, ['--posix', script.replaceAll('\\', '/')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, ...env }
  })
  return { ...result, log: await readFile(log, 'utf8') }
}

test('packaged shell entry points have valid shell syntax', () => {
  for (const file of [
    'build/linux/prerm',
    'build/linux/uninstall-service.sh',
    'build/macos/perzike-uninstall.command',
    'build/pkg-scripts/postinstall'
  ]) {
    const result = spawnSync(bash, ['--posix', '-n', path.join(root, file).replaceAll('\\', '/')], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10000
    })
    assert.equal(result.status, 0, `${file}: ${result.stderr}`)
  }
})

test(
  'Windows cleanup handles stopped services, upgrades, and denied elevation',
  { skip: process.platform !== 'win32' },
  () => {
    const result = spawnSync(
      path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(root, 'scripts/test-uninstall.ps1')
      ],
      { cwd: root, encoding: 'utf8', timeout: 15000 }
    )
    assert.equal(result.status, 0, result.stderr || result.stdout)
  }
)

test('Linux stops and disables service before deleting registration, then reloads systemd', async (t) => {
  const result = await linux(t)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.log, /systemctl stop PerzikeService\.service/)
  assert.match(result.log, /systemctl disable PerzikeService\.service/)
  assert.ok(result.log.indexOf('systemctl stop') < result.log.indexOf('remove '))
  assert.ok(result.log.indexOf('remove ') < result.log.indexOf('systemctl daemon-reload'))
})

test('Linux refuses file deletion after a failed service stop', async (t) => {
  const result = await linux(t, '', { STOP_CODE: '1' })
  assert.notEqual(result.status, 0)
  assert.doesNotMatch(result.log, /remove |daemon-reload|disable/)
})

test('Linux refuses file deletion after a failed startup deregistration', async (t) => {
  const result = await linux(t, '', { DISABLE_CODE: '1' })
  assert.notEqual(result.status, 0)
  assert.doesNotMatch(result.log, /remove |daemon-reload/)
})

test('Linux tolerates an absent service, but propagates a manager query failure', async (t) => {
  const missing = await linux(t, '', { LOAD_STATE: 'not-found', SHOW_CODE: '1' })
  assert.equal(missing.status, 0, missing.stderr)
  assert.doesNotMatch(missing.log, /systemctl stop|systemctl disable/)
  const denied = await linux(t, '', { LOAD_STATE: '', SHOW_CODE: '1' })
  assert.notEqual(denied.status, 0)
  assert.doesNotMatch(denied.log, /remove /)
})

test('Linux handles stopped SysV services and refuses an unverified stop failure', async (t) => {
  const init = `
SYSTEMD_DIR="$RUNTIME_DIR/missing"
cat > "$INIT_FILE" <<'INIT'
#!/bin/sh
case "$1" in
    stop) exit "\${INIT_STOP_CODE:-0}" ;;
    status) exit "\${INIT_STATUS_CODE:-3}" ;;
esac
INIT
chmod +x "$INIT_FILE"
`
  const stopped = await linux(t, init, { INIT_STOP_CODE: '1', INIT_STATUS_CODE: '3' })
  assert.equal(stopped.status, 0, stopped.stderr)
  assert.match(stopped.log, /remove /)
  const denied = await linux(t, init, { INIT_STOP_CODE: '1', INIT_STATUS_CODE: '1' })
  assert.notEqual(denied.status, 0)
  assert.doesNotMatch(denied.log, /remove /)
})

test('Linux handles stopped OpenRC services without hiding a failed stop', async (t) => {
  const openrc = `
SYSTEMD_DIR="$RUNTIME_DIR/missing"
touch "$INIT_FILE"
mkdir -p "$RUNTIME_DIR/bin"
cat > "$RUNTIME_DIR/bin/rc-service" <<'RC'
#!/bin/sh
case "$2" in
    stop) exit 1 ;;
    status) echo "\${RC_STATE:-status: stopped}"; exit 3 ;;
esac
RC
chmod +x "$RUNTIME_DIR/bin/rc-service"
PATH="$RUNTIME_DIR/bin:$PATH"
export PATH
`
  const stopped = await linux(t, openrc)
  assert.equal(stopped.status, 0, stopped.stderr)
  assert.match(stopped.log, /remove /)
  const failed = await linux(t, openrc, { RC_STATE: 'could not query service' })
  assert.notEqual(failed.status, 0)
  assert.doesNotMatch(failed.log, /remove /)
  const running = await linux(t, openrc, { RC_STATE: 'not stopped' })
  assert.notEqual(running.status, 0)
  assert.doesNotMatch(running.log, /remove /)
})

test('Linux ignores recycled or invalid PIDs instead of killing another process', async (t) => {
  const result = await shell(
    t,
    `${linuxSource.replace(/\nremove_perzike_service\s*$/, '')}
readlink() { echo /usr/bin/unrelated; }
kill() { echo 'unexpected kill' >&2; return 1; }
for pid in '' 0 1 abc '12;id' 1234; do
    if is_service_pid "$pid"; then exit 1; fi
done
`
  )
  assert.equal(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stderr, /unexpected kill/)
})

test('Linux package hooks run on removal and skip upgrades for all three formats', async (t) => {
  const probe = prermSource.slice(0, prermSource.indexOf('\nCLEANUP=')) + '\necho cleanup\n'
  for (const arg of ['remove', '0', '', '1.26.19-1', '10.26.19-1', '1:1.26.19-1']) {
    const result = await shell(t, probe, [arg])
    assert.equal(result.status, 0, `${arg}: ${result.stderr}`)
    assert.match(result.stdout, /cleanup/, arg)
  }
  for (const arg of ['upgrade', 'failed-upgrade', 'deconfigure', '1', '2', '100']) {
    const result = await shell(t, probe, [arg])
    assert.equal(result.status, 0, `${arg}: ${result.stderr}`)
    assert.doesNotMatch(result.stdout, /cleanup/, arg)
  }
})

test('macOS removes launchd registration only after the loaded job is gone', async (t) => {
  const cleanup = macSource.match(/remove_launchd_service\(\) \{[\s\S]*?\n\}/)?.[0]
  assert.ok(cleanup)
  for (const state of ['loaded', 'missing', 'blocked', 'concurrent']) {
    const result = await shell(
      t,
      `set -e
${cleanup}
prints=0
launchctl() {
    echo "launchctl $*"
    if [ "$1" = print ]; then
        prints=$((prints + 1))
        case ${quote(state)} in
            missing) return 1 ;;
            concurrent) [ "$prints" -eq 1 ]; return ;;
            *) return 0 ;;
        esac
    fi
    case ${quote(state)} in blocked|concurrent) return 1 ;; esac
}
rm() { echo "remove $*"; }
remove_launchd_service PerzikeService
`
    )
    if (state === 'blocked') {
      assert.notEqual(result.status, 0)
      assert.doesNotMatch(result.stdout, /remove /)
    } else {
      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /remove -f \/Library\/LaunchDaemons\/PerzikeService\.plist/)
    }
  }
})

test('all packages include cleanup entry points and AUR only cleans on removal', async () => {
  const config = parse(await readFile(path.join(root, 'electron-builder.yml'), 'utf8'))
  for (const target of ['deb', 'rpm', 'pacman']) {
    assert.ok(config[target].fpm.includes('--before-remove'), target)
    assert.ok(config[target].fpm.includes('build/linux/prerm'), target)
  }
  assert.ok(config.linux.extraResources.some((file) => file.to === 'files/uninstall-service.sh'))
  assert.ok(config.mac.extraResources.some((file) => file.to === 'perzike-uninstall.command'))
  for (const name of [
    'perzike',
    'perzike-bin',
    'perzike-git',
    'perzike-electron',
    'perzike-electron-bin',
    'perzike-electron-git'
  ]) {
    const install = await readFile(path.join(root, 'aur', name, 'perzike.install'), 'utf8')
    assert.match(install, /pre_remove\(\)/, name)
    assert.doesNotMatch(install, /pre_upgrade\(\)/, name)
  }
})

test('macOS builds publish a standalone uninstaller for each architecture', async (t) => {
  const dir = await fixture(t)
  const artifactPaths = [
    path.join(dir, 'perzike-macos-1.26.19-x64.pkg'),
    path.join(dir, 'perzike-macos-1.26.19-arm64.pkg'),
    path.join(dir, 'perzike-linux-1.26.19-x64.pkg.tar.zst'),
    path.join(dir, 'perzike-windows-1.26.19-x64-setup.exe')
  ]
  const generated = await createUninstallArtifacts({ artifactPaths })
  assert.equal(generated.length, 2)
  for (const artifact of generated) {
    assert.equal(await readFile(artifact, 'utf8'), macSource)
  }
})
