import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Space, Steps, Typography, message } from 'antd';
import type { AgentLogRealtimeEvent, TaskDto } from '@mossclaw/shared';
import { executeTask, getTask, retryTask } from '../services/api';
import { createTaskSocket } from '../services/socket';

const { Title, Text } = Typography;

export function TaskExecutionPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<TaskDto | null>(null);
  const [logs, setLogs] = useState<AgentLogRealtimeEvent[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }

    getTask(id)
      .then((currentTask) => {
        setTask(currentTask);
      })
      .catch((error) => {
        console.error('Failed to load task:', error);
      });
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    const socket = createTaskSocket(id, {
      onAgentLog: (log) => setLogs((prev) => [...prev, log]),
      onTaskStarted: ({ task: nextTask }) => {
        setTask(nextTask);
        setIsExecuting(true);
      },
      onTaskCompleted: ({ task: nextTask }) => {
        setTask(nextTask);
        setIsExecuting(false);
      },
      onTaskFailed: ({ task: nextTask }) => {
        setTask(nextTask);
        setIsExecuting(false);
      },
    });

    return () => {
      socket.disconnect();
    };
  }, [id]);

  const handleStart = async () => {
    if (!id) {
      return;
    }
    setIsExecuting(true);
    try {
      await executeTask(id);
    } catch (error) {
      setIsExecuting(false);
      message.error(error instanceof Error ? error.message : '启动任务失败');
    }
  };

  const handleRetry = async () => {
    if (!id) {
      return;
    }
    try {
      const response = await retryTask(id);
      message.success('已创建重试任务');
      navigate(`/tasks/${response.newTaskId}/run`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '重试任务失败');
    }
  };

  const hasScheduled = logs.length > 0 || Boolean(task?.events.some((event) => event.type === 'agent_log'));
  const currentStep = task?.status === 'completed' ? 3 : task?.status === 'failed' ? 4 : task?.status === 'running' ? 2 : hasScheduled ? 1 : 0;
  const stepItems: Array<{ title: string; status?: 'wait' | 'process' | 'finish' | 'error' }> = useMemo(
    () => [
      { title: 'Queued' },
      { title: 'Scheduled' },
      { title: 'Running' },
      { title: 'Completed' },
      { title: 'Failed', status: task?.status === 'failed' ? 'error' : 'wait' },
    ],
    [task?.status]
  );

  if (!id) {
    return <div style={{ padding: 24 }}>Invalid ID</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        任务执行面板: <Text type="secondary">{id}</Text>
      </Title>

      <Card variant="borderless" style={{ marginBottom: 24 }}>
        <Steps current={currentStep} items={stepItems} />
      </Card>

      <Space style={{ marginBottom: 24 }}>
        <Button type="primary" onClick={handleStart} loading={isExecuting}>
          开始执行
        </Button>
        <Button onClick={handleRetry}>重试任务</Button>
        <Button onClick={() => navigate(`/tasks/${id}`)}>查看详情</Button>
      </Space>

      <Card title="执行日志" variant="borderless" style={{ background: '#000' }} headStyle={{ color: '#fff', borderBottom: '1px solid #333' }}>
        <div
          style={{
            fontFamily: 'monospace',
            height: '400px',
            overflowY: 'auto',
            color: '#d9d9d9',
            fontSize: '14px',
          }}
        >
          {logs.length === 0 && <Text type="secondary">等待日志输出...</Text>}
          {logs.map((log, index) => (
            <div key={`${log.timestamp}-${index}`} style={{ marginBottom: 8 }}>
              <span style={{ color: '#8c8c8c' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
              <span style={{ color: '#1677ff' }}>[{log.stage}]</span>{' '}
              <span>{log.content}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default TaskExecutionPage;
