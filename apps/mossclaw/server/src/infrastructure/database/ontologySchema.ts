import type { IStorage } from '@agent-harness/core/storage/types';
import type { OntologyObject } from '../../domain/models/ontology/OntologyObject';
import type { OntologyObjectType } from '../../domain/models/ontology/OntologySchema';

const SEEDED_OBJECT_TYPES: OntologyObjectType[] = [
  {
    objectType: 'Order',
    description: '订单对象',
    properties: [
      { name: 'amount', type: 'number', required: true },
      { name: 'riskLevel', type: 'string', required: true }
    ]
  }
];

const SEEDED_OBJECTS: OntologyObject[] = [
  {
    objectType: 'Order',
    objectId: 'order-001',
    displayName: 'Order 001',
    state: 'PendingReview',
    properties: {
      amount: 1250,
      riskLevel: 'Medium'
    }
  }
];

async function ensureOntologyTables(storage: IStorage): Promise<void> {
  await storage.execute(`CREATE TABLE IF NOT EXISTS ontology_object_types (
    objectType TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    properties TEXT NOT NULL
  );`);

  await storage.execute(`CREATE TABLE IF NOT EXISTS ontology_objects (
    objectType TEXT NOT NULL,
    objectId TEXT NOT NULL,
    displayName TEXT NOT NULL,
    state TEXT NOT NULL,
    properties TEXT NOT NULL,
    PRIMARY KEY (objectType, objectId)
  );`);
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
  await ensureOntologyTables(storage);
  await seedOntologyObjectTypes(storage);
  await seedOntologyObjects(storage);
}
