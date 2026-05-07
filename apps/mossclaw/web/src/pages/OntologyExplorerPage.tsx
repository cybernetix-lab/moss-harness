import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Space,
  Tag,
  Typography
} from 'antd';
import { ExplorerBreadcrumbs } from '../components/ontology-explorer/ExplorerBreadcrumbs';
import { ExplorerToolbar } from '../components/ontology-explorer/ExplorerToolbar';
import { GraphStatsBar } from '../components/ontology-explorer/GraphStatsBar';
import { GraphViewport } from '../components/ontology-explorer/GraphViewport';
import { InstanceListTab } from '../components/ontology-explorer/InstanceListTab';
import { LoopAnalysisTab } from '../components/ontology-explorer/LoopAnalysisTab';
import { ObjectDetailTab } from '../components/ontology-explorer/ObjectDetailTab';
import { SchemaNavPanel } from '../components/ontology-explorer/SchemaNavPanel';
import { TypeDetailTab } from '../components/ontology-explorer/TypeDetailTab';
import { useOntologyExplorerController } from '../hooks/ontology-explorer/useOntologyExplorerController';

const { Paragraph, Text, Title } = Typography;

export function OntologyExplorerPage() {
  const { urlState, sessionState, derived, mockScenarios, actions } = useOntologyExplorerController();

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ display: 'flex' }}>
        <div>
          <Space size={12} align="center" wrap>
            <Title level={2} style={{ margin: 0 }}>
              Ontology Explorer
            </Title>
            <Tag color="blue">MVP</Tag>
            <Tag color="gold">Shell</Tag>
          </Space>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            面向本体 schema 与实例钻取的探索入口。当前阶段先提供稳定的页面骨架、空态文案和后续组件插槽。
          </Paragraph>
        </div>

        <Alert
          type="info"
          showIcon
          message="Explorer Shell 已就绪"
          description="当前已接入 Task 7 的 controller 与 URL state。你可以通过下面的 mock 场景快速切换搜索、模式和 loop 高亮状态，验证刷新与深链接行为。"
        />

        <ExplorerToolbar
          mode={urlState.mode}
          searchQuery={urlState.q}
          depth={urlState.depth}
          stateFilter={urlState.state}
          canGoBack={Boolean(urlState.type || urlState.objectId || urlState.loopId)}
          onSetMode={actions.setMode}
          onSetSearchQuery={actions.setSearchQuery}
          onReset={actions.resetExplorer}
          onGoBack={actions.goBack}
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={6}>
            <SchemaNavPanel
              loading={derived.typeProjectionLoading}
              error={derived.typeProjectionError}
              groups={derived.planeGroups}
              selectedType={urlState.type}
              onSelectType={(objectType) => actions.selectType(objectType)}
            />
          </Col>

          <Col xs={24} lg={12}>
            <Space direction="vertical" size={16} style={{ display: 'flex' }}>
              <Card>
                <Space wrap style={{ marginBottom: 16 }}>
                  {mockScenarios.map((scenario) => (
                    <Tag
                      key={scenario.id}
                      color="default"
                      style={{ cursor: 'pointer', marginInlineEnd: 0 }}
                      onClick={() => actions.applyMockScenario(scenario)}
                    >
                      {scenario.label}
                    </Tag>
                  ))}
                </Space>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  当前 URL 状态：{derived.querySummary}
                </Paragraph>
              </Card>
              <ExplorerBreadcrumbs
                items={sessionState.breadcrumbTrail}
                onNavigate={actions.navigateBreadcrumb}
              />
              <GraphViewport
                loading={derived.localSubgraphLoading}
                error={derived.localSubgraphError}
                subgraph={derived.localSubgraph}
                selectedLoop={derived.selectedLoop}
                onFocusNode={actions.focusGraphNode}
              />
            </Space>
          </Col>

          <Col xs={24} lg={6}>
            <Space direction="vertical" size={16} style={{ display: 'flex' }}>
              <TypeDetailTab currentType={derived.currentType} />
              <InstanceListTab
                loading={derived.instanceCollectionLoading}
                error={derived.instanceCollectionError}
                items={derived.instanceItems}
                totalCount={derived.instanceTotalCount}
                filteredCount={derived.instanceFilteredCount}
                focusedObjectId={urlState.objectId}
                onOpenObject={(objectType, objectId) => actions.focusObject(objectType, objectId)}
              />
              <ObjectDetailTab
                loading={derived.objectDetailLoading}
                error={derived.objectDetailError}
                objectDetail={derived.objectDetail}
              />
              <Card title="Detail State">
                <Space direction="vertical" size={8} style={{ display: 'flex' }}>
                  <Text type="secondary">Active Tab：{sessionState.activeSidebarTab}</Text>
                  <Text type="secondary">Selected Loop：{derived.currentLoopLabel}</Text>
                  <Space wrap>
                    <Button onClick={() => actions.setActiveSidebarTab('overview')}>Overview</Button>
                    <Button onClick={() => actions.setActiveSidebarTab('loops')}>Loops</Button>
                  </Space>
                </Space>
              </Card>
              <LoopAnalysisTab
                loading={derived.loopAnalysisLoading}
                error={derived.loopAnalysisError}
                loops={derived.loops}
                selectedLoopId={urlState.loopId}
                onSelectLoop={actions.selectLoop}
              />
            </Space>
          </Col>
        </Row>

        <GraphStatsBar
          stats={{
            nodeCount: derived.localSubgraphStats?.nodeCount ?? 0,
            edgeCount: derived.localSubgraphStats?.edgeCount ?? 0,
            loopCount: derived.loops.length,
            focusLabel: derived.focusedNodeLabel
          }}
        />
      </Space>
    </div>
  );
}

export default OntologyExplorerPage;
