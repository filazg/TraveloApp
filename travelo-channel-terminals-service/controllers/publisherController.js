const amqp = require('amqplib/callback_api');

// Boat i bus stack dijele isti broker. Bez namespacea oba projekta slušaju queue
// istog imena pa broker poruke dijeli round-robinom — polovica event-a završi u
// drugom projektu i sinkronizacija ispada nasumična.
const BROKER_NS = process.env.TRAVELO_BROKER_NS || 'boat';

const travelo_publisher = (queueName, message)=>{
    try {
        amqp.connect('amqp://kl-admin1:kl-admin123@209.38.200.220', (err, connection)=>{
        if(err){
            throw err;
        }
            connection.createChannel((err, channel)=>{
                if(err){
                    throw err;
                }
                let queue = `${queueName}_${BROKER_NS}`;
                let msg = JSON.stringify(message);
                channel.assertQueue(queue,{
                    durable: false
                });
                channel.sendToQueue(queue, Buffer.from(msg));
                setTimeout(()=>{
                    connection.close();
                }, 1000)
                })
                })
    } catch (error) {
        
    }
}

module.exports = {
    travelo_publisher
}