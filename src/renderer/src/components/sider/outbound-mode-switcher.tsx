/* eslint-disable react/prop-types */
import { Tabs, Tab } from '@renderer/components/ui'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useGroups } from '@renderer/hooks/use-groups'
import { mihomoCloseConnections, patchMihomoConfig } from '@renderer/utils/ipc'
import { Key } from 'react'

interface Props {
  iconOnly?: boolean
}

const OutboundModeSwitcher: React.FC<Props> = (props) => {
  const { iconOnly } = props
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { mutate: mutateGroups } = useGroups()
  const { appConfig } = useAppConfig()
  const { autoCloseConnection = true } = appConfig || {}
  const { mode } = controledMihomoConfig || {}

  const onChangeMode = async (mode: OutboundMode): Promise<void> => {
    await patchControledMihomoConfig({ mode })
    await patchMihomoConfig({ mode })
    if (autoCloseConnection) {
      await mihomoCloseConnections()
    }
    mutateGroups()
    window.electron.ipcRenderer.send('updateTrayMenu')
  }
  if (!mode) return null
  if (iconOnly) {
    return (
      <Tabs
        aria-label="代理模式"
        className="app-sidebar-compact-modes"
        color="primary"
        selectedKey={mode}
        classNames={{
          tabList: 'bg-content1 shadow-medium outbound-mode-card flex-col'
        }}
        onSelectionChange={(key: Key) => onChangeMode(key as OutboundMode)}
      >
        {[
          { key: 'rule', letter: 'R', label: '规则' },
          { key: 'global', letter: 'G', label: '全局' },
          { key: 'direct', letter: 'D', label: '直连' }
        ].map((item) => (
          <Tab
            className={mode === item.key ? 'font-bold' : ''}
            key={item.key}
            title={
              <span className="flex items-center gap-2">
                <span>{item.letter}</span>
                <span className="app-sidebar-nav-label">{item.label}</span>
              </span>
            }
            aria-label={item.label}
            textValue={item.label}
          />
        ))}
      </Tabs>
    )
  }
  return (
    <Tabs
      fullWidth
      color="primary"
      selectedKey={mode}
      classNames={{
        tabList: 'bg-content1 shadow-medium outbound-mode-card'
      }}
      onSelectionChange={(key: Key) => onChangeMode(key as OutboundMode)}
    >
      <Tab className={`${mode === 'rule' ? 'font-bold' : ''}`} key="rule" title="规则" />
      <Tab className={`${mode === 'global' ? 'font-bold' : ''}`} key="global" title="全局" />
      <Tab className={`${mode === 'direct' ? 'font-bold' : ''}`} key="direct" title="直连" />
    </Tabs>
  )
}

export default OutboundModeSwitcher
