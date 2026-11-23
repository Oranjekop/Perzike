# Perzike

<h3 align="center">Another <a href="https://github.com/MetaCubeX/mihomo">Mihomo</a> GUI</h3>

<p align="center">
  <a href="https://github.com/Oranjekop/Perzike/releases">
    <img alt="GitHub release" src="https://img.shields.io/github/v/release/Oranjekop/Perzike?include_prereleases">
  </a>
</p>

## 特性

- 内置稳定版和预览版 Mihomo 内核，支持规则代理、系统代理和 TUN。
- 支持订阅管理、Sub-Store 和配置覆写。
- 支持本地备份与 WebDAV 备份、恢复。
- 支持连接查看和流量统计。

## MCP 接入

在「应用设置 → MCP 接入」中开启服务，设置端口并输入或生成密钥，然后保存。点「复制接入配置」即可将配置摘要交给本机 Agent。服务仅监听本机，客户端使用 Streamable HTTP 连接 `http://127.0.0.1:17890/mcp`，端口以设置页显示为准。请求头使用 `Authorization: Bearer <接入密钥>`。系统安全存储不可用时，重启后复制配置需重新输入已保存的密钥。

- `get_status` 查看运行状态，`get_active_profile` 查看当前配置名称和 ID，`get_traffic_summary` 查看累计流量及活动连接数。
- `list_proxy_groups` 查看代理组及当前选择，传入 `group` 可分页查看该组节点及最近延迟。`select_proxy` 接收 `group` 和节点 `node`，持有密钥的客户端可直接切换。
- `diagnose_proxy` 汇总内核、节点测速和近期错误类别。`list_providers` 列出规则或代理提供者摘要，`get_traffic_trend` 查看小时、日或周的聚合趋势。趋势从启用新统计的版本开始积累。
- `restore_auto_proxy` 解除自动代理组的手动固定。`list_profiles` 列出已有配置。`switch_profile` 需单独开启，按 ID 切换已有配置并重载内核。
- `test_proxy_delay` 和 `test_group_delay` 需开启主动测速，使用 Perzike 的测速地址。组内测速每次最多五个候选节点。

可以关闭接入或更换密钥以撤销旧客户端权限。

## 开发

开发环境推荐 Node.js 22.13 或更新的 22.x 版本。pnpm 版本以 `package.json` 中的 `packageManager` 为准，当前为 10.15.0。

```bash
git clone https://github.com/Oranjekop/Perzike.git
cd Perzike
pnpm install
pnpm dev
```

`pnpm install` 会运行资源准备脚本，下载当前平台所需的内核和辅助组件。若启动时提示 Electron 未正确安装，可在项目根目录执行 `node node_modules/electron/install.js`。

| 命令                  | 用途                                                          |
| --------------------- | ------------------------------------------------------------- |
| `pnpm typecheck`      | 检查主进程和渲染进程的 TypeScript 类型                        |
| `pnpm test:uninstall` | 运行卸载回归测试，需要 Bash，Windows 额外检查 PowerShell 分支 |
| `pnpm lint`           | 检查并自动修复 ESLint 问题                                    |
| `pnpm format`         | 使用 Prettier 格式化代码                                      |
| `pnpm prepare`        | 重新准备内核和辅助资源                                        |

## 构建

在目标平台上运行对应命令，产物生成到 `dist/`。可在命令末尾指定 `--x64` 或 `--arm64`，并按需指定单一打包目标。

| 平台    | 命令示例                     | 发布产物                       |
| ------- | ---------------------------- | ------------------------------ |
| Windows | `pnpm build:win nsis --x64`  | `.exe` 安装包、`.7z` 便携版    |
| macOS   | `pnpm build:mac pkg --arm64` | `.pkg` 安装包                  |
| Linux   | `pnpm build:linux deb --x64` | `.deb`、`.rpm`、`.pkg.tar.zst` |

仓库的 GitHub Actions 在推送版本标签后构建并发布文件。Linux LoongArch 使用 CI 中的专用 Electron 和打包配置。

## 卸载

- **Windows 安装版**：从系统“已安装的应用”卸载，会先停止并删除系统服务。个人安装也可能需要管理员授权；取消授权或服务清理失败时会中止卸载。升级只停止服务，不删除服务注册。
- **Linux**：通过 apt/dpkg、rpm/dnf、pacman 或 AUR 卸载时，会清理服务注册、开机启动项、服务 socket 和 `/run/perzike` 下的服务运行副本。升级保留服务注册。
- **macOS**：先退出 Perzike，再运行随安装包发布的 `perzike-macos-<版本>-<架构>-uninstall.command`。也可以执行应用内的卸载脚本：

```bash
sudo /bin/sh "/Applications/Perzike.app/Contents/Resources/perzike-uninstall.command"
```

macOS 卸载脚本会清理当前服务和旧版 helper，核验应用标识后删除 `Perzike.app`，保留用户配置。安装在其他位置时，可把应用的绝对路径作为独立脚本的第一个参数。直接将应用拖入废纸篓不会触发服务卸载；如果已删除应用，可运行随包发布的独立脚本清理残留服务。

Windows 便携版删除目录前，如果安装过服务，请先在应用的服务管理中卸载服务。

## 致谢

Perzike 基于 [xishang0128](https://github.com/xishang0128) 的桌面客户端 [Sparkle](https://github.com/xishang0128/sparkle) 及相关服务继续开发，感谢原开发者。
