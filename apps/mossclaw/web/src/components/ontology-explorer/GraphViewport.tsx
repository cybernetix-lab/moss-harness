import { Alert, Card, Divider, Empty, List, Space, Spin, Tag, Typography } from 'antd';
import type {
  OntologyLoopSummaryDto,
  OntologyProjectionNodeDto,
  OntologyProjectionSubgraphDto
} from '@mossclaw/shared';
import { GraphEdgeRenderer } from './GraphEdgeRenderer';
import { GraphNodeRenderer } from './GraphNodeRenderer';

const { Paragraph, Text } = Typography;

interface GraphViewportProps {
  loading: boolean;
  error: string | null;
  subgraph: OntologyProjectionSubgraphDto | null;
  selectedLoop: OntologyLoopSummaryDto | null;
  onFocusNode: (node: OntologyProjectionNodeDto) => void;
}

function compareNodeLabels(left: OntologyProjectionNodeDto, right: OntologyProjectionNodeDto): number {
  return left.label.localeCompare(right.label);
}

export function GraphViewport({ loading, error, subgraph, selectedLoop, onFocusNode }: GraphViewportProps) {
  const nodeById = new Map(subgraph?.nodes.map((node) => [node.id, node]) ?? []);
  const focusNode = subgraph ? nodeById.get(subgraph.focusNodeId) ?? subgraph.nodes[0] ?? null : null;
  const neighborNodes = subgraph?.nodes.filter((node) => node.id !== focusNode?.id).sort(compareNodeLabels) ?? [];
  const highlightedNodeIds = new Set(selectedLoop?.nodeIds ?? []);
  const highlightedEdgeIds = new Set(selectedLoop?.edgeIds ?? []);

  return (
    <Card
      title="Graph Viewport"
      style={{ height: '100%', minHeight: 420 }}
      extra={
        subgraph ? (
          <Space wrap>
            <Tag>Nodes: {subgraph.stats?.nodeCount ?? subgraph.nodes.length}</Tag>
            <Tag>Edges: {subgraph.stats?.edgeCount ?? subgraph.edges.length}</Tag>
            <Tag color={subgraph.truncated ? 'gold' : 'green'}>
              {subgraph.truncated ? 'Truncated' : 'Complete'}
            </Tag>
          </Space>
        ) : undefined
      }
    >
      {loading ? (
        <Space direction="vertical" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
          <Spin />
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            正在加载局部子图...
          </Paragraph>
        </Space>
      ) : error ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error} />
      ) : !subgraph || !focusNode ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="从右侧实例列表中选择对象后，这里会展示该对象的一跳局部子图。"
        />
      ) : (
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          {subgraph.truncated ? (
            <Alert
              type="warning"
              showIcon
              message="当前子图被裁剪"
              description="MVP 只展示局部范围内的稳定结果；如需更深漫游，后续任务会再扩展。"
            />
          ) : null}

          <div>
            <Text strong>当前焦点</Text>
            <GraphNodeRenderer
              node={focusNode}
              isFocus
              isHighlighted={highlightedNodeIds.has(focusNode.id)}
              onFocusNode={onFocusNode}
            />
          </div>

          <div>
            <Text strong>邻居节点</Text>
            {neighborNodes.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="当前对象没有可展示的一跳邻居，局部图仅包含焦点节点。"
              />
            ) : (
              <List
                grid={{ gutter: 12, xs: 1, md: 2 }}
                dataSource={neighborNodes}
                renderItem={(node) => (
                  <List.Item>
                    <GraphNodeRenderer
                      node={node}
                      isFocus={false}
                      isHighlighted={highlightedNodeIds.has(node.id)}
                      onFocusNode={onFocusNode}
                    />
                  </List.Item>
                )}
              />
            )}
          </div>

          <div>
            <Divider style={{ marginBlock: 8 }} />
            <Text strong>边列表</Text>
            {subgraph.edges.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前局部图没有可展示的投影边。" />
            ) : (
              <List
                dataSource={subgraph.edges}
                renderItem={(edge) => (
                  <GraphEdgeRenderer
                    edge={edge}
                    sourceLabel={nodeById.get(edge.source)?.label ?? edge.source}
                    targetLabel={nodeById.get(edge.target)?.label ?? edge.target}
                    isHighlighted={highlightedEdgeIds.has(edge.id)}
                  />
                )}
              />
            )}
          </div>
        </Space>
      )}
    </Card>
  );
}

export default GraphViewport;
