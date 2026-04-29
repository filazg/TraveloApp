const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://kl-admin1:kl-admin123@209.38.200.220';
const EXCHANGE = 'travelo_backoffice_events';

let connection = null;
let channel = null;
let connecting = null;

const ensureChannel = async () => {
    if (channel) return channel;
    if (connecting) return connecting;
    connecting = (async () => {
        try {
            connection = await amqp.connect(RABBITMQ_URL);
            connection.on('error', (err) => {
                console.log('publisher connection error:', err?.message || err);
                channel = null;
                connection = null;
            });
            connection.on('close', () => {
                channel = null;
                connection = null;
            });
            channel = await connection.createChannel();
            await channel.assertExchange(EXCHANGE, 'fanout', { durable: false });
            return channel;
        } finally {
            connecting = null;
        }
    })();
    return connecting;
};

const publishBackofficeEvent = async (path, payload = {}) => {
    try {
        const ch = await ensureChannel();
        const msg = Buffer.from(JSON.stringify({ path, payload, ts: Date.now() }));
        ch.publish(EXCHANGE, '', msg);
    } catch (error) {
        console.log('publishBackofficeEvent error:', error?.message || error);
        channel = null;
        connection = null;
    }
};

module.exports = { publishBackofficeEvent };
