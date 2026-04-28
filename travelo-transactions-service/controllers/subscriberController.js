const amqp = require('amqplib/callback_api');
const { addBookingController } = require('./dataControllers/bookingControllers');

const travelo_subscriber = async (queueName) => {
    try {
        amqp.connect('amqp://kl-admin1:kl-admin123@209.38.200.220', (err, connection) => {
            if(err){
                throw(err)
            }
            connection.createChannel((err, channel) => {
                if(err){
                    throw(err)
                }
                let queue = queueName
                channel.assertQueue(queue,{
                    durable:false
                });
                channel.consume(queue,(msg)=>{
                    const message = JSON.parse(msg.content.toString());
                    if(message.path === 'update_sales_routes'){
                        console.log(message)
                        addBookingController(message.data)
                    }
                    channel.ack(msg)
                    return (message)
                })
            })
        })
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    travelo_subscriber
}