import { Card, Space, Statistic, Tag, Typography } from 'antd';
import type { OntologyExplorerTypeSummary } from '../../types/ontologyExplorer';

const { Paragraph, Text } = Typography;

interface TypeSummaryCardProps {
  item: OntologyExplorerTypeSummary;
  selected?: boolean;
  onSelect?: (objectType: string) => void;
}

export function TypeSummaryCard({ item, selected = false, onSelect }: TypeSummaryCardProps) {
  return (
    <Card
      hoverable={Boolean(onSelect)}
      size="small"
      variant={selected ? 'outlined' : 'borderless'}
      styles={{
        body: {
          padding: 16
        }
      }}
      onClick={() => onSelect?.(item.objectType)}
    >
      <Space direction="vertical" size={8} style={{ display: 'flex' }}>
        <Space align="center" wrap>
          <Text strong>{item.label}</Text>
          <Tag color={selected ? 'blue' : 'default'}>{item.plane}</Tag>
        </Space>
        <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
          {item.description ?? '暂无类型描述'}
        </Paragraph>
        <Statistic title="Properties" value={item.propertyCount} />
      </Space>
    </Card>
  );
}

export default TypeSummaryCard;
