import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Row, Statistic, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { TaskDto } from '@mossclaw/shared';
import { listTasks } from '../services/api';

const { Title } = Typography;

export function DashboardPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTasks()
      .then((data) => {
        setTasks(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const runningTasks = useMemo(() => tasks.filter((task) => task.status === 'running').length, [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.status === 'completed').length, [tasks]);
  const failedTasks = useMemo(() => tasks.filter((task) => task.status === 'failed').length, [tasks]);

  const columns: TableProps<TaskDto>['columns'] = [
    {
      title: '任务目标',
      dataIndex: 'goal',
      key: 'goal',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'completed') color = 'success';
        if (status === 'running') color = 'processing';
        if (status === 'pending') color = 'warning';
        if (status === 'failed') color = 'error';
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: '执行 Agent',
      key: 'entryAgentName',
      render: (_, record) => record.config.entryAgentName ?? '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" onClick={() => navigate(`/tasks/${record.id}`)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            工作台
          </Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tasks/new')}>
            新建任务
          </Button>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic title="运行中任务" value={runningTasks} styles={{ content: { color: '#1677ff' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic title="已完成任务" value={completedTasks} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic title="失败任务" value={failedTasks} styles={{ content: { color: '#ff4d4f' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic title="总任务数" value={tasks.length} />
          </Card>
        </Col>
      </Row>

      <Card title="最近任务" variant="borderless">
        <Table columns={columns} dataSource={tasks} rowKey="id" loading={loading} pagination={{ pageSize: 5 }} />
      </Card>
    </div>
  );
}

export default DashboardPage;
