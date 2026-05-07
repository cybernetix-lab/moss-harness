import { Button, Card, Empty, List, Space, Spin, Tag, Typography } from 'antd';
import type { OntologyExplorerInstanceSummary } from '../../types/ontologyExplorer';

const { Paragraph, Text } = Typography;

interface InstanceListTabProps {
  loading: boolean;
  error: string | null;
  items: OntologyExplorerInstanceSummary[];
  totalCount: number;
  filteredCount: number;
  focusedObjectId: string | null;
  onOpenObject: (objectType: string, objectId: string) => void;
}

export function InstanceListTab({
  loading,
  error,
  items,
  totalCount,
  filteredCount,
  focusedObjectId,
  onOpenObject
}: InstanceListTabProps) {
  return (
    <Card title="Instance List">
      {loading ? (
        <Space direction="vertical" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
          <Spin />
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            正在加载实例集合...
          </Paragraph>
        </Space>
      ) : error ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error} />
      ) : items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前类型暂无实例，或被筛选条件过滤为空。" />
      ) : (
        <Space direction="vertical" size={12} style={{ display: 'flex' }}>
          <Text type="secondary">
            已加载 {totalCount} 条实例，当前展示 {filteredCount} 条。
          </Text>
          <List
            dataSource={items}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button key={`${item.id}-open`} type="link" onClick={() => onOpenObject(item.objectType, item.objectId)}>
                    查看对象
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Text strong>{item.displayName}</Text>
                      <Tag color={focusedObjectId === item.objectId ? 'blue' : 'default'}>{item.state}</Tag>
                    </Space>
                  }
                  description={`${item.objectType} / ${item.objectId}`}
                />
              </List.Item>
            )}
          />
        </Space>
      )}
    </Card>
  );
}

export default InstanceListTab;
