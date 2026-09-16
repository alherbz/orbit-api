import mongoose from 'mongoose';

// MongoDB is optional, exactly like Postgres, Redis and RabbitMQ elsewhere in
// this service: the API must start and serve tasks without MONGODB_URL, so the
// audit log degrades to a no-op instead of keeping the node from booting.
const MONGODB_URL = process.env.MONGODB_URL;
const AUDIT_COLLECTION = 'audit_events';
// Server selection alone defaults to 30s, and initAudit() is awaited before
// app.listen(): an unreachable Mongo would otherwise hold the port shut for
// half a minute on every boot. An optional log is not worth that delay.
const CONNECT_TIMEOUT_MS = 5000;

let ready = false;
let log = console;

const auditEventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    at: { type: Date, default: Date.now },
  },
  { collection: AUDIT_COLLECTION },
);

// Compiling the model needs no live connection: mongoose registers it on the
// default connection and resolves it if and when that connection opens.
const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);

// Opens the single default mongoose connection. Never throws: a database that
// is absent or unreachable leaves `ready` false and recordEvent() answers
// false, so the caller never has to guard the call.
export async function initAudit(logger) {
  if (logger) log = logger;
  if (!MONGODB_URL) {
    log.warn('MONGODB_URL not set — audit log disabled');
    return;
  }
  // The connection is an EventEmitter: an unhandled 'error' would take the
  // process down. These also carry the flag across a drop and a reconnect,
  // which mongoose performs on its own.
  mongoose.connection.on('error', (err) => log.error({ err }, 'mongodb connection error'));
  mongoose.connection.on('disconnected', () => {
    ready = false;
    log.warn('mongodb disconnected — audit log disabled');
  });
  mongoose.connection.on('connected', () => {
    ready = true;
  });
  try {
    await mongoose.connect(MONGODB_URL, { serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS });
    ready = true;
    log.info({ collection: AUDIT_COLLECTION }, 'audit log ready');
  } catch (err) {
    log.error({ err }, 'mongodb unreachable — audit log disabled');
  }
}

// Records one audit event. Returns false when the audit log is disabled or the
// write fails. The `ready` gate is what makes that cheap: mongoose BUFFERS a
// write issued with no connection and rejects it 10s later, so an ungated call
// would cost every caller a timeout instead of an immediate no-op.
export async function recordEvent(name, payload = {}) {
  if (!ready) return false;
  try {
    await AuditEvent.create({ name, payload, at: new Date() });
    return true;
  } catch (err) {
    log.error({ err, event: name }, 'audit event not recorded');
    return false;
  }
}

export const auditCollection = AUDIT_COLLECTION;
