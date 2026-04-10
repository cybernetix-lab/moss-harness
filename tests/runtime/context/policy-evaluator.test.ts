import * as informationQualityModule from '../../../runtime/telemetry/information-quality.ts';
import * as policyEvaluatorModule from '../../../runtime/context/policy-evaluator.ts';

test('evaluatePolicyInput should analyze telemetry blocks with the balanced profile', () => {
  const { InformationQualityAnalyzer } = informationQualityModule;
  const { evaluatePolicyInput } = policyEvaluatorModule;
  const analyzer = new InformationQualityAnalyzer();
  const blockSignals = analyzer.analyzeBlock('repeat repeat repeat repeat');

  expect(typeof blockSignals.normalizedEntropy).toBe('number');
  expect(typeof blockSignals.densityNorm).toBe('number');
  expect(typeof blockSignals.ngramRedundancy).toBe('number');

  const result = evaluatePolicyInput({
    policyPath: '/Users/bytedance/Projects/agent-harness-spec/runtime/context/compaction-policy.yaml',
    profile: 'balanced',
    blocks: [
      {
        id: 'block-1',
        type: 'tool_log',
        content: 'repeat repeat repeat repeat',
      },
    ],
  });

  expect(result.profile).toBe('balanced');
  expect(result.decisions).toHaveLength(1);
  expect(result.decisions[0]?.compressionPotential).toBe(blockSignals.compressionPotential);
});
