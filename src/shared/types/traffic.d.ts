type TrafficStatsPeriod = 'today' | 'month' | 'lastMonth'

type TrafficStatsGroupBy = 'host' | 'strategy' | 'interface'

interface TrafficStatsGroup {
  key: string
  upload: number
  download: number
  total: number
  requests: number
}

interface TrafficStatsDay {
  date: string
  upload: number
  download: number
  total: number
}

interface TrafficStatsResult {
  period: TrafficStatsPeriod
  groupBy: TrafficStatsGroupBy
  upload: number
  download: number
  total: number
  requests: number
  daily: TrafficStatsDay[]
  groups: TrafficStatsGroup[]
  updatedAt: string
}

interface TrafficStatsDetailResult extends TrafficStatsResult {
  key: string
  breakdowns: {
    host: TrafficStatsGroup[]
    strategy: TrafficStatsGroup[]
    interface: TrafficStatsGroup[]
  }
}
