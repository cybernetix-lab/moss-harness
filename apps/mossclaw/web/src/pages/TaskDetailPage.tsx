import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Col, Descriptions, Empty, Row, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import type { TaskArtifactDto, TaskDto, TaskEventDto, TaskStageDto } from '@mossclaw/shared';
import { getTask } from '../services/api';

const { Title, Text, Paragraph } = Typography;

export function TaskDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<TaskDto | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    getTask(id)
      .then((nextTask) => setTask(nextTask))
      .catch((error) => {
        console.error('Failed to load task detail:', error);
      });
  }, [id]);

  if (!id) {
    return <div style={{ padding: 24 }}>Invalid ID</div>;
  }

  if (!task) {
    return <div style={{ padding: 24 }}>加载任务详情中...</div>;
  }

  const stageColumns: TableProps<TaskStageDto>['columns'] = [
    { title: '阶段', dataIndex: 'name', key: 'name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag>{status.toUpperCase()}</Tag>,
    },
    {
      title: '执行 Agent',
      key: 'agentName',
      render: (_, record) => record.agentName ?? '-',
    },
  ];

  const artifactColumns: TableProps<TaskArtifactDto>['columns'] = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '路径', dataIndex: 'path', key: 'path' },
  ];

  const eventColumns: TableProps<TaskEventDto>['columns'] = [
    { title: '事件', dataIndex: 'type', key: 'type' },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: string) => new Date(timestamp).toLocaleString(),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            任务详情
          </Title>
          <Paragraph style={{ marginBottom: 0 }}>{task.goal}</Paragraph>
          <Text type="secondary">任务 ID: {task.id}</Text>
        </div>

        <Row gutter={16}>
          <Col span={8}>
            <Card variant="borderless">
              <Descriptions column={1} size="small" title="执行摘要">
                <Descriptions.Item label="状态">{task.status}</Descriptions.Item>
                <Descriptions.Item label="入口 Agent">{task.config.entryAgentName}</Descriptions.Item>
                <Descriptions.Item label="优先级">{task.config.priority ?? '-'}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col span={8}>
            <Card variant="borderless">
              <Descriptions column={1} size="small" title="指标">
                <Descriptions.Item label="已完成阶段">{task.metrics.completedStages ?? 0}</Descriptions.Item>
                <Descriptions.Item label="重试次数">{task.metrics.retryCount ?? 0}</Descriptions.Item>
                <Descriptions.Item label="Token">{task.metrics.tokenCount ?? 0}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col span={8}>
            <Card variant="borderless">
              <Space direction="vertical">
                <Button type="primary" onClick={() => navigate(`/tasks/${task.id}/run`)}>
                  进入执行页
                </Button>
                <Button onClick={() => navigate('/')}>返回工作台</Button>
              </Space>
            </Card>
          </Col>
        </Row>

        <Card variant="borderless">
          <Tabs
            items={[
              {
                key: 'stages',
                label: '阶段详情',
                children: task.stages.length > 0 ? (
                  <Table columns={stageColumns} dataSource={task.stages} rowKey="id" pagination={false} />
                ) : (
                  <Empty description="暂无阶段数据" />
                ),
              },
              {
                key: 'artifacts',
                label: '产物',
                children: task.artifacts.length > 0 ? (
                  <Table columns={artifactColumns} dataSource={task.artifacts} rowKey="id" pagination={false} />
                ) : (
                  <Empty description="暂无产物" />
                ),
              },
              {
                key: 'events',
                label: '事件流',
                children: task.events.length > 0 ? (
                  <Table columns={eventColumns} dataSource={task.events} rowKey="id" pagination={false} />
                ) : (
                  <Empty description="暂无事件" />
                ),
              },
            ]}
          />
        </Card>
      </Space>
    </div>
  );
}

export default TaskDetailPage;
