import type { IStorage } from '@agent-harness/core/storage/types';
import type { OntologyObjectDto, OntologyObjectTypeDto } from '@mossclaw/shared';

type SqlExecutor = Pick<IStorage, 'execute'>;

const SEEDED_OBJECT_TYPES: OntologyObjectTypeDto[] = [
  {
    objectType: 'Artifact',
    description: '证据对象',
    properties: [
      { name: 'kind', type: 'string', required: true },
      { name: 'relatedOrder', type: 'string', required: true }
    ]
  },
  {
    objectType: 'Order',
    description: '订单对象',
    properties: [
      { name: 'amount', type: 'number', required: true },
      { name: 'riskLevel', type: 'string', required: true },
      { name: 'review', type: 'string', required: true }
    ]
  },
  {
    objectType: 'Review',
    description: '审核对象',
    properties: [
      { name: 'decision', type: 'string', required: true },
      { name: 'subject', type: 'string', required: true }
    ]
  }
];

const SEEDED_OBJECTS: OntologyObjectDto[] = [
  {
    objectType: 'Artifact',
    objectId: 'artifact-001',
    displayName: 'Artifact 001',
    state: 'Captured',
    properties: {
      kind: 'Document',
      relatedOrder: {
        objectType: 'Order',
        objectId: 'order-001'
      }
    }
  },
  {
    objectType: 'Order',
    objectId: 'order-001',
    displayName: 'Order 001',
    state: 'PendingReview',
    properties: {
      amount: 1250,
      riskLevel: 'Medium',
      review: {
        objectType: 'Review',
        objectId: 'review-001'
      }
    }
  },
  {
    objectType: 'Review',
    objectId: 'review-001',
    displayName: 'Review 001',
    state: 'Open',
    properties: {
      decision: 'Escalate',
      subject: {
        objectType: 'Order',
        objectId: 'order-001'
      }
    }
  }
];

const ONTOLOGY_OBJECT_TYPES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ontology_object_types (
    objectType TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    properties TEXT NOT NULL
  );`;

const ONTOLOGY_OBJECTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ontology_objects (
    objectType TEXT NOT NULL,
    objectId TEXT NOT NULL,
    displayName TEXT NOT NULL,
    state TEXT NOT NULL,
    properties TEXT NOT NULL,
    PRIMARY KEY (objectType, objectId),
    FOREIGN KEY (objectType) REFERENCES ontology_object_types(objectType)
  );`;

async function createOntologyObjectsTable(executor: SqlExecutor): Promise<void> {
  await executor.execute(ONTOLOGY_OBJECTS_TABLE_SQL);
}

async function hasTable(storage: IStorage, tableName: string): Promise<boolean> {
  const result = await storage.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName]
  );

  return result.rowCount > 0;
}

async function hasOntologyObjectTypeForeignKey(storage: IStorage): Promise<boolean> {
  const result = await storage.execute("PRAGMA foreign_key_list('ontology_objects')");

  return result.rows.some(
    (row) =>
      row.from === 'objectType' &&
      row.table === 'ontology_object_types' &&
      row.to === 'objectType'
  );
}

async function rebuildOntologyObjectsTableWithForeignKey(storage: IStorage): Promise<void> {
  await storage.transaction(async (trx) => {
    await trx.execute('ALTER TABLE ontology_objects RENAME TO ontology_objects_legacy');
    await createOntologyObjectsTable(trx);
    await trx.execute(`INSERT INTO ontology_objects (objectType, objectId, displayName, state, properties)
      SELECT objectType, objectId, displayName, state, properties
      FROM ontology_objects_legacy`);
    await trx.execute('DROP TABLE ontology_objects_legacy');
  });
}

async function ensureOntologyObjectTypesTable(storage: IStorage): Promise<void> {
  await storage.execute(ONTOLOGY_OBJECT_TYPES_TABLE_SQL);
}

async function ensureOntologyObjectsTable(storage: IStorage): Promise<void> {
  if (!(await hasTable(storage, 'ontology_objects'))) {
    await createOntologyObjectsTable(storage);
    return;
  }

  if (!(await hasOntologyObjectTypeForeignKey(storage))) {
    await rebuildOntologyObjectsTableWithForeignKey(storage);
  }
}

async function seedOntologyObjectTypes(storage: IStorage): Promise<void> {
  for (const item of SEEDED_OBJECT_TYPES) {
    await storage.execute(
      'INSERT OR IGNORE INTO ontology_object_types (objectType, description, properties) VALUES (?, ?, ?)',
      [item.objectType, item.description ?? '', JSON.stringify(item.properties)]
    );
  }
}

async function seedOntologyObjects(storage: IStorage): Promise<void> {
  for (const item of SEEDED_OBJECTS) {
    await storage.execute(
      'INSERT OR IGNORE INTO ontology_objects (objectType, objectId, displayName, state, properties) VALUES (?, ?, ?, ?, ?)',
      [item.objectType, item.objectId, item.displayName, item.state, JSON.stringify(item.properties)]
    );
  }
}

export async function ensureOntologySchema(storage: IStorage): Promise<void> {
  await ensureOntologyObjectTypesTable(storage);
  await seedOntologyObjectTypes(storage);
  await ensureOntologyObjectsTable(storage);
  await seedOntologyObjects(storage);
}
