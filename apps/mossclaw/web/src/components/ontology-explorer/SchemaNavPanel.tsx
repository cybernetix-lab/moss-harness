import { Card, Collapse, Empty, Space, Spin, Typography } from 'antd';
import type { OntologyExplorerPlaneGroup } from '../../types/ontologyExplorer';
import { SchemaTypeTree } from './SchemaTypeTree';

const { Paragraph } = Typography;

interface SchemaNavPanelProps {
  loading: boolean;
  error: string | null;
  groups: OntologyExplorerPlaneGroup[];
  selectedType: string | null;
  onSelectType: (objectType: string) => void;
}

export function SchemaNavPanel({
  loading,
  error,
  groups,
  selectedType,
  onSelectType
}: SchemaNavPanelProps) {
  return (
    <Card title="Schema Navigation" style={{ height: '100%' }}>
      {loading ? (
        <Space direction="vertical" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
          <Spin />
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            正在加载 plane 分组类型树...
          </Paragraph>
        </Space>
      ) : error ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error} />
      ) : groups.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可用的类型投影数据" />
      ) : (
        <Collapse
          ghost
          defaultActiveKey={groups.map((group) => group.plane)}
          items={groups.map((group) => ({
            key: group.plane,
            label: `${group.label} (${group.items.length})`,
            children: (
              <SchemaTypeTree
                items={group.items}
                selectedType={selectedType}
                onSelectType={onSelectType}
              />
            )
          }))}
        />
      )}
    </Card>
  );
}

export default SchemaNavPanel;
