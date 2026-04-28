const amqp = require('amqplib/callback_api');
const { syncHarborsDataController, syncRoutesDataController, syncLinesDataController } = require('./syncControllers/syncBoatServiceController');

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
                    if(message.path === 'update_harbors'){
                        console.log(message)
                        syncHarborsDataController()
                    }else if(message.path === 'update_lines'){
                        syncLinesDataController()
                    }else if(message.path === 'update_sales_routes'){
                        console.log(message)
                        syncRoutesDataController(message.data)
                    }else if(message.path === 'update_business_premises'){
                        syncBusinessPremisesController()
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