// Finite initialization against task-local MinIO, using the API's locked SDK.
import { S3Client, ListBucketsCommand, CreateBucketCommand } from '@aws-sdk/client-s3';

const client = new S3Client({
  endpoint: 'http://minio:9000',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId: 'orbit', secretAccessKey: 'orbit-secret' },
  maxAttempts: 1,
  requestHandler: { connectionTimeout: 1000, requestTimeout: 2000 },
});

try {
  const deadline = Date.now() + 60_000;
  while (true) {
    try {
      const { Buckets } = await client.send(new ListBucketsCommand({}));
      if (!Buckets.some(({ Name }) => Name === 'orbit-attachments')) {
        await client.send(new CreateBucketCommand({ Bucket: 'orbit-attachments' }));
      }
      console.log('[storage] orbit-attachments bucket ready');
      break;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
} finally {
  client.destroy();
}
