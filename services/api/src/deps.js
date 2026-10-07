import pg from 'pg';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

// Task events go to the worker (services/worker), which writes the activity feed.
export const events = new Queue('task-events', { connection: redis });

export const s3 = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});

// The bucket is created by the infrastructure (deploy/main.tf; locally the
// `createbuckets` service of docker-compose.yml) — the API never creates it.
// Each probe answers within 2 s: a dependency that hangs reads as down.
function within(ms, promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`no answer in ${ms} ms`)), ms)),
  ]);
}

async function probe(fn) {
  try {
    return (await within(2000, fn())) ?? 'ok';
  } catch (err) {
    return `down: ${err.name && err.name !== 'Error' ? err.name : err.message}`;
  }
}

export async function checkDeps() {
  const [postgres, redisState, s3State] = await Promise.all([
    probe(async () => {
      const { rows } = await pool.query("SELECT to_regclass('public.tasks') IS NOT NULL AS migrated");
      return rows[0].migrated ? 'ok' : 'not migrated (run npm run migrate)';
    }),
    probe(() => redis.ping().then(() => 'ok')),
    probe(() => s3.send(new HeadBucketCommand({ Bucket: config.s3.bucket })).then(() => 'ok')),
  ]);
  return { postgres, redis: redisState, s3: s3State };
}
