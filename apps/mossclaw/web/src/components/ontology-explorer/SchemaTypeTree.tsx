import { Button, Empty, Space, Typography } from 'antd';
import type { OntologyExplorerTypeSummary } from '../../types/ontologyExplorer';

const { Text } = Typography;

interface SchemaTypeTreeProps {
  items: OntologyExplorerTypeSummary[];
  selectedType: string | null;
  onSelectType: (objectType: string) => void;
}

export function SchemaTypeTree({ items, selectedType, onSelectType }: SchemaTypeTreeProps) {
  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前分组暂无类型" />;
  }

  return (
    <Space direction="vertical" size={8} style={{ display: 'flex' }}>
      {items.map((item) => (
        <Button
          key={item.id}
          type={selectedType === item.objectType ? 'primary' : 'default'}
          block
          onClick={() => onSelectType(item.objectType)}
        >
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text style={{ color: 'inherit' }}>{item.objectType}</Text>
            <Text style={{ color: 'inherit', opacity: 0.8 }}>{item.propertyCount}</Text>
          </Space>
        </Button>
      ))}
    </Space>
  );
}

export default SchemaTypeTree;
