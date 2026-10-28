const { copyFile, chmod } = require('node:fs/promises')
const path = require('node:path')

module.exports = async ({ artifactPaths }) => {
  const result = []
  for (const artifact of artifactPaths) {
    if (!/^perzike-macos-.*\.pkg$/.test(path.basename(artifact))) continue

    const uninstaller = artifact.replace(/\.pkg$/, '-uninstall.command')
    await copyFile(path.join(__dirname, '../build/macos/perzike-uninstall.command'), uninstaller)
    await chmod(uninstaller, 0o755)
    result.push(uninstaller)
  }
  return result
}
