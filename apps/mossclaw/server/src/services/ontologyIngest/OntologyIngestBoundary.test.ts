import { describe, expect, it } from 'vitest';
import { BadRequestError } from '../../lib/validation';
import { OntologyIngestBoundary } from './OntologyIngestBoundary';

describe('OntologyIngestBoundary', () => {
  it('normalizes preview request into shared DTO shape', () => {
    const boundary = new OntologyIngestBoundary();

    expect(
      boundary.normalizePreviewRequest({
        source: {
          kind: 'json',
          records: [{ id: 'order-001' }]
        },
        objects: [
          {
            objectType: 'Order',
            objectId: 'order-001',
            displayName: 'Order 001',
            state: 'PendingReview',
            properties: {
              amount: 100
            }
          }
        ],
        options: {
          dryRun: true,
          upsert: false
        }
      })
    ).toEqual({
      source: {
        kind: 'json',
        records: [{ id: 'order-001' }]
      },
      objects: [
        {
          objectType: 'Order',
          objectId: 'order-001',
          displayName: 'Order 001',
          state: 'PendingReview',
          properties: {
            amount: 100
          }
        }
      ],
      options: {
        dryRun: true,
        upsert: false
      }
    });
  });

  it('normalizes job id', () => {
    const boundary = new OntologyIngestBoundary();
    expect(boundary.normalizeJobId(' ingest-job-001 ')).toBe('ingest-job-001');
  });

  it('rejects malformed payload', () => {
    const boundary = new OntologyIngestBoundary();

    expect(() => boundary.normalizePreviewRequest(null)).toThrowError(BadRequestError);
    expect(() =>
      boundary.normalizePreviewRequest({
        source: {
          kind: 'json'
        },
        objects: {}
      })
    ).toThrowError(new BadRequestError('objects must be an array'));
  });
});
