import { Button, Card, Space, Tag, Typography } from 'antd';
import type { OntologyProjectionNodeDto } from '@mossclaw/shared';

const { Text } = Typography;

interface GraphNodeRendererProps {
  node: OntologyProjectionNodeDto;
  isFocus: boolean;
  isHighlighted?: boolean;
  onFocusNode: (node: OntologyProjectionNodeDto) => void;
}

export function GraphNodeRenderer({ node, isFocus, isHighlighted = false, onFocusNode }: GraphNodeRendererProps) {
  return (
    <Card
      size="small"
      style={isHighlighted ? { borderColor: '#eb2f96', boxShadow: '0 0 0 1px rgba(235, 47, 150, 0.2)' } : undefined}
      title={
        <Space wrap>
          <Text strong>{node.label}</Text>
          <Tag color={isFocus ? 'blue' : 'default'}>{node.kind}</Tag>
          {isHighlighted ? <Tag color="magenta">loop</Tag> : null}
          {node.plane ? <Tag>{node.plane}</Tag> : null}
          {node.state ? <Tag color="gold">{node.state}</Tag> : null}
        </Space>
      }
      extra={
        node.objectType && node.objectId ? (
          <Button type="link" size="small" onClick={() => onFocusNode(node)}>
            切换焦点
          </Button>
        ) : undefined
      }
    >
      <Space direction="vertical" size={4} style={{ display: 'flex' }}>
        <Text type="secondary">Node ID: {node.id}</Text>
        {node.objectType ? <Text type="secondary">Object Type: {node.objectType}</Text> : null}
        {node.objectId ? <Text type="secondary">Object ID: {node.objectId}</Text> : null}
      </Space>
    </Card>
  );
}

export default GraphNodeRenderer;
