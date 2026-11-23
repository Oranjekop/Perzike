import { useState } from 'react'
import useSWR from 'swr'
import { Button, Input, Switch } from '@renderer/components/ui'
import { copyMcpConfig, getMcpSettings, saveMcpSettings } from '@renderer/utils/ipc'
import { notify } from '@renderer/utils/notification'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'

function McpConfigForm({
  initial,
  onSaved
}: {
  initial: McpSettings
  onSaved: (settings: McpSettings) => void
}): React.JSX.Element {
  const [settings, setSettings] = useState(initial)
  const [enabled, setEnabled] = useState(initial.enabled)
  const [port, setPort] = useState(String(initial.port))
  const [allowDelayTest, setAllowDelayTest] = useState(initial.allowDelayTest)
  const [allowProfileSwitch, setAllowProfileSwitch] = useState(initial.allowProfileSwitch)
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(): Promise<void> {
    setSaving(true)
    try {
      const saved = await saveMcpSettings({
        enabled,
        port: Number(port),
        allowDelayTest,
        allowProfileSwitch,
        key: key || undefined
      })
      setSettings(saved)
      onSaved(saved)
      setKey('')
      notify('MCP 设置已保存', { variant: 'success' })
    } catch (error) {
      notify(error, { variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SettingItem title="允许本机 MCP 接入" divider>
        <Switch size="sm" isSelected={enabled} onValueChange={setEnabled} isDisabled={saving} />
      </SettingItem>
      <SettingItem title="端口" divider>
        <Input
          size="sm"
          className="w-28"
          aria-label="MCP 端口"
          type="number"
          min={1024}
          max={65535}
          value={port}
          onValueChange={setPort}
          isDisabled={saving}
        />
      </SettingItem>
      <SettingItem title="接入密钥" divider>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <Input
            size="sm"
            className="w-44 max-w-full"
            aria-label="MCP 接入密钥"
            type="password"
            autoComplete="off"
            maxLength={128}
            placeholder={settings.hasKey ? '已设置，留空保留' : '输入或生成密钥'}
            value={key}
            onValueChange={setKey}
            isDisabled={saving}
          />
          <Button
            size="sm"
            color="primary"
            variant="flat"
            isDisabled={saving}
            onPress={() => {
              const bytes = crypto.getRandomValues(new Uint8Array(32))
              setKey(Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''))
            }}
          >
            生成
          </Button>
        </div>
      </SettingItem>
      <SettingItem title="允许主动测速" divider>
        <Switch
          size="sm"
          isSelected={allowDelayTest}
          onValueChange={setAllowDelayTest}
          isDisabled={saving}
        />
      </SettingItem>
      <SettingItem title="允许切换订阅配置" divider>
        <Switch
          size="sm"
          isSelected={allowProfileSwitch}
          onValueChange={setAllowProfileSwitch}
          isDisabled={saving}
        />
      </SettingItem>
      <SettingItem title={settings.running ? '接入地址' : '服务状态'}>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <span className="min-w-0 break-all text-right text-sm">
            {settings.running
              ? `http://127.0.0.1:${settings.port}/mcp`
              : settings.enabled
                ? '启动失败'
                : '已关闭'}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {settings.running && (
              <Button
                size="sm"
                color="primary"
                variant="flat"
                isDisabled={saving}
                onPress={async () => {
                  try {
                    await copyMcpConfig(key || undefined)
                    notify('接入配置已复制', { variant: 'success' })
                  } catch (error) {
                    notify(error, { variant: 'danger' })
                  }
                }}
              >
                复制接入配置
              </Button>
            )}
            <Button size="sm" color="primary" isLoading={saving} onPress={save}>
              保存
            </Button>
          </div>
        </div>
      </SettingItem>
    </>
  )
}

export default function McpConfig(): React.JSX.Element {
  const { data, error, mutate } = useSWR('mcpSettings', getMcpSettings, {
    revalidateOnFocus: false
  })
  return (
    <SettingCard title="MCP 接入">
      {data ? (
        <McpConfigForm
          initial={data}
          onSaved={(settings) => {
            void mutate(settings, false)
          }}
        />
      ) : (
        <SettingItem title={error ? '无法读取 MCP 设置' : '正在读取 MCP 设置'} />
      )}
    </SettingCard>
  )
}
