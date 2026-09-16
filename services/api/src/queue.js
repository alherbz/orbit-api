import { connect } from 'amqplib';

// RabbitMQ is optional, exactly like Postgres and Redis in server.js: the API
// must start and serve tasks without RABBITMQ_URL, so publishing degrades to a
// no-op instead of keeping the service from booting.
const RABBITMQ_URL = process.env.RABBITMQ_URL;
const TASKS_QUEUE = process.env.TASKS_QUEUE || 'orbit.tasks';

let channel = null;
let log = console;

// Opens one connection and one channel, and asserts the durable queue the
// publisher writes to. Never throws: a broker that is absent or unreachable
// leaves `channel` null and publish() answers false.
export async function initQueue(logger) {
  if (logger) log = logger;
  if (!RABBITMQ_URL) {
    log.warn('RABBITMQ_URL not set — queue publishing disabled');
    return;
  }
  try {
    const conn = await connect(RABBITMQ_URL);
    // Both the connection and the channel are EventEmitters: an unhandled
    // 'error' event would take the process down with it.
    conn.on('error', (err) => log.error({ err }, 'rabbitmq connection error'));
    conn.on('close', () => {
      channel = null;
      log.warn('rabbitmq connection closed — queue publishing disabled');
    });
    const ch = await conn.createChannel();
    ch.on('error', (err) => log.error({ err }, 'rabbitmq channel error'));
    await ch.assertQueue(TASKS_QUEUE, { durable: true });
    channel = ch;
    log.info({ queue: TASKS_QUEUE }, 'rabbitmq publisher ready');
  } catch (err) {
    log.error({ err }, 'rabbitmq unreachable — queue publishing disabled');
  }
}

// Publishes a JSON message on the queue. Returns false when the broker is not
// connected or the write fails, so a caller never has to guard the call.
export function publish(message, queue = TASKS_QUEUE) {
  if (!channel) return false;
  try {
    return channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      contentType: 'application/json',
      persistent: true,
    });
  } catch (err) {
    log.error({ err, queue }, 'queue publish failed');
    return false;
  }
}

export const queueName = TASKS_QUEUE;
