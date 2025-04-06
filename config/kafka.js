import { Kafka } from 'kafkajs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read SSL certificate
let sslConfig = {};
try {
    const caPath = path.resolve(__dirname, './ca.pem');
    if (fs.existsSync(caPath)) {
        sslConfig = {
            ca: [fs.readFileSync(caPath, 'utf-8')],
            rejectUnauthorized: false
        };
    }
} catch (error) {
    console.error('Error reading SSL certificate:', error);
}

const kafka = new Kafka({
    
    brokers: [process.env.KAFKA_BROKER],
    ssl: sslConfig,
    sasl: { 
        mechanism: process.env.KAFKA_SASL_MECHANISM,
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD
    },
    connectionTimeout: 10000,
    retry: {
        initialRetryTime: 100,
        retries: 5
    }
});

let producer = null;

export async function createProducer() {
    if (producer) return producer;

    try {
        const _producer = kafka.producer();
        await _producer.connect();
        producer = _producer;
        console.log('Kafka producer connected successfully');
        return producer; 
    } catch (error) {
        console.error('Error creating Kafka producer:', error);
        throw error;
    }
}

export async function produceMessage(message) {
    try {
        const producer = await createProducer();
        await producer.send({
            messages: [{ key: `message-${Date.now()}`, value: JSON.stringify(message) }],
            topic: 'MESSAGES',
        });
        return true;
    } catch (error) {
        console.error('Error producing message:', error);
        throw error;
    }
}

export async function createTopicIfNotExists() {
    try {
        const admin = kafka.admin();
        await admin.connect();
        
        const topics = await admin.listTopics();
        if (!topics.includes('MESSAGES')) {
            await admin.createTopics({
                topics: [{
                    topic: 'MESSAGES',
                    numPartitions: 1,
                    replicationFactor: 1
                }]
            });
            console.log('Created MESSAGES topic');
        }
        
        await admin.disconnect();
    } catch (error) {
        console.error('Error creating topic:', error);
        throw error;
    }
}

export async function startMessageConsumer() {
    try {
        console.log('Starting Kafka consumer...');
        
        // Create topic if it doesn't exist
        await createTopicIfNotExists();
        
        const consumer = kafka.consumer({ 
            groupId: 'chatify-group',
            heartbeatInterval: 3000,
            sessionTimeout: 10000
        });
        
        await consumer.connect();
        console.log('Consumer connected successfully');
        
        await consumer.subscribe({ 
            topic: 'MESSAGES', 
            fromBeginning: true 
        });
        console.log('Consumer subscribed to topic MESSAGES');

        await consumer.run({
            autoCommit: true,
            eachMessage: async ({ message, pause }) => {
                if (!message.value) return;
                console.log('New Message Received..');
                try {
                    const messageData = JSON.parse(message.value.toString());
                    console.log('Processed message:', messageData);
                } catch (err) {
                    console.error('Error processing message:', err);
                    pause();
                    setTimeout(() => {
                        consumer.resume([{ topic: 'MESSAGES' }]);
                    }, 60 * 1000);
                }
            },
        });
    } catch (error) {
        console.error('Error starting Kafka consumer:', error);
        throw error;
    }
}

export default kafka; 