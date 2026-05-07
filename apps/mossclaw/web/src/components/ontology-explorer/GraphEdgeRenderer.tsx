import { List, Space, Tag, Typography } from 'antd';
import type { OntologyProjectionEdgeDto } from '@mossclaw/shared';

const { Text } = Typography;

interface GraphEdgeRendererProps {
  edge: OntologyProjectionEdgeDto;
  sourceLabel: string;
  targetLabel: string;
  isHighlighted?: boolean;
}

export function GraphEdgeRenderer({
  edge,
  sourceLabel,
  targetLabel,
  isHighlighted = false
}: GraphEdgeRendererProps) {
  return (
    <List.Item style={isHighlighted ? { background: 'rgba(235, 47, 150, 0.08)', borderRadius: 8, paddingInline: 8 } : undefined}>
      <Space direction="vertical" size={4} style={{ display: 'flex', width: '100%' }}>
        <Space wrap>
          <Text strong>{sourceLabel}</Text>
          <Text type="secondary">-&gt;</Text>
          <Text strong>{targetLabel}</Text>
          {isHighlighted ? <Tag color="magenta">loop</Tag> : null}
          <Tag color="purple">{edge.kind}</Tag>
          {edge.label ? <Tag>{edge.label}</Tag> : null}
        </Space>
        <Text type="secondary">Edge ID: {edge.id}</Text>
      </Space>
    </List.Item>
  );
}

export default GraphEdgeRenderer;
