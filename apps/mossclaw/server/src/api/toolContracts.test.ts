import { describe, expectTypeOf, it } from 'vitest';
import type {
  ToolDescriptorDto,
  ToolErrorDto,
  ToolExampleDto,
  ToolInvokeErrorDto,
  ToolInvokeRequestDto,
  ToolInvokeResultDto,
  ToolInvokeSuccessDto
} from '@mossclaw/shared';

describe('tool gateway shared contracts', () => {
  it('暴露稳定的 tool descriptor dto 契约', () => {
    const tool = {
      name: 'ontology.get_schema',
      category: 'ontology',
      description: 'Return ontology schema',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      outputSchema: {
        type: 'object',
        properties: {
          objectTypes: {
            type: 'array'
          }
        }
      },
      errors: [
        {
          errorCode: 'SCHEMA_UNAVAILABLE',
          description: 'Schema could not be loaded'
        }
      ],
      examples: [
        {
          input: {},
          output: {
            objectTypes: []
          }
        }
      ]
    } satisfies ToolDescriptorDto;

    expectTypeOf(tool).toMatchTypeOf<ToolDescriptorDto>();
    expectTypeOf<ToolDescriptorDto['errors']>().toEqualTypeOf<ToolErrorDto[]>();
    expectTypeOf<NonNullable<ToolDescriptorDto['examples']>>().toEqualTypeOf<
      ToolExampleDto[]
    >();
    expectTypeOf(tool.inputSchema).toMatchTypeOf<Record<string, unknown>>();
    expectTypeOf(tool.outputSchema).toMatchTypeOf<Record<string, unknown>>();
    expectTypeOf(tool.errors).toMatchTypeOf<ToolErrorDto[]>();
    expectTypeOf(tool.errors[0]).toMatchTypeOf<ToolErrorDto>();
    expectTypeOf(tool.examples).toMatchTypeOf<ToolExampleDto[] | undefined>();
    expectTypeOf(tool.examples?.[0]).toMatchTypeOf<ToolExampleDto | undefined>();
    expectTypeOf(tool.examples?.[0]?.input).toMatchTypeOf<
      Record<string, unknown> | undefined
    >();
    expectTypeOf(tool.examples?.[0]?.output).toMatchTypeOf<
      Record<string, unknown> | undefined
    >();
  });

  it('暴露稳定的 tool invoke dto 契约', () => {
    type SuccessResult = Extract<ToolInvokeResultDto, { ok: true }>;
    type ErrorResult = Extract<ToolInvokeResultDto, { ok: false }>;

    const request = {
      arguments: {
        objectType: 'Order',
        objectId: 'order-001'
      }
    } satisfies ToolInvokeRequestDto;
    const success = {
      ok: true,
      toolName: 'ontology.get_object',
      result: {
        objectId: 'order-001'
      }
    } satisfies SuccessResult;
    const error = {
      ok: false,
      toolName: 'ontology.get_object',
      error: 'Ontology object not found',
      errorCode: 'OBJECT_NOT_FOUND'
    } satisfies ErrorResult;
    const result: ToolInvokeResultDto = Math.random() > 0.5 ? success : error;

    expectTypeOf(request).toMatchTypeOf<ToolInvokeRequestDto>();
    expectTypeOf<SuccessResult>().toEqualTypeOf<ToolInvokeSuccessDto>();
    expectTypeOf<ErrorResult>().toEqualTypeOf<ToolInvokeErrorDto>();
    expectTypeOf(request.arguments).toMatchTypeOf<Record<string, unknown> | undefined>();
    expectTypeOf(success).toMatchTypeOf<ToolInvokeSuccessDto>();
    expectTypeOf(success).toMatchTypeOf<SuccessResult>();
    expectTypeOf(success.result).toMatchTypeOf<unknown>();
    expectTypeOf(error).toMatchTypeOf<ToolInvokeErrorDto>();
    expectTypeOf(error).toMatchTypeOf<ErrorResult>();
    expectTypeOf(error.errorCode).toMatchTypeOf<string>();
    expectTypeOf(result).toMatchTypeOf<ToolInvokeResultDto>();
    expectTypeOf(result).toMatchTypeOf<SuccessResult | ErrorResult>();
  });
});
