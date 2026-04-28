const amqp = require('amqplib/callback_api');

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
                let queue = queueName;
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
        console.log('PUBLISHER ERROR: ', error)
    }
}

module.exports = {
    travelo_publisher
}