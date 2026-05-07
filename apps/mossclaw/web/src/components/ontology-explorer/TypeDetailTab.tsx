import { Alert, Card, Descriptions, Empty, Space, Tag, Typography } from 'antd';
import type { OntologyExplorerTypeSummary } from '../../types/ontologyExplorer';
import { TypeSummaryCard } from './TypeSummaryCard';

const { Paragraph, Text } = Typography;

interface TypeDetailTabProps {
  currentType: OntologyExplorerTypeSummary | null;
}

export function TypeDetailTab({ currentType }: TypeDetailTabProps) {
  if (!currentType) {
    return (
      <Card title="Type Detail" style={{ height: '100%' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="选择左侧类型后，这里会展示类型摘要、属性数量和后续实例钻取入口。"
        />
      </Card>
    );
  }

  return (
    <Card title="Type Detail" style={{ height: '100%' }}>
      <Space direction="vertical" size={16} style={{ display: 'flex' }}>
        <TypeSummaryCard item={currentType} selected />
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Object Type">{currentType.objectType}</Descriptions.Item>
          <Descriptions.Item label="Plane">
            <Tag color="blue">{currentType.plane}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Properties">{currentType.propertyCount}</Descriptions.Item>
          <Descriptions.Item label="Description">
            <Text>{currentType.description ?? '暂无类型描述'}</Text>
          </Descriptions.Item>
        </Descriptions>
        <Alert
          type="info"
          showIcon
          message="后续扩展"
          description="Task 9 会在这个面板附近接入实例列表与对象详情；Task 10 会把类型选择与图焦点联动起来。"
        />
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          当前阶段只展示类型摘要，不在 UI 侧猜测关系边或实例统计。
        </Paragraph>
      </Space>
    </Card>
  );
}

export default TypeDetailTab;
