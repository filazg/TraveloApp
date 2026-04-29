const amqp = require('amqplib');
const {
    syncUsersDataController,
    syncTerminalsDataController,
    syncPartnersWebUsersDataController,
    syncPartnersApiUsersDataController,
} = require('./syncControllers/syncBackOfficeServiceController');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://kl-admin1:kl-admin123@209.38.200.220';
const EXCHANGE = 'travelo_backoffice_events';

const handleEvent = async (message) => {
    switch (message.path) {
        case 'update_users':
            console.log('event: update_users → resync');
            await syncUsersDataController();
            break;
        case 'update_terminals':
            console.log('event: update_terminals → resync');
            await syncTerminalsDataController();
            break;
        case 'update_partners':
            console.log('event: update_partners → resync web+api users');
            await syncPartnersWebUsersDataController();
            await syncPartnersApiUsersDataController();
            break;
        default:
            // unknown event — ignore
            break;
    }
};

const startSubscriber = async (queueName) => {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        connection.on('error', (err) => {
            console.log('subscriber connection error:', err?.message || err);
        });
        connection.on('close', () => {
            console.log('subscriber connection closed; reconnecting in 5s');
            setTimeout(() => startSubscriber(queueName), 5000);
        });

        const channel = await connection.createChannel();
        await channel.assertExchange(EXCHANGE, 'fanout', { durable: false });
        const q = await channel.assertQueue(queueName, { durable: false });
        await channel.bindQueue(q.queue, EXCHANGE, '');

        // Legacy queue (kept for backwards compat — old publishers used direct sendToQueue).
        channel.consume(q.queue, async (msg) => {
            if (!msg) return;
            try {
                const message = JSON.parse(msg.content.toString());
                await handleEvent(message);
            } catch (err) {
                console.log('subscriber consume error:', err?.message || err);
            } finally {
                channel.ack(msg);
            }
        });
        console.log(`subscriber bound queue=${queueName} → exchange=${EXCHANGE}`);
    } catch (error) {
        console.log('subscriber connect error:', error?.message || error);
        setTimeout(() => startSubscriber(queueName), 5000);
    }
};

const travelo_subscriber = (queueName) => {
    startSubscriber(queueName);
};

module.exports = { travelo_subscriber };
