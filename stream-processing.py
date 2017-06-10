import atexit
import logging
import json
import sys
import time
import math

from kafka import KafkaProducer
from kafka.errors import KafkaError, KafkaTimeoutError
from pyspark import SparkContext
from pyspark.streaming import StreamingContext
from pyspark.streaming.kafka import KafkaUtils

logger_format = '%(asctime)-15s %(message)s'
logging.basicConfig(format=logger_format)
logger = logging.getLogger('stream-processing')
logger.setLevel(logging.INFO)

topic = None
target_topic = None
brokers = None
kafka_producer = None

def shutdown_hook(producer):
    """
    a shutdown hook to be called before the shutdown
    :param producer: instance of a kafka producer
    :return: None
    """
    try:
        logger.info('Flushing pending messages to kafka, timeout is set to 10s')
        producer.flush(10)
        logger.info('Finish flushing pending messages to kafka')
    except KafkaError as kafka_error:
        logger.warn('Failed to flush pending messages to kafka, caused by: %s', kafka_error.message)
    finally:
        try:
            logger.info('Closing kafka connection')
            producer.close(10)
        except Exception as e:
            logger.warn('Failed to close kafka connection, caused by: %s', e.message)




def bike_processing(bike_stream, request_stream):

    
    def test_send(rdd):
        results = rdd.collect()
        for r in results:
            data = json.dumps(
                {
                    'user_id': r,
                    'timestamp': time.time(),
                }
            )

    def save_bike(bike):
        data = json.loads(bike[1].decode('utf-8'))
        bike_id = data['id']
        latitude = data['latitude']
        longitude = data['longitude']
        with open('bike_inventory.json', 'r+') as f:
            json_data = json.load(f)
            json_data[bike_id] = [latitude, longitude]
            f.seek(0)
            f.write(json.dumps(json_data))
            f.truncate()
            return json_data

    bike_stream.map(save_bike).foreachRDD(test_send)


    def send_to_kafka(rdd):
        results = rdd.collect()
        for r in results:
            data = json.dumps(
                {
                    'user_id': r['user_id'],
                    'bike_id': r['bike_id'],
                    'bike_coordinate': r['bike_coordinate'],
                    'timestamp': time.time(),
                }
            )
            try:
                kafka_producer.send(match_target_topic, data)
            except KafkaError as error:
                logger.warn('Failed to send data to kafka, caused by: %s', error.message)

    def calculateDistance(user, bike):
        user_x = user[0]
        user_y = user[1]
        bike_x = bike[0]
        bike_y = bike[1]

        dist = math.sqrt((bike_x - user_x)**2 + (bike_y - user_y)**2)
        return dist 

    def matching(request):
        user_data = json.loads(request[1].decode('utf-8'))
        user_id = user_data['id']
        user_coordinate = user_data['coordinate']
        nearest_bike = 0
        nearest_dist = float('inf')
        nearest_bike_coord = [0, 0]
        with open('bike_inventory.json', 'r+') as f:
            bikes_inventory = json.load(f)
            for bike_id in bikes_inventory:
                dist =calculateDistance(user_coordinate, bikes_inventory[bike_id])
                if dist < nearest_dist:
                    nearest_dist = dist
                    nearest_bike = bike_id
                    nearest_bike_coord = bikes_inventory[bike_id]

            del bikes_inventory[nearest_bike]
            f.seek(0)
            f.write(json.dumps(bikes_inventory))
            f.truncate()

        return {'user_id': user_id, 'bike_id': nearest_bike, 'bike_coordinate': nearest_bike_coord}

    request_stream.map(matching).foreachRDD(send_to_kafka)



if __name__ == '__main__':
    if len(sys.argv) != 5:
        print("Usage: stream-process.py [bike_topic] [request_topic] [match_target_topic] [broker-list]")
        exit(1)

    # - create SparkContext and StreamingContext
    sc = SparkContext("local[2]", "bike matching")
    sc.setLogLevel('INFO')
    ssc = StreamingContext(sc, 5)

    bike_topic, request_topic, match_target_topic, brokers = sys.argv[1:]

    bikes_inventory = {}

    # - instantiate a kafka stream for processing
    bikeKafkaStream = KafkaUtils.createDirectStream(ssc, [bike_topic], {'metadata.broker.list': brokers})
    requestKafkaStream = KafkaUtils.createDirectStream(ssc, [request_topic], {'metadata.broker.list': brokers})

    bike_processing(bikeKafkaStream, requestKafkaStream)

    # - instantiate a simple kafka producer
    kafka_producer = KafkaProducer(
        bootstrap_servers=brokers
    )

    # - setup proper shutdown hook
    atexit.register(shutdown_hook, kafka_producer)

    ssc.start()
    ssc.awaitTermination()