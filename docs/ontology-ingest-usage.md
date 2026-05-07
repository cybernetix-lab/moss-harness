# OntologyIngest Usage

This guide shows how to call the current `OntologyIngest` MVP through:

- Direct HTTP API
- Tool Gateway invoke API

The examples below match the current implementation in `apps/mossclaw/server`.

## Prerequisites

Start the server first. Replace the base URL if your local port is different.

```bash
cd apps/mossclaw/server
npm run dev
```

Assume the server is available at:

```bash
export MOSSCLAW_BASE_URL="http://127.0.0.1:3000"
```

## Request Shape

Current ingest requests use the following shape:

```json
{
  "source": {
    "kind": "json",
    "records": [
      {
        "objectId": "order-001"
      }
    ]
  },
  "objects": [
    {
      "objectType": "Order",
      "objectId": "order-001",
      "displayName": "Order 001",
      "state": "PendingReview",
      "properties": {
        "amount": 100,
        "riskLevel": "Medium"
      }
    }
  ],
  "options": {
    "dryRun": false,
    "upsert": true
  }
}
```

## HTTP API

### Preview Ingest

This endpoint validates the request and returns a dry-run preview without persisting:

- `ontology_ingest_jobs`
- `ontology_ingest_reports`
- `ontology_objects`

```bash
curl -X POST "$MOSSCLAW_BASE_URL/api/ontology/ingest/preview" \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "kind": "json",
      "records": [
        {
          "objectId": "order-preview-001"
        }
      ]
    },
    "objects": [
      {
        "objectType": "Order",
        "objectId": "order-preview-001",
        "displayName": "Order Preview 001",
        "state": "PendingReview",
        "properties": {
          "amount": 100,
          "riskLevel": "Medium"
        }
      }
    ]
  }'
```

Example response:

```json
{
  "ok": true,
  "preview": {
    "dryRun": true,
    "summary": {
      "totalRecords": 1,
      "acceptedRecords": 1,
      "rejectedRecords": 0,
      "createdObjects": 0,
      "updatedObjects": 0,
      "skippedObjects": 1
    },
    "diagnostics": [],
    "sampleObjects": [
      {
        "objectType": "Order",
        "objectId": "order-preview-001",
        "displayName": "Order Preview 001",
        "state": "PendingReview",
        "properties": {
          "amount": 100,
          "riskLevel": "Medium"
        }
      }
    ]
  }
}
```

### Submit Ingest

This endpoint creates a job, persists accepted objects, and stores the ingest report.

```bash
curl -X POST "$MOSSCLAW_BASE_URL/api/ontology/ingest/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "kind": "json",
      "records": [
        {
          "objectId": "order-submit-001"
        }
      ]
    },
    "objects": [
      {
        "objectType": "Order",
        "objectId": "order-submit-001",
        "displayName": "Order Submit 001",
        "state": "PendingReview",
        "properties": {
          "amount": 80,
          "riskLevel": "Low"
        }
      }
    ],
    "options": {
      "upsert": true
    }
  }'
```

Example response:

```json
{
  "ok": true,
  "job": {
    "jobId": "ingest-job-001",
    "status": "succeeded",
    "createdAt": "2026-04-29T10:00:00.000Z",
    "startedAt": "2026-04-29T10:00:00.000Z",
    "finishedAt": "2026-04-29T10:00:00.000Z",
    "source": {
      "kind": "json",
      "records": [
        {
          "objectId": "order-submit-001"
        }
      ]
    },
    "summary": {
      "totalRecords": 1,
      "acceptedRecords": 1,
      "rejectedRecords": 0,
      "createdObjects": 1,
      "updatedObjects": 0,
      "skippedObjects": 0
    }
  }
}
```

### Get Ingest Job

```bash
curl "$MOSSCLAW_BASE_URL/api/ontology/ingest/jobs/ingest-job-001"
```

Example response:

```json
{
  "job": {
    "jobId": "ingest-job-001",
    "status": "succeeded",
    "createdAt": "2026-04-29T10:00:00.000Z",
    "startedAt": "2026-04-29T10:00:00.000Z",
    "finishedAt": "2026-04-29T10:00:00.000Z",
    "source": {
      "kind": "json",
      "records": [
        {
          "objectId": "order-submit-001"
        }
      ]
    },
    "summary": {
      "totalRecords": 1,
      "acceptedRecords": 1,
      "rejectedRecords": 0,
      "createdObjects": 1,
      "updatedObjects": 0,
      "skippedObjects": 0
    }
  }
}
```

### Get Ingest Report

```bash
curl "$MOSSCLAW_BASE_URL/api/ontology/ingest/jobs/ingest-job-001/report"
```

Example response:

```json
{
  "report": {
    "jobId": "ingest-job-001",
    "dryRun": false,
    "summary": {
      "totalRecords": 1,
      "acceptedRecords": 1,
      "rejectedRecords": 0,
      "createdObjects": 1,
      "updatedObjects": 0,
      "skippedObjects": 0
    },
    "diagnostics": [],
    "sampleObjects": [
      {
        "objectType": "Order",
        "objectId": "order-submit-001",
        "displayName": "Order Submit 001",
        "state": "PendingReview",
        "properties": {
          "amount": 80,
          "riskLevel": "Low"
        }
      }
    ]
  }
}
```

## Tool Gateway

The same ingest capability is also exposed through Tool Gateway.

Available tool names:

- `ontology.ingest_preview`
- `ontology.ingest_submit`

### List Tools

```bash
curl "$MOSSCLAW_BASE_URL/api/tools"
```

### Invoke `ontology.ingest_preview`

```bash
curl -X POST "$MOSSCLAW_BASE_URL/api/tools/ontology.ingest_preview/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "source": {
        "kind": "json",
        "records": [
          {
            "objectId": "tool-preview-001"
          }
        ]
      },
      "objects": [
        {
          "objectType": "Order",
          "objectId": "tool-preview-001",
          "displayName": "Tool Preview 001",
          "state": "PendingReview",
          "properties": {
            "amount": 100
          }
        }
      ]
    }
  }'
```

Example response:

```json
{
  "ok": true,
  "toolName": "ontology.ingest_preview",
  "result": {
    "ok": true,
    "preview": {
      "dryRun": true,
      "summary": {
        "totalRecords": 1,
        "acceptedRecords": 1,
        "rejectedRecords": 0,
        "createdObjects": 0,
        "updatedObjects": 0,
        "skippedObjects": 1
      },
      "diagnostics": [],
      "sampleObjects": [
        {
          "objectType": "Order",
          "objectId": "tool-preview-001",
          "displayName": "Tool Preview 001",
          "state": "PendingReview",
          "properties": {
            "amount": 100
          }
        }
      ]
    }
  }
}
```

### Invoke `ontology.ingest_submit`

```bash
curl -X POST "$MOSSCLAW_BASE_URL/api/tools/ontology.ingest_submit/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "source": {
        "kind": "json",
        "records": [
          {
            "objectId": "tool-submit-001"
          }
        ]
      },
      "objects": [
        {
          "objectType": "Order",
          "objectId": "tool-submit-001",
          "displayName": "Tool Submit 001",
          "state": "PendingReview",
          "properties": {
            "amount": 80
          }
        }
      ],
      "options": {
        "upsert": true
      }
    }
  }'
```

Example response:

```json
{
  "ok": true,
  "toolName": "ontology.ingest_submit",
  "result": {
    "ok": true,
    "job": {
      "jobId": "ingest-job-001",
      "status": "succeeded",
      "createdAt": "2026-04-29T10:00:00.000Z",
      "startedAt": "2026-04-29T10:00:00.000Z",
      "finishedAt": "2026-04-29T10:00:00.000Z",
      "source": {
        "kind": "json",
        "records": [
          {
            "objectId": "tool-submit-001"
          }
        ]
      },
      "summary": {
        "totalRecords": 1,
        "acceptedRecords": 1,
        "rejectedRecords": 0,
        "createdObjects": 1,
        "updatedObjects": 0,
        "skippedObjects": 0
      }
    }
  }
}
```

## Notes

- `preview` is read-only and should not create `job`, `report`, or `ontology object` rows.
- `submit` writes through the ingest pipeline and persists both the ingest job and accepted ontology objects.
- Current examples use `kind: "json"` because that is the most direct path for local verification.
- `source.records` is optional from a type perspective, but including it makes ingest provenance easier to inspect in job responses.
