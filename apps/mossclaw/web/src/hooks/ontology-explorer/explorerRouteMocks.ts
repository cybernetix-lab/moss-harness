import type { ExplorerMockScenario } from '../../types/ontologyExplorer';

export function createExplorerMockScenarios(): ExplorerMockScenario[] {
  return [
    {
      id: 'schema-default',
      label: 'Schema 默认态',
      description: '默认 schema 模式，无对象焦点，无筛选条件。',
      search: ''
    },
    {
      id: 'search-orders',
      label: '搜索态',
      description: '实例模式下查看 Order，带状态过滤和前端局部搜索词。',
      search: '?mode=instances&type=Order&state=PendingReview&q=order'
    },
    {
      id: 'object-focus',
      label: '对象焦点态',
      description: '聚焦一个具体对象并保留一跳深度参数。',
      search: '?mode=instances&type=Order&objectId=order-001&depth=1'
    },
    {
      id: 'loop-focus',
      label: 'Loop 高亮态',
      description: '切到 loops 模式并选中一个结构闭环。',
      search:
        '?mode=loops&type=Order&objectId=order-001&depth=1&loopId=loop%3AArtifact%3Aartifact-001%3EOrder%3Aorder-001%3EReview%3Areview-001'
    }
  ];
}
