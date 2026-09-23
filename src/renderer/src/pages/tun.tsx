import { Button, Input, Switch, Tab, Tabs } from '@renderer/components/ui'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import EditableList from '@renderer/components/base/base-list-editor'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { mihomoVersion, restartCore, setupFirewall } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import React, { Key, useEffect, useState } from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { notify } from '@renderer/utils/notification'
import PubSub from 'pubsub-js'
import useSWR from 'swr'

const supportsMipsStack = (version?: string): boolean => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:$|[-+])/i.exec(version ?? '')
  if (!match) return false
  const [major, minor, patch] = match.slice(1).map(Number)
  return major > 1 || (major === 1 && (minor > 19 || (minor === 19 && patch >= 31)))
}

const Tun: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { data: coreVersion, mutate: refreshCoreVersion } = useSWR('mihomoVersion', mihomoVersion)
  const mipsSupported = supportsMipsStack(coreVersion?.version)
  const { autoSetDNSMode = 'exec' } = appConfig || {}
  const { tun } = controledMihomoConfig || {}
  const [loading, setLoading] = useState(false)
  const {
    device = platform === 'darwin' ? undefined : 'mihomo',
    stack = 'mixed',
    'auto-route': autoRoute = true,
    'auto-redirect': autoRedirect = false,
    'auto-detect-interface': autoDetectInterface = true,
    'dns-hijack': dnsHijack = ['any:53'],
    'route-exclude-address': routeExcludeAddress = [],
    'strict-route': strictRoute = false,
    'disable-icmp-forwarding': disableIcmpForwarding = false,
    mtu = 1500
  } = tun || {}
  const [changed, setChanged] = useState(false)
  useEffect(() => {
    const token = PubSub.subscribe('mihomo-core-changed', () => {
      void refreshCoreVersion()
    })
    const unsubscribeCoreStarted = window.electron.ipcRenderer.on('core-started', () => {
      void refreshCoreVersion()
    })
    return () => {
      PubSub.unsubscribe(token)
      unsubscribeCoreStarted()
    }
  }, [refreshCoreVersion])
  const [values, originSetValues] = useState({
    device,
    stack,
    autoRoute,
    autoRedirect,
    autoDetectInterface,
    dnsHijack,
    strictRoute,
    routeExcludeAddress,
    disableIcmpForwarding,
    mtu: Math.min(Math.max(mtu || 1500, 1), 65535)
  })
  const setValues = (v: typeof values): void => {
    originSetValues(v)
    setChanged(true)
  }

  const onSave = async (patch: Partial<MihomoConfig>): Promise<void> => {
    if (values.stack === 'mips' && !mipsSupported) {
      notify('当前内核不支持 MIPS 堆栈（需要 Mihomo v1.19.31 或更新版本）', {
        variant: 'danger'
      })
      return
    }
    await patchControledMihomoConfig(patch)
    await restartCore()
    setChanged(false)
  }

  return (
    <>
      <BasePage
        title="虚拟网卡设置"
        header={
          changed && (
            <Button
              size="sm"
              className="app-nodrag"
              color="primary"
              onPress={() =>
                onSave({
                  tun: {
                    device: values.device,
                    stack: values.stack,
                    'auto-route': values.autoRoute,
                    'auto-redirect': values.autoRedirect,
                    'auto-detect-interface': values.autoDetectInterface,
                    'dns-hijack': values.dnsHijack,
                    'strict-route': values.strictRoute,
                    'route-exclude-address': values.routeExcludeAddress,
                    'disable-icmp-forwarding': values.disableIcmpForwarding,
                    mtu: values.mtu
                  }
                })
              }
            >
              保存
            </Button>
          )
        }
      >
        <SettingCard className="tun-settings">
          {platform === 'win32' && (
            <SettingItem title="重设防火墙" divider>
              <Button
                size="sm"
                color="primary"
                isLoading={loading}
                onPress={async () => {
                  setLoading(true)
                  try {
                    await setupFirewall()
                    notify('防火墙重设成功', { variant: 'success' })
                    await restartCore()
                  } catch (e) {
                    notify(e, { variant: 'danger' })
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                重设防火墙
              </Button>
            </SettingItem>
          )}
          {platform === 'darwin' && (
            <SettingItem title="自动设置系统 DNS" divider>
              <Tabs
                size="sm"
                color="primary"
                selectedKey={autoSetDNSMode}
                classNames={{
                  cursor: 'bg-primary',
                  tabContent: 'group-data-[selected=true]:text-primary-foreground'
                }}
                onSelectionChange={async (key: Key) => {
                  await patchAppConfig({ autoSetDNSMode: key as 'none' | 'exec' | 'service' })
                }}
              >
                <Tab key="none" title="不自动设置" />
                <Tab key="exec" title="执行命令" />
                <Tab key="service" title="服务模式" />
              </Tabs>
            </SettingItem>
          )}
          <SettingItem
            title="Tun 模式堆栈"
            actions={
              !mipsSupported && (
                <span className="ml-2 text-xs text-default-400">MIPS 需 v1.19.31+</span>
              )
            }
            divider
          >
            <Tabs
              size="sm"
              color="primary"
              selectedKey={values.stack}
              classNames={{
                cursor: 'bg-primary',
                tabContent: 'group-data-[selected=true]:text-primary-foreground'
              }}
              onSelectionChange={(key: Key) => {
                if (key === 'mips' && !mipsSupported) return
                setValues({ ...values, stack: key as TunStack })
              }}
            >
              <Tab key="gvisor" title="gVisor" />
              <Tab key="mixed" title="Mixed" />
              <Tab key="system" title="System" />
              <Tab key="mips" title="MIPS" isDisabled={!mipsSupported} />
            </Tabs>
          </SettingItem>
          {platform !== 'darwin' && (
            <>
              <SettingItem title="Tun 网卡名称" divider>
                <Input
                  size="sm"
                  className="w-25"
                  value={values.device}
                  onValueChange={(v) => {
                    setValues({ ...values, device: v })
                  }}
                />
              </SettingItem>
              <SettingItem title="严格路由" divider>
                <Switch
                  size="sm"
                  isSelected={values.strictRoute}
                  onValueChange={(v) => {
                    setValues({ ...values, strictRoute: v })
                  }}
                />
              </SettingItem>
            </>
          )}
          <SettingItem title="自动设置路由规则" divider>
            <Switch
              size="sm"
              isSelected={values.autoRoute}
              onValueChange={(v) => {
                setValues({ ...values, autoRoute: v })
              }}
            />
          </SettingItem>
          {platform === 'linux' && (
            <SettingItem title="自动设置TCP重定向" divider>
              <Switch
                size="sm"
                isSelected={values.autoRedirect}
                onValueChange={(v) => {
                  setValues({ ...values, autoRedirect: v })
                }}
              />
            </SettingItem>
          )}
          <SettingItem title="自动选择流量出口" divider>
            <Switch
              size="sm"
              isSelected={values.autoDetectInterface}
              onValueChange={(v) => {
                setValues({ ...values, autoDetectInterface: v })
              }}
            />
          </SettingItem>
          <SettingItem title="ICMP 转发" divider>
            <Switch
              size="sm"
              isSelected={!values.disableIcmpForwarding}
              onValueChange={(v) => {
                setValues({ ...values, disableIcmpForwarding: !v })
              }}
            />
          </SettingItem>
          <SettingItem title="MTU" divider>
            <Input
              size="sm"
              type="number"
              className="w-25"
              value={values.mtu.toString()}
              min={1}
              onValueChange={(v) => {
                setValues({
                  ...values,
                  mtu: Math.min(Math.max(parseInt(v) || 1500, 1), 65535)
                })
              }}
            />
          </SettingItem>
          <SettingItem title="DNS 劫持，使用逗号分割多个值" divider>
            <Input
              size="sm"
              className="w-[50%]"
              value={values.dnsHijack.join(',')}
              onValueChange={(v) => {
                const arr = v !== '' ? v.split(',') : []
                setValues({ ...values, dnsHijack: arr })
              }}
            />
          </SettingItem>
          <EditableList
            title="排除自定义网段"
            items={values.routeExcludeAddress}
            placeholder="例: 172.20.0.0/16"
            onChange={(list) => setValues({ ...values, routeExcludeAddress: list as string[] })}
            divider={false}
          />
        </SettingCard>
      </BasePage>
    </>
  )
}

export default Tun
