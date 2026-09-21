const groupTypeNames: Record<string, string> = {
  Selector: '手动选择',
  Fallback: '自动回退',
  URLTest: '自动选择',
  LoadBalance: '负载均衡',
  Relay: '链式代理'
}

export function getGroupTypeName(type: string): string {
  return groupTypeNames[type] ?? type
}
