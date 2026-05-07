import { Layout, Menu } from 'antd';
import {
  ApartmentOutlined,
  DashboardOutlined,
  PlusOutlined,
  SettingOutlined,
  ToolOutlined
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const { Header, Content, Sider } = Layout;

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = location.pathname.startsWith('/skills')
    ? '/skills'
    : location.pathname.startsWith('/ontology/explorer')
      ? '/ontology/explorer'
    : location.pathname.startsWith('/tasks/new')
      ? '/tasks/new'
      : '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={250} theme="dark">
        <div
          style={{
            height: 64,
            margin: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1677ff',
            fontSize: 24,
            fontWeight: 'bold',
          }}
        >
          MossClaw
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={[
            {
              key: '/',
              icon: <DashboardOutlined />,
              label: '工作台',
              onClick: () => navigate('/'),
            },
            {
              key: '/tasks/new',
              icon: <PlusOutlined />,
              label: '新建任务',
              onClick: () => navigate('/tasks/new'),
            },
            {
              key: '/skills',
              icon: <ToolOutlined />,
              label: '技能市场',
              onClick: () => navigate('/skills'),
            },
            {
              key: '/ontology/explorer',
              icon: <ApartmentOutlined />,
              label: '本体探索',
              onClick: () => navigate('/ontology/explorer'),
            },
            {
              key: '/settings',
              icon: <SettingOutlined />,
              label: '系统设置',
              disabled: true,
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: '#141414' }} />
        <Content style={{ margin: '0 16px', overflow: 'initial' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default AppShell;
