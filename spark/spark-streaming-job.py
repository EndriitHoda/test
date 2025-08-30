import os
import json
import logging
from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TrafficStreamProcessor:
    def __init__(self):
        self.kafka_broker = os.environ.get('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
        self.kafka_topic = os.environ.get('KAFKA_TOPIC', 'traffic-data')
        self.cassandra_host = os.environ.get('CASSANDRA_HOST', 'localhost')
        self.spark_master = os.environ.get('SPARK_MASTER', 'local[*]')
        self.spark = None
        self.processed_sensors = set()

        self.cassandra_keyspace = "traffic_monitoring"
        self.sensor_metrics_table = "sensor_metrics"
        self.sensor_metadata_table = "sensor_metadata"
        self.traffic_predictions_table = "traffic_predictions"
        self.traffic_alerts_table = "traffic_alerts"
        

    def save_sensor_metadata(self, df):
        """Save sensor metadata if not already processed"""
        metadata_df = df.select(
            col("id"),
            col("sensor_type"),
            col("road_segment_id"),
            col("location.coordinates")[1].alias("location_latitude"),
            col("location.coordinates")[0].alias("location_longitude")
        ).distinct().filter(~col("id").isin(list(self.processed_sensors)))

        # Only attempt to write / collect if we can confirm there's data
        if not is_nonempty(metadata_df):
            return

        try:
            metadata_df.write \
                .format("org.apache.spark.sql.cassandra") \
                .mode("append") \
                .options(table=self.sensor_metadata_table, keyspace=self.cassandra_keyspace) \
                .save()

            # collect the new ids (small set expected). keep behind the write
            ids = [row["id"] for row in metadata_df.select("id").collect()]
            if ids:
                new_sensors = set(ids)
                self.processed_sensors.update(new_sensors)
                logger.info(f"Saved metadata for {len(new_sensors)} new sensors")
        except Exception as e:
            logger.error(f"Failed saving sensor metadata: {e}")


    def create_spark_session(self):
        self.spark = SparkSession.builder \
            .appName("TrafficMonitoringStream") \
            .master(self.spark_master) \
            .config("spark.jars.packages", 
                    "org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,"
                    "com.datastax.spark:spark-cassandra-connector_2.12:3.4.0") \
            .config("spark.cassandra.connection.host", self.cassandra_host) \
            .config("spark.cassandra.connection.port", "9042") \
            .config("spark.sql.streaming.checkpointLocation", "/tmp/checkpoint") \
            .getOrCreate()
        self.spark.sparkContext.setLogLevel("WARN")
        logger.info("Spark session created successfully")

    def get_raw_schema(self):
        """Schema for simplified raw data"""
        return StructType([
            StructField("timestamp", TimestampType(), True),
            StructField("sensor_id", StringType(), True),
            StructField("sensor_type", StringType(), True),
            StructField("road_segment_id", StringType(), True),
            StructField("location", StructType([
                StructField("coordinates", ArrayType(DoubleType()), True),
                StructField("type", StringType(), True)
            ]), True),
            StructField("pedestrian_count", IntegerType(), True),
            StructField("cyclist_count", IntegerType(), True),
            StructField("aqi", DoubleType(), True),
            StructField("road_condition", StringType(), True),
            StructField("surface_temperature_celsius", DoubleType(), True),
            StructField("pothole_detected", BooleanType(), True),
            StructField("icing_risk_level", StringType(), True),
            StructField("friction_index", DoubleType(), True),
            StructField("incident_type", StringType(), True),
            StructField("severity", StringType(), True),
            StructField("average_speed_kmh", DoubleType(), True),
            StructField("vehicle_count", IntegerType(), True)
        ])

    def get_alert_schema(self):
        return StructType([
            StructField("alert_id", StringType(), True),
            StructField("sensor_id", StringType(), True),
            StructField("ts", TimestampType(), True),
            StructField("alert_type", StringType(), True),
            StructField("alert_message", StringType(), True),
            StructField("severity", StringType(), True),
            StructField("road_segment_id", StringType(), True)
        ])

    def detect_alerts(self, df):
        """Detect anomalies and return DataFrame of alerts"""

        alerts = []

        # Rule 1: Poor AQI
        aqi_alerts = df.filter(col("aqi") > 150).select(
            expr("uuid()").alias("alert_id"),
            col("id").alias("sensor_id"),
            col("timestamp").alias("ts"),
            lit("air_quality").alias("alert_type"),
            concat(lit("High AQI detected: "), col("aqi")).alias("alert_message"),
            lit("high").alias("severity"),
            col("road_segment_id")
        )
        if not aqi_alerts.isEmpty():
            alerts.append(aqi_alerts)

        # Rule 2: Speed drop congestion
        speed_alerts = df.filter((col("average_speed_kmh") < 20) & (col("vehicle_count") > 50)).select(
            expr("uuid()").alias("alert_id"),
            col("id").alias("sensor_id"),
            col("timestamp").alias("ts"),
            lit("congestion").alias("alert_type"),
            concat(lit("Congestion detected: avg speed "), col("average_speed_kmh")).alias("alert_message"),
            lit("medium").alias("severity"),
            col("road_segment_id")
        )
        if not speed_alerts.isEmpty():
            alerts.append(speed_alerts)

        # Rule 3: Road hazard
        hazard_alerts = df.filter((col("pothole_detected") == True) | (col("icing_risk_level") == "high")).select(
            expr("uuid()").alias("alert_id"),
            col("id").alias("sensor_id"),
            col("timestamp").alias("ts"),
            lit("road_hazard").alias("alert_type"),
            lit("Hazard detected (pothole/icing)").alias("alert_message"),
            lit("high").alias("severity"),
            col("road_segment_id")
        )
        if not hazard_alerts.isEmpty():
            alerts.append(hazard_alerts)

        if len(alerts) == 0:
            return None
        elif len(alerts) == 1:
            return alerts[0]
        else:
            return alerts[0].unionByName(*alerts[1:])



    # def process_batch(self, df, epoch_id):
    #     # Save sensor metadata for new sensors in this batch
    #     self.save_sensor_metadata(df)

    #     """Process raw batch and save only non-null metrics into sensor_metrics table"""
    #     try:
    #         metrics = [
    #             ("pedestrian_count", "number"),
    #             ("cyclist_count", "number"),
    #             ("aqi", "number"),
    #             ("road_condition", "string"),
    #             ("surface_temperature_celsius", "number"),
    #             ("pothole_detected", "boolean"),
    #             ("icing_risk_level", "string"),
    #             ("friction_index", "number"),
    #             ("incident_type", "string"),
    #             ("severity", "string"),
    #             ("average_speed_kmh", "number"),
    #             ("vehicle_count", "number")
    #         ]

    #         metric_rows = None
    #         for metric, metric_type in metrics:
    #             if metric_type == "number":
    #                 metric_df = df.select(
    #                     col("id"),
    #                     col("timestamp").alias("ts"),
    #                     lit(metric).alias("metric_name"),
    #                     lit(metric_type).alias("metric_type"),
    #                     col(metric).cast("double").alias("metric_value_num"),
    #                     lit(None).cast("string").alias("metric_value_str"),
    #                     lit(None).cast("boolean").alias("metric_value_bool")
    #                 ).filter(col("metric_value_num").isNotNull())
    #             elif metric_type == "boolean":
    #                 metric_df = df.select(
    #                     col("id"),
    #                     col("timestamp").alias("ts"),
    #                     lit(metric).alias("metric_name"),
    #                     lit(metric_type).alias("metric_type"),
    #                     lit(None).cast("double").alias("metric_value_num"),
    #                     lit(None).cast("string").alias("metric_value_str"),
    #                     col(metric).cast("boolean").alias("metric_value_bool")
    #                 ).filter(col("metric_value_bool").isNotNull())
    #             else:  # string
    #                 metric_df = df.select(
    #                     col("id"),
    #                     col("timestamp").alias("ts"),
    #                     lit(metric).alias("metric_name"),
    #                     lit(metric_type).alias("metric_type"),
    #                     lit(None).cast("double").alias("metric_value_num"),
    #                     col(metric).cast("string").alias("metric_value_str"),
    #                     lit(None).cast("boolean").alias("metric_value_bool")
    #                 ).filter(col("metric_value_str").isNotNull())
    #             metric_rows = metric_df if metric_rows is None else metric_rows.unionByName(metric_df)

    #             metric_rows.write \
    #                 .format("org.apache.spark.sql.cassandra") \
    #                 .mode("append") \
    #                 .options(table=self.sensor_metrics_table, keyspace="traffic_monitoring") \
    #                 .save()
            
    #         # Detect alerts
    #         alert_df = self.detect_alerts(df)
    #         if is_nonempty(alert_df):
    #             alert_df.write \
    #                 .format("org.apache.spark.sql.cassandra") \
    #                 .mode("append") \
    #                 .options(table=self.traffic_alerts_table, keyspace="traffic_monitoring") \
    #                 .save()
    #             logger.info(f"Generated x alerts in batch {epoch_id}")


    #         logger.info(f"Processed batch {epoch_id}")

    #     except Exception as e:
    #         logger.error(f"Error processing batch {epoch_id}: {e}")

    def process_batch(self, df, epoch_id):
        try:
            # Save metadata
            self.save_sensor_metadata(df)

            # Build and union metric rows (do not write inside loop)
            metrics = [
                ("pedestrian_count", "number"),
                ("cyclist_count", "number"),
                ("aqi", "number"),
                ("road_condition", "string"),
                ("surface_temperature_celsius", "number"),
                ("pothole_detected", "boolean"),
                ("icing_risk_level", "string"),
                ("friction_index", "number"),
                ("incident_type", "string"),
                ("severity", "string"),
                ("average_speed_kmh", "number"),
                ("vehicle_count", "number")
            ]

            metric_rows = None
            for metric, metric_type in metrics:
                if metric_type == "number":
                    metric_df = df.select(
                        col("id"),
                        col("timestamp").alias("ts"),
                        lit(metric).alias("metric_name"),
                        lit(metric_type).alias("metric_type"),
                        col(metric).cast("double").alias("metric_value_num"),
                        lit(None).cast("string").alias("metric_value_str"),
                        lit(None).cast("boolean").alias("metric_value_bool")
                    ).filter(col("metric_value_num").isNotNull())
                elif metric_type == "boolean":
                    metric_df = df.select(
                        col("id"),
                        col("timestamp").alias("ts"),
                        lit(metric).alias("metric_name"),
                        lit(metric_type).alias("metric_type"),
                        lit(None).cast("double").alias("metric_value_num"),
                        lit(None).cast("string").alias("metric_value_str"),
                        col(metric).cast("boolean").alias("metric_value_bool")
                    ).filter(col("metric_value_bool").isNotNull())
                else:  # string
                    metric_df = df.select(
                        col("id"),
                        col("timestamp").alias("ts"),
                        lit(metric).alias("metric_name"),
                        lit(metric_type).alias("metric_type"),
                        lit(None).cast("double").alias("metric_value_num"),
                        col(metric).cast("string").alias("metric_value_str"),
                        lit(None).cast("boolean").alias("metric_value_bool")
                    ).filter(col("metric_value_str").isNotNull())

                metric_rows = metric_df if metric_rows is None else metric_rows.unionByName(metric_df)

            # Write metrics once per batch, only if non-empty
            if metric_rows is not None and is_nonempty(metric_rows):
                try:
                    metric_rows.write \
                        .format("org.apache.spark.sql.cassandra") \
                        .mode("append") \
                        .options(table=self.sensor_metrics_table, keyspace=self.cassandra_keyspace) \
                        .save()
                except Exception as e:
                    logger.error(f"Failed writing metric_rows: {e}")

            # Detect alerts (single-record rules)
            alert_df = self.detect_alerts(df)
            if alert_df is not None and is_nonempty(alert_df):
                try:
                    alert_df.write \
                        .format("org.apache.spark.sql.cassandra") \
                        .mode("append") \
                        .options(table=self.traffic_alerts_table, keyspace=self.cassandra_keyspace) \
                        .save()
                    logger.info(f"Generated alerts in batch {epoch_id}")
                except Exception as e:
                    logger.error(f"Failed writing alerts: {e}")

            logger.info(f"Processed batch {epoch_id}")

        except Exception as e:
            logger.error(f"Error processing batch {epoch_id}: {e}", exc_info=True)


    def run(self):
        self.create_spark_session()

        # Read from Kafka
        df = self.spark.readStream \
            .format("kafka") \
            .option("kafka.bootstrap.servers", self.kafka_broker) \
            .option("subscribe", self.kafka_topic) \
            .option("startingOffsets", "latest") \
            .option("key.deserializer", "org.apache.kafka.common.serialization.StringDeserializer") \
            .option("value.deserializer", "org.apache.kafka.common.serialization.StringDeserializer") \
            .option("enable.auto.commit", "true") \
            .option("max.poll.records", "500") \
            .option("auto.offset.reset", "latest") \
            .load()

        parsed_df = df.select(
            from_json(col("value").cast("string"), self.get_raw_schema()).alias("data")
        ).select("data.*") \
        .withColumnRenamed("sensor_id", "id")

         # Example of windowed aggregation for congestion detection across multiple sensors
        windowed_alerts = parsed_df.groupBy(
            window("timestamp", "1 minute"),
            "road_segment_id"
        ).agg(
            avg("average_speed_kmh").alias("avg_speed"),
            sum("vehicle_count").alias("total_vehicles")
        ).filter((col("avg_speed") < 15) & (col("total_vehicles") > 100)) \
        .withColumn("alert_id", expr("uuid()")) \
        .withColumn("alert_type", lit("network_congestion")) \
        .withColumn("alert_message", concat(lit("Severe congestion on segment "), col("road_segment_id"))) \
        .withColumn("severity", lit("high")) \
        .withColumn("ts", current_timestamp()) \
        .withColumn("sensor_id", lit(None).cast("string")) \
        .select("alert_id", "sensor_id", "ts", "alert_type", "alert_message", "severity", "road_segment_id")

        query1 = parsed_df.writeStream \
            .outputMode("append") \
            .foreachBatch(self.process_batch) \
            .trigger(processingTime="30 seconds") \
            .start()
        
        query2 = windowed_alerts.writeStream \
            .outputMode("update") \
            .foreachBatch(lambda df, eid: df.write
                        .format("org.apache.spark.sql.cassandra")
                        .mode("append")
                        .options(table=self.traffic_alerts_table, keyspace="traffic_monitoring")
                        .save()) \
            .trigger(processingTime="1 minute") \
            .start()

        # Await termination
        try:
            query1.awaitTermination()
            query2.awaitTermination()
        except KeyboardInterrupt:
            logger.info("Stopping streaming queries...")
            query1.stop()
            query2.stop()

# put this near the top (after imports)
def is_nonempty(df):
    """
    Robust non-empty check for a batch DataFrame inside foreachBatch.
    Uses limit(1).count() which performs a tiny Spark job.
    Wrapped in try/except to avoid Py4J internal errors surfacing here.
    """
    if df is None:
        return False
    try:
        # limit(1).count() is the most compatible way to check non-emptiness
        return df.limit(1).count() > 0
    except Exception as e:
        # log and treat as empty to avoid failing the batch
        logger.debug(f"is_nonempty check failed: {e}")
        return False



if __name__ == "__main__":
    processor = TrafficStreamProcessor()
    processor.run()