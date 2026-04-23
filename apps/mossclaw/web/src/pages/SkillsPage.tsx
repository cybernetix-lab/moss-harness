import { useEffect, useState } from 'react';
import { Button, Card, Col, Empty, Row, Space, Tag, Typography, message } from 'antd';
import type { SkillDto } from '@mossclaw/shared';
import { listSkills, setSkillDisabled } from '../services/api';

const { Title, Paragraph, Text } = Typography;

export function SkillsPage() {
  const [skills, setSkills] = useState<SkillDto[]>([]);

  useEffect(() => {
    listSkills()
      .then((data) => setSkills(data))
      .catch((error) => {
        console.error('Failed to load skills:', error);
      });
  }, []);

  const handleToggle = async (skill: SkillDto) => {
    try {
      const updated = await setSkillDisabled(skill.id, !skill.isDisabled);
      setSkills((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      message.success(skill.isDisabled ? '技能已启用' : '技能已禁用');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '更新技能状态失败');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            技能市场
          </Title>
          <Text type="secondary">浏览内置技能，查看分类、版本和启用状态。</Text>
        </div>

        {skills.length === 0 ? (
          <Card variant="borderless">
            <Empty description="暂无技能数据" />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {skills.map((skill) => (
              <Col key={skill.id} span={8}>
                <Card
                  variant="borderless"
                  title={skill.name}
                  extra={<Tag color={skill.isDisabled ? 'default' : 'blue'}>{skill.category}</Tag>}
                >
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Paragraph ellipsis={{ rows: 3 }}>{skill.description}</Paragraph>
                    <Space wrap>
                      <Tag>{skill.version}</Tag>
                      {skill.isBuiltin ? <Tag color="gold">Builtin</Tag> : null}
                      {skill.isDisabled ? <Tag color="default">Disabled</Tag> : <Tag color="green">Enabled</Tag>}
                    </Space>
                    <Button onClick={() => handleToggle(skill)}>{skill.isDisabled ? '启用' : '禁用'}</Button>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Space>
    </div>
  );
}

export default SkillsPage;
