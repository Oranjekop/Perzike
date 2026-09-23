import React from 'react'
import { cn, Switch, SwitchProps } from '@renderer/components/ui'
import './border-switch.css'

interface SiderSwitchProps extends SwitchProps {
  isShowBorder?: boolean
}

const BorderSwitch: React.FC<SiderSwitchProps> = (props) => {
  const { isShowBorder = false, classNames, ...switchProps } = props

  return (
    <Switch
      className="border-switch px-2"
      classNames={{
        wrapper: cn('border-2', {
          'border-transparent': !isShowBorder,
          'border-primary-foreground': isShowBorder
        }),
        ...classNames
      }}
      size="sm"
      {...switchProps}
    />
  )
}

export default BorderSwitch
