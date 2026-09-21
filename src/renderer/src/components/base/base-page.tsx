import { Button, Divider } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { isAlwaysOnTop, setAlwaysOnTop } from '@renderer/utils/ipc'
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { RiPushpin2Fill, RiPushpin2Line } from 'react-icons/ri'
interface Props {
  title?: React.ReactNode
  header?: React.ReactNode
  children?: React.ReactNode
  contentClassName?: string
}
let saveOnTop = false

const BasePage = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { appConfig } = useAppConfig()
  const { useWindowFrame = false, disableAnimation = false } = appConfig || {}
  const [overlayWidth, setOverlayWidth] = React.useState(0)
  const [onTop, setOnTop] = useState(saveOnTop)

  const updateAlwaysOnTop = async (): Promise<void> => {
    setOnTop(await isAlwaysOnTop())
    saveOnTop = await isAlwaysOnTop()
  }

  useEffect(() => {
    if (platform !== 'darwin' && !useWindowFrame) {
      try {
        // @ts-ignore windowControlsOverlay
        const windowControlsOverlay = window.navigator.windowControlsOverlay
        setOverlayWidth(window.innerWidth - windowControlsOverlay.getTitlebarAreaRect().width)
      } catch (e) {
        // ignore
      }
    }
  }, [])

  const contentRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => {
    return contentRef.current as HTMLDivElement
  })

  return (
    <div ref={contentRef} className="app-page w-full h-full">
      <div
        className={`app-page-header sticky top-0 z-40 h-14 w-full ${disableAnimation ? 'bg-background/95 backdrop-blur-sm' : 'bg-transparent backdrop-blur'}`}
      >
        <div className="app-drag px-4 flex justify-between h-[calc(100%-1px)] items-center">
          <div className="title app-page-title h-full flex items-center">{props.title}</div>
          <div style={{ marginRight: overlayWidth }} className="header flex gap-1 h-full items-center">
            {props.header}
            <Button
              size="sm"
              className="app-nodrag"
              isIconOnly
              title="窗口置顶"
              variant="light"
              color={onTop ? 'primary' : 'default'}
              onPress={async () => {
                await setAlwaysOnTop(!onTop)
                await updateAlwaysOnTop()
              }}
              startContent={
                onTop ? (
                  <RiPushpin2Fill className="text-lg" />
                ) : (
                  <RiPushpin2Line className="text-lg" />
                )
              }
            />
          </div>
        </div>

        <Divider />
      </div>
      <div
        className={`content app-page-content h-[calc(100vh-56px)] overflow-y-auto custom-scrollbar ${props.contentClassName ?? ''}`}
      >
        {props.children}
      </div>
    </div>
  )
})

BasePage.displayName = 'BasePage'
export default BasePage
