import BasePage from '@renderer/components/base/base-page'
import RuleItem from '@renderer/components/rules/rule-item'
import { useMemo, useState } from 'react'
import { Divider, Input } from '@heroui/react'
import { useRules } from '@renderer/hooks/use-rules'
import { includesIgnoreCase } from '@renderer/utils/includes'

const Rules: React.FC = () => {
  const { rules } = useRules()
  const [filter, setFilter] = useState('')

  const filteredRules = useMemo(() => {
    if (!rules) return []
    if (filter === '') return rules.rules
    return rules.rules.filter((rule) => {
      return (
        includesIgnoreCase(rule.payload, filter) ||
        includesIgnoreCase(rule.type, filter) ||
        includesIgnoreCase(rule.proxy, filter)
      )
    })
  }, [rules, filter])

  return (
    <BasePage title="分流规则" contentClassName="flex min-h-0 flex-col overflow-y-hidden">
      <div className="sticky top-0 z-40 shrink-0">
        <div className="flex p-2">
          <Input
            size="sm"
            value={filter}
            placeholder="筛选过滤"
            isClearable
            onValueChange={setFilter}
          />
        </div>
        <Divider />
      </div>
      <div className="mt-px min-h-0 flex-1 overflow-y-auto">
        {filteredRules.map((rule, i) => (
          <RuleItem key={`${rule.type}-${rule.payload}-${i}`} index={i} rule={rule} />
        ))}
      </div>
    </BasePage>
  )
}

export default Rules
