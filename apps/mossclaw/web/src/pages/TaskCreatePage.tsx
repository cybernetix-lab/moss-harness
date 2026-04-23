import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Collapse, Form, Input, Select, Space, Spin, Switch, Typography, message } from 'antd';
import type { AgentDto, ModelOptionDto } from '@mossclaw/shared';
import { createTask, listAgents, listModels } from '../services/api';
import type { TaskCreateFormValues } from '../types/ui';

const { Title, Text } = Typography;

const priorityOptions = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
];

export function TaskCreatePage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<TaskCreateFormValues>();
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [models, setModels] = useState<ModelOptionDto[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingModels, setLoadingModels] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    listAgents()
      .then((data) => {
        if (!mounted) {
          return;
        }
        const availableAgents = data.filter((agent) => !agent.isDisabled);
        setAgents(availableAgents);
        const preferredAgent = availableAgents.find((agent) => agent.name === 'planner')?.name ?? availableAgents[0]?.name;
        form.setFieldValue(['config', 'entryAgentName'], preferredAgent);
      })
      .catch((requestError) => {
        if (mounted) {
          setError(requestError instanceof Error ? requestError.message : '加载 Agent 列表失败');
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingAgents(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [form]);

  useEffect(() => {
    let mounted = true;

    listModels()
      .then((data) => {
        if (!mounted) {
          return;
        }

        setModels(data);
        const preferredModel =
          data.find((model) => model.profile === 'balanced')?.model ??
          data.find((model) => model.profile === 'high-capability')?.model ??
          data[0]?.model;
        form.setFieldValue(['config', 'model'], preferredModel);
      })
      .catch((requestError) => {
        if (mounted) {
          setError(requestError instanceof Error ? requestError.message : '加载模型列表失败');
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingModels(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [form]);

  const agentOptions = useMemo(
    () =>
      agents.map((agent) => ({
        label: agent.name,
        value: agent.name,
      })),
    [agents]
  );

  const modelOptions = useMemo(
    () =>
      models.map((model) => ({
        label: `${model.model} (${model.provider})`,
        value: model.model,
        title: model.description,
      })),
    [models]
  );

  const handleSubmit = async (values: TaskCreateFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      const payload: TaskCreateFormValues = {
        goal: values.goal.trim(),
        config: {
          entryAgentName: values.config.entryAgentName,
          priority: values.config.priority ?? 'medium',
          timeoutMinutes: values.config.timeoutMinutes,
          model: values.config.model,
          sandboxMode: values.config.sandboxMode ?? false,
          selectedSkills: values.config.selectedSkills ?? [],
          context: values.config.context,
        },
      };
      const task = await createTask(payload);
      message.success('任务已创建');
      navigate(`/tasks/${task.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '创建任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            新建任务
          </Title>
          <Text type="secondary">输入任务目标并选择执行入口 Agent，提交后进入任务详情页。</Text>
        </div>

        <Card variant="borderless">
          {error ? (
            <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
          ) : null}

          {loadingAgents || loadingModels ? (
            <Spin />
          ) : (
            <Form<TaskCreateFormValues>
              form={form}
              layout="vertical"
              initialValues={{
                goal: '',
                config: {
                  priority: 'medium',
                  sandboxMode: false,
                  selectedSkills: [],
                },
              }}
              onFinish={handleSubmit}
            >
              <Form.Item
                name="goal"
                label="任务目标"
                rules={[
                  { required: true, message: '请输入任务目标' },
                  {
                    validator: async (_, value: string | undefined) => {
                      if (!value || value.trim().length > 0) {
                        return;
                      }
                      throw new Error('任务目标不能为空');
                    },
                  },
                ]}
              >
                <Input.TextArea rows={8} placeholder="例如：分析当前任务执行链路并输出重构方案" />
              </Form.Item>

              <Form.Item name={['config', 'model']} label="模型">
                <Select
                  options={modelOptions}
                  placeholder="选择一个模型"
                  optionFilterProp="label"
                  showSearch
                />
              </Form.Item>

              <Collapse
                items={[
                  {
                    key: 'advanced',
                    label: '高级配置',
                    children: (
                      <>
                        <Form.Item
                          name={['config', 'entryAgentName']}
                          label="入口 Agent"
                          rules={[{ required: true, message: '请选择入口 Agent' }]}
                        >
                          <Select options={agentOptions} placeholder="选择一个可用 Agent" />
                        </Form.Item>

                        <Form.Item name={['config', 'priority']} label="优先级">
                          <Select options={priorityOptions} />
                        </Form.Item>

                        <Form.Item name={['config', 'timeoutMinutes']} label="超时时间（分钟）">
                          <Input type="number" min={1} placeholder="可选，例如 30" />
                        </Form.Item>

                        <Form.Item name={['config', 'sandboxMode']} label="启用沙箱" valuePropName="checked">
                          <Switch />
                        </Form.Item>
                      </>
                    ),
                  },
                ]}
              />

              <Space>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  创建任务
                </Button>
                <Button onClick={() => navigate('/')}>取消</Button>
              </Space>
            </Form>
          )}
        </Card>
      </Space>
    </div>
  );
}

export default TaskCreatePage;
