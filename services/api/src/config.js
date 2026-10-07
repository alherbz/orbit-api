// Every dependency is required: the API refuses to start with a clear message
// instead of degrading silently. MAIL_API_KEY stays optional (sharing answers
// 503 until it is set).
function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] ${name} is required — see README.md "Configuration"`);
    process.exit(1);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 8083),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),
  // HMAC secret for public task links (GET /api/public/tasks/:token).
  signingSecret: required('ORBIT_SIGNING_SECRET'),
  s3: {
    endpoint: required('S3_ENDPOINT'),
    region: process.env.S3_REGION || 'us-east-1',
    bucket: required('S3_BUCKET'),
    accessKeyId: required('S3_ACCESS_KEY_ID'),
    secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
  },
  mailApiKey: process.env.MAIL_API_KEY,
  mailFrom: process.env.MAIL_FROM || 'orbit@example.com',
};
