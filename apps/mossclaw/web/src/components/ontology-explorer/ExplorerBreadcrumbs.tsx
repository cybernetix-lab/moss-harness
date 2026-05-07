import { Breadcrumb, Button, Card, Empty } from 'antd';
import type { ExplorerBreadcrumb } from '../../types/ontologyExplorer';

interface ExplorerBreadcrumbsProps {
  items: ExplorerBreadcrumb[];
  onNavigate: (item: ExplorerBreadcrumb) => void;
}

export function ExplorerBreadcrumbs({ items, onNavigate }: ExplorerBreadcrumbsProps) {
  return (
    <Card size="small" title="Navigation Path">
      {items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="选择类型或对象后，这里会展示当前的钻取路径。"
        />
      ) : (
        <Breadcrumb
          items={items.map((item) => ({
            key: item.id,
            title: (
              <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => onNavigate(item)}>
                {item.label}
              </Button>
            )
          }))}
        />
      )}
    </Card>
  );
}

export default ExplorerBreadcrumbs;
