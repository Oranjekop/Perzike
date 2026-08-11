import {
  Button,
  Card,
  CardBody,
  Divider,
  Tab,
  Tabs,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner
} from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { calcTraffic } from '@renderer/utils/calc'
import { clearTrafficStats, getTrafficStats, getTrafficStatsDetail } from '@renderer/utils/ipc'
import { notify } from '@renderer/utils/notification'
import dayjs from 'dayjs'
import React, { Key, useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  IoCalendarOutline,
  IoChevronForward,
  IoRefresh,
  IoStatsChartOutline,
  IoTrashOutline
} from 'react-icons/io5'

const periods: Array<{ key: TrafficStatsPeriod; label: string }> = [
  { key: 'today', label: '今日' },
  { key: 'month', label: '本月' },
  { key: 'lastMonth', label: '上月' }
]

const groupings: Array<{ key: TrafficStatsGroupBy; label: string }> = [
  { key: 'host', label: '主机名' },
  { key: 'strategy', label: '策略' },
  { key: 'interface', label: '网络接口' }
]

const groupLabels: Record<TrafficStatsGroupBy, string> = {
  host: '主机名',
  strategy: '策略',
  interface: '网络接口'
}

const formatDate = (value: string): string => {
  const date = dayjs(value)
  if (!date.isValid()) return value
  return date.format('MM-DD')
}

const formatUpdatedAt = (value?: string): string => {
  if (!value) return '尚未同步'
  const date = dayjs(value)
  return date.isValid() ? `更新于 ${date.format('HH:mm:ss')}` : '尚未同步'
}

interface SummaryMetricProps {
  label: string
  value: string
  tone?: 'default' | 'up' | 'down'
}

const SummaryMetric: React.FC<SummaryMetricProps> = ({ label, value, tone = 'default' }) => (
  <div className="min-w-0">
    <div className="text-xs text-foreground-500">{label}</div>
    <div
      className={`mt-1 truncate text-lg font-semibold ${
        tone === 'up' ? 'text-primary' : tone === 'down' ? 'text-secondary' : 'text-foreground'
      }`}
    >
      {value}
    </div>
  </div>
)

const TrafficStats: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { disableAnimation = false } = appConfig || {}
  const [period, setPeriod] = useState<TrafficStatsPeriod>('today')
  const [groupBy, setGroupBy] = useState<TrafficStatsGroupBy>('host')
  const [selectedKey, setSelectedKey] = useState<string>()
  const [clearing, setClearing] = useState(false)

  const { data, error, isLoading, mutate } = useSWR<TrafficStatsResult>(
    ['trafficStats', period, groupBy],
    () => getTrafficStats(period, groupBy),
    { refreshInterval: 5000, revalidateOnFocus: false }
  )
  const { data: detail, isLoading: detailLoading } = useSWR<TrafficStatsDetailResult>(
    selectedKey ? ['trafficStatsDetail', period, groupBy, selectedKey] : null,
    () => getTrafficStatsDetail(period, groupBy, selectedKey as string),
    { refreshInterval: 5000, revalidateOnFocus: false }
  )

  const maxDailyTotal = useMemo(
    () => Math.max(...(data?.daily.map((item) => item.total) || [0]), 1),
    [data?.daily]
  )
  const daily = useMemo(() => data?.daily.slice(-31) || [], [data?.daily])

  const handleClear = async (): Promise<void> => {
    if (clearing || !window.confirm('确定清空已保存的流量历史吗？此操作不可撤销。')) return

    try {
      setClearing(true)
      await clearTrafficStats()
      setSelectedKey(undefined)
      await mutate()
      notify('流量历史已清空', { variant: 'success' })
    } catch (clearError) {
      notify(clearError, { variant: 'danger' })
    } finally {
      setClearing(false)
    }
  }

  return (
    <BasePage
      title="流量统计"
      header={
        <>
          <Button
            size="sm"
            isIconOnly
            variant="light"
            title="刷新统计"
            onPress={() => void mutate()}
          >
            <IoRefresh className="text-lg" />
          </Button>
          <Button
            size="sm"
            isIconOnly
            variant="light"
            color="danger"
            title="清空历史"
            isLoading={clearing}
            onPress={() => void handleClear()}
          >
            <IoTrashOutline className="text-lg" />
          </Button>
        </>
      }
    >
      <div className="flex w-full flex-col gap-2 p-2">
        <Card fullWidth className="border border-default-200/70 bg-content1">
          <CardBody className="gap-3 p-3 md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <IoCalendarOutline className="text-primary" />
                  时间段
                </div>
                <p className="mt-1 text-xs text-foreground-500">
                  数据按本地日期保存，最多保留 400 天
                </p>
              </div>
              <Tabs
                size="sm"
                color="primary"
                selectedKey={period}
                className="w-fit shrink-0"
                classNames={{
                  cursor: 'bg-primary',
                  tabContent: 'group-data-[selected=true]:text-primary-foreground'
                }}
                onSelectionChange={(key: Key) => {
                  setPeriod(key as TrafficStatsPeriod)
                  setSelectedKey(undefined)
                }}
              >
                {periods.map((item) => (
                  <Tab key={item.key} title={item.label} />
                ))}
              </Tabs>
            </div>
            <Divider />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <IoStatsChartOutline className="text-primary" />
                  分组方式
                </div>
                <p className="mt-1 text-xs text-foreground-500">点击列表项可查看该分组的三维明细</p>
              </div>
              <Tabs
                size="sm"
                color="primary"
                selectedKey={groupBy}
                className="w-fit shrink-0"
                classNames={{
                  cursor: 'bg-primary',
                  tabContent: 'group-data-[selected=true]:text-primary-foreground'
                }}
                onSelectionChange={(key: Key) => {
                  setGroupBy(key as TrafficStatsGroupBy)
                  setSelectedKey(undefined)
                }}
              >
                {groupings.map((item) => (
                  <Tab key={item.key} title={item.label} />
                ))}
              </Tabs>
            </div>
          </CardBody>
        </Card>

        {error && (
          <Card fullWidth shadow="none" className="border border-danger/30 bg-danger/10">
            <CardBody className="p-4 text-sm text-danger">
              流量统计读取失败：{String(error)}
            </CardBody>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
          <Card fullWidth className="border border-default-200/70 bg-content1">
            <CardBody className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-foreground-500">总流量</div>
                  <div className="mt-1 text-3xl font-bold tracking-tight">
                    {isLoading ? '—' : calcTraffic(data?.total || 0)}
                  </div>
                </div>
                <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
                  <IoStatsChartOutline className="text-2xl" />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <SummaryMetric label="上传" value={calcTraffic(data?.upload || 0)} tone="up" />
                <SummaryMetric label="下载" value={calcTraffic(data?.download || 0)} tone="down" />
                <SummaryMetric label="请求数" value={`${data?.requests || 0}`} />
                <SummaryMetric
                  label="统计范围"
                  value={periods.find((item) => item.key === period)?.label || ''}
                />
              </div>
              <div className="mt-5 text-xs text-foreground-500">
                {formatUpdatedAt(data?.updatedAt)}
              </div>
            </CardBody>
          </Card>

          <Card fullWidth className="border border-default-200/70 bg-content1">
            <CardBody className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">每日流量</div>
                  <div className="mt-1 text-xs text-foreground-500">上传与下载合计</div>
                </div>
                <div className="text-xs text-foreground-500">{daily.length} 天</div>
              </div>
              <div className="mt-4 flex h-32 items-end gap-1.5 overflow-hidden">
                {daily.map((item) => {
                  const height = Math.max(5, Math.round((item.total / maxDailyTotal) * 100))
                  return (
                    <div
                      key={item.date}
                      className="group flex h-full min-w-0 flex-1 flex-col justify-end"
                    >
                      <div
                        className="w-full rounded-t-md bg-primary/75 transition-all group-hover:bg-primary"
                        style={{ height: `${height}%` }}
                        title={`${item.date}: ${calcTraffic(item.total)}`}
                      />
                    </div>
                  )
                })}
                {daily.length === 0 && (
                  <div className="flex h-full w-full items-center justify-center rounded-lg bg-content2/60 text-sm text-foreground-500">
                    暂无历史数据
                  </div>
                )}
              </div>
              {daily.length > 0 && (
                <div className="mt-2 flex justify-between text-[10px] text-foreground-400">
                  <span>{formatDate(daily[0].date)}</span>
                  <span>{formatDate(daily[daily.length - 1].date)}</span>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <Card fullWidth className="border border-default-200/70 bg-content1">
          <CardBody className="p-0">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">按{groupLabels[groupBy]}统计</div>
                <div className="mt-1 text-xs text-foreground-500">
                  共 {data?.groups.length || 0} 个分组
                </div>
              </div>
              {isLoading && <Spinner size="sm" />}
            </div>
            <Divider />
            {(data?.groups.length || 0) > 0 ? (
              <div className="divide-y divide-divider">
                {data?.groups.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-content2/70"
                    onClick={() => setSelectedKey(group.key)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{group.key}</div>
                      <div className="mt-1 truncate text-xs text-foreground-500">
                        {group.requests} 请求 · ↑ {calcTraffic(group.upload)} · ↓{' '}
                        {calcTraffic(group.download)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold">{calcTraffic(group.total)}</div>
                      <div className="mt-1 text-xs text-foreground-400">查看详情</div>
                    </div>
                    <IoChevronForward className="shrink-0 text-lg text-foreground-400" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-36 items-center justify-center px-4 py-8 text-sm text-foreground-500">
                还没有统计数据，产生连接后会自动记录。
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        isOpen={selectedKey !== undefined}
        onOpenChange={(open) => {
          if (!open) setSelectedKey(undefined)
        }}
        size="lg"
        scrollBehavior="inside"
        disableAnimation={disableAnimation}
        backdrop={disableAnimation ? 'transparent' : 'blur'}
        classNames={{ backdrop: 'top-[48px]' }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 app-drag">
            <span className="truncate">{detail?.key || selectedKey || '流量详情'}</span>
            <span className="text-xs font-normal text-foreground-500">
              {periods.find((item) => item.key === period)?.label} · 按{groupLabels[groupBy]}分组
            </span>
          </ModalHeader>
          <ModalBody>
            {detailLoading && !detail ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : detail ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryMetric label="总流量" value={calcTraffic(detail.total)} />
                  <SummaryMetric label="上传" value={calcTraffic(detail.upload)} tone="up" />
                  <SummaryMetric label="下载" value={calcTraffic(detail.download)} tone="down" />
                  <SummaryMetric label="请求数" value={`${detail.requests}`} />
                </div>
                <Divider />
                {(['host', 'strategy', 'interface'] as TrafficStatsGroupBy[]).map((dimension) => (
                  <div key={dimension}>
                    <div className="mb-2 text-sm font-semibold">{groupLabels[dimension]}</div>
                    <div className="space-y-1.5">
                      {detail.breakdowns[dimension].map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-3 rounded-lg bg-content2/60 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm">{item.key}</div>
                            <div className="mt-0.5 text-xs text-foreground-500">
                              {item.requests} 请求 · ↑ {calcTraffic(item.upload)} · ↓{' '}
                              {calcTraffic(item.download)}
                            </div>
                          </div>
                          <div className="shrink-0 text-sm font-semibold">
                            {calcTraffic(item.total)}
                          </div>
                        </div>
                      ))}
                      {detail.breakdowns[dimension].length === 0 && (
                        <div className="rounded-lg bg-content2/60 px-3 py-2 text-sm text-foreground-500">
                          暂无数据
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-foreground-500">暂无详情数据</div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setSelectedKey(undefined)}>
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </BasePage>
  )
}

export default TrafficStats
