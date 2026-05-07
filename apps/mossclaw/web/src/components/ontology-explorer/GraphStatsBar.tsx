import { Card, Col, Row, Statistic } from 'antd';
import type { OntologyExplorerGraphStats } from '../../types/ontologyExplorer';

interface GraphStatsBarProps {
  stats: OntologyExplorerGraphStats;
}

export function GraphStatsBar({ stats }: GraphStatsBarProps) {
  return (
    <Card title="Subgraph Stats">
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Statistic title="Nodes" value={stats.nodeCount} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Edges" value={stats.edgeCount} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Cycles" value={stats.loopCount} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Focus" value={stats.focusLabel} />
        </Col>
      </Row>
    </Card>
  );
}

export default GraphStatsBar;
