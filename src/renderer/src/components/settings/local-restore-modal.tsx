import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@renderer/components/ui/heroui'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { localDelete, localRestore, relaunchApp } from '@renderer/utils/ipc'
import React, { useState } from 'react'
import { MdDeleteForever } from 'react-icons/md'
import { notify } from '@renderer/utils/notification'

interface Props {
  backupDir: string
  filenames: string[]
  onClose: () => void
}

const LocalRestoreModal: React.FC<Props> = ({ backupDir, filenames: names, onClose }) => {
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [filenames, setFilenames] = useState<string[]>(names)
  const [restoring, setRestoring] = useState(false)
  const [deletingFile, setDeletingFile] = useState<string | null>(null)

  const isOperating = restoring || deletingFile !== null

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={{ backdrop: 'top-[48px]' }}
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex app-drag">恢复本地备份</ModalHeader>
        <ModalBody>
          {filenames.length === 0 ? (
            <div className="flex justify-center">所选目录中没有备份文件</div>
          ) : (
            filenames.map((filename) => (
              <div className="flex" key={filename}>
                <Button
                  size="sm"
                  fullWidth
                  isLoading={restoring}
                  isDisabled={isOperating}
                  variant="flat"
                  onPress={async () => {
                    setRestoring(true)
                    try {
                      await localRestore(backupDir, filename)
                      await relaunchApp()
                    } catch (e) {
                      notify('恢复失败', { body: `${e}`, variant: 'danger' })
                      setRestoring(false)
                    }
                  }}
                >
                  {filename}
                </Button>
                <Button
                  size="sm"
                  color="warning"
                  variant="flat"
                  className="ml-2"
                  isLoading={deletingFile === filename}
                  isDisabled={isOperating}
                  onPress={async () => {
                    setDeletingFile(filename)
                    try {
                      await localDelete(backupDir, filename)
                      setFilenames((prev) => prev.filter((name) => name !== filename))
                      notify('删除成功', {
                        body: `已删除备份文件：${filename}`,
                        variant: 'success'
                      })
                    } catch (e) {
                      notify('删除失败', { body: `${e}`, variant: 'danger' })
                    } finally {
                      setDeletingFile(null)
                    }
                  }}
                >
                  <MdDeleteForever className="text-lg" />
                </Button>
              </div>
            ))
          )}
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="light" onPress={onClose} isDisabled={isOperating}>
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default LocalRestoreModal
