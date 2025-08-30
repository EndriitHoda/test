FROM bitnami/spark:3.4.1

USER root

RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*
COPY requirements.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Copy application
COPY spark-streaming-job.py /app/

WORKDIR /app

USER 1001

CMD ["spark-submit", "--master", "spark://spark-master:7077", "--packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.2.0,com.datastax.spark:spark-cassandra-connector_2.12:3.2.0,org.mongodb.spark:mongo-spark-connector_2.12:10.1.1", "/app/spark-streaming-job.py"]