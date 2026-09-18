import { connect, credentials } from 'amqplib';

// RabbitMQ is optional, exactly like Postgres and Redis in server.js: the API
// must start and serve tasks without RABBITMQ_URL, so publishing degrades to a
// no-op instead of keeping the service from booting.
const RABBITMQ_URL = process.env.RABBITMQ_URL;
// The address may be handed over without a secret in it; the secret then comes
// on its own, in RABBITMQ_PASSWORD.
const RABBITMQ_PASSWORD = process.env.RABBITMQ_PASSWORD;
const TASKS_QUEUE = process.env.TASKS_QUEUE || 'orbit.tasks';

let channel = null;
let log = console;

// amqplib reads the credentials off the URL's userinfo, so an address carrying
// a user but no password authenticates with an EMPTY password. When
// RABBITMQ_PASSWORD is set and the URL has none, pass it explicitly instead.
// `credentials` in the connect options REPLACES the URL's userinfo wholesale,
// so the username has to travel with it: the one the URL states, or 'guest',
// which is the same default amqplib applies to a URL with no userinfo at all.
function connectOptions(url) {
  if (!RABBITMQ_PASSWORD) return undefined;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    // Not our job to validate the address — leave it to connect(), which fails
    // the same way it does today.
    return undefined;
  }
  // A password in the URL wins: it is the more specific statement.
  if (parsed.password) return undefined;
  const user = parsed.username ? decodeURIComponent(parsed.username) : 'guest';
  return { credentials: credentials.plain(user, RABBITMQ_PASSWORD) };
}

// Opens one connection and one channel, and asserts the durable queue the
// publisher writes to. Never throws: a broker that is absent or unreachable
// leaves `channel` null and publish() answers false. Answers whether the
// publisher came up, so the boot summary can state it in one place.
export async function initQueue(logger) {
  if (logger) log = logger;
  if (!RABBITMQ_URL) {
    log.warn('RABBITMQ_URL not set — queue publishing disabled');
    return false;
  }
  try {
    const conn = await connect(RABBITMQ_URL, connectOptions(RABBITMQ_URL));
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
    return true;
  } catch (err) {
    log.error({ err }, 'rabbitmq unreachable — queue publishing disabled');
    return false;
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
