import { Button, Card, Empty, List, Space, Spin, Tag, Typography } from 'antd';
import type { OntologyLoopSummaryDto } from '@mossclaw/shared';

const { Paragraph, Text } = Typography;

interface LoopAnalysisTabProps {
  loading: boolean;
  error: string | null;
  loops: OntologyLoopSummaryDto[];
  selectedLoopId: string | null;
  onSelectLoop: (loopId: string | null) => void;
}

export function LoopAnalysisTab({
  loading,
  error,
  loops,
  selectedLoopId,
  onSelectLoop
}: LoopAnalysisTabProps) {
  return (
    <Card title="Loop Analysis">
      {loading ? (
        <Space direction="vertical" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
          <Spin />
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            正在分析结构闭环...
          </Paragraph>
        </Space>
      ) : error ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error} />
      ) : loops.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="当前局部子图中未检测到结构闭环。"
        />
      ) : (
        <List
          dataSource={loops}
          renderItem={(loop) => {
            const isSelected = loop.loopId === selectedLoopId;
            return (
              <List.Item
                actions={[
                  <Button
                    key={`${loop.loopId}-select`}
                    type={isSelected ? 'primary' : 'link'}
                    onClick={() => onSelectLoop(isSelected ? null : loop.loopId)}
                  >
                    {isSelected ? '取消高亮' : '高亮回路'}
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Text strong>{loop.loopId}</Text>
                      <Tag color={isSelected ? 'magenta' : 'default'}>{loop.category}</Tag>
                      <Tag>length: {loop.length}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} style={{ display: 'flex' }}>
                      <Text type="secondary">nodes: {loop.nodeIds.join(' -> ')}</Text>
                      <Text type="secondary">edges: {loop.edgeIds.length}</Text>
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );
}

export default LoopAnalysisTab;
