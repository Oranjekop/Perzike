import { resolveMonitor } from './prepare.mjs'

if (process.env.SKIP_MONITOR_PREPARE !== '1') {
  await resolveMonitor(process.env.npm_config_arch || process.arch)
}
