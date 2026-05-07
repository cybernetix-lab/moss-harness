import { Card, Descriptions, Empty, Space, Spin, Tag, Typography } from 'antd';
import type { OntologyExplorerObjectDetail } from '../../types/ontologyExplorer';

const { Paragraph, Text } = Typography;

interface ObjectDetailTabProps {
  loading: boolean;
  error: string | null;
  objectDetail: OntologyExplorerObjectDetail | null;
}

export function ObjectDetailTab({ loading, error, objectDetail }: ObjectDetailTabProps) {
  return (
    <Card title="Object Detail">
      {loading ? (
        <Space direction="vertical" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
          <Spin />
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            正在加载对象详情...
          </Paragraph>
        </Space>
      ) : error ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error} />
      ) : !objectDetail ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="从实例列表中选择对象后，这里会展示对象详情和原始 properties。" />
      ) : (
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Object Type">{objectDetail.objectType}</Descriptions.Item>
            <Descriptions.Item label="Object ID">{objectDetail.objectId}</Descriptions.Item>
            <Descriptions.Item label="Display Name">{objectDetail.displayName}</Descriptions.Item>
            <Descriptions.Item label="State">
              <Tag color="blue">{objectDetail.state}</Tag>
            </Descriptions.Item>
          </Descriptions>
          <div>
            <Text strong>Raw Properties</Text>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                background: '#141414',
                borderRadius: 8,
                overflowX: 'auto'
              }}
            >
              {JSON.stringify(objectDetail.properties, null, 2)}
            </pre>
          </div>
        </Space>
      )}
    </Card>
  );
}

export default ObjectDetailTab;
