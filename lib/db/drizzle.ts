import * as schema from './schema';

// Next.js automatically loads .env files, so we don't need dotenv.config()
// This avoids Edge Runtime issues with process.cwd()

// Lazy initialization to avoid Edge Runtime issues
// All Node.js-specific imports are done lazily when actually needed
let clientInstance: any = null;
let dbInstance: any = null;

function initializeDb() {
  // This function will only be called in Node.js runtime (during API routes, server actions, etc.)
  // It will never be called in Edge Runtime (middleware)
  
  if (!process.env?.POSTGRES_URL) {
    throw new Error('POSTGRES_URL environment variable is not set');
  }

  if (!clientInstance) {
    // Lazy import to avoid Edge Runtime issues
    // These will only execute when the function is called (in Node.js runtime)
    const postgresModule = require('postgres');
    // Handle both ESM default export and CommonJS export
    const postgres = postgresModule.default || postgresModule;
    const { drizzle } = require('drizzle-orm/postgres-js');
    
    clientInstance = postgres(process.env.POSTGRES_URL);
    dbInstance = drizzle(clientInstance, { schema });
  }

  return { client: clientInstance, db: dbInstance };
}

export const client = new Proxy({} as any, {
  get(_target, prop) {
    return initializeDb().client[prop];
  },
});

export const db = new Proxy({} as any, {
  get(_target, prop) {
    return initializeDb().db[prop];
  },
});
