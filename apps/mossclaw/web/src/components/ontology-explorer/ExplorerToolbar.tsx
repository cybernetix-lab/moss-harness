import { Button, Card, Col, Input, Row, Segmented, Space, Tag } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ExplorerMode } from '../../types/ontologyExplorer';

interface ExplorerToolbarProps {
  mode: ExplorerMode;
  searchQuery: string | null;
  depth: number;
  stateFilter: string | null;
  canGoBack: boolean;
  onSetMode: (mode: ExplorerMode) => void;
  onSetSearchQuery: (value: string) => void;
  onReset: () => void;
  onGoBack: () => void;
}

export function ExplorerToolbar({
  mode,
  searchQuery,
  depth,
  stateFilter,
  canGoBack,
  onSetMode,
  onSetSearchQuery,
  onReset,
  onGoBack
}: ExplorerToolbarProps) {
  return (
    <Card>
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} xl={8}>
          <Input.Search
            allowClear
            value={searchQuery ?? ''}
            placeholder="搜索 objectType / objectId / displayName（前端局部筛选）"
            onChange={(event) => onSetSearchQuery(event.target.value)}
            onSearch={onSetSearchQuery}
          />
        </Col>
        <Col xs={24} md={12} xl={8}>
          <Segmented
            block
            options={[
              { label: 'Schema', value: 'schema' },
              { label: 'Instances', value: 'instances' },
              { label: 'Loops', value: 'loops' }
            ]}
            value={mode}
            onChange={(value) => onSetMode(value as ExplorerMode)}
          />
        </Col>
        <Col xs={24} md={12} xl={8}>
          <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Tag>Depth: {depth}</Tag>
            <Tag color="default">Depth Control Locked</Tag>
            <Tag color={stateFilter ? 'blue' : 'default'}>State: {stateFilter ?? 'None'}</Tag>
            <Button icon={<ArrowLeftOutlined />} disabled={!canGoBack} onClick={onGoBack}>
              回退
            </Button>
            <Button icon={<ReloadOutlined />} onClick={onReset}>
              重置视图
            </Button>
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

export default ExplorerToolbar;
