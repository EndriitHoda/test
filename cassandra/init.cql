CREATE KEYSPACE IF NOT EXISTS traffic_monitoring
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE traffic_monitoring;

CREATE TABLE IF NOT EXISTS sensor_metrics (
    id text,
    ts timestamp,
    metric_name text,
    metric_type text,
    metric_value_num double,
    metric_value_str text,
    metric_value_bool boolean,
    PRIMARY KEY (id, ts, metric_name)
);

CREATE TABLE IF NOT EXISTS sensor_metadata (
    id text PRIMARY KEY,
    sensor_type text,
    road_segment_id text,
    location_latitude double,
    location_longitude double
);

-- Table: raw_data
CREATE TABLE IF NOT EXISTS raw_data (
    id text,
    ts timestamp,
    raw_payload text,
    PRIMARY KEY (id, ts)
);

-- Table: traffic_alerts
CREATE TABLE IF NOT EXISTS traffic_alerts (
    alert_id uuid PRIMARY KEY,
    sensor_id text,
    ts timestamp,
    alert_type text,
    alert_message text,
    severity text,
    road_segment_id text,
    avg_speed double,
    total_vehicles int,
    window_start timestamp,
    window_end timestamp
);

-- Table: traffic_predictions
CREATE TABLE IF NOT EXISTS traffic_predictions (
    id text,
    sensor_type text,
    road_segment_id text,
    pedestrian_count int,
    cyclist_count int,
    aqi double,
    road_condition text,
    surface_temperature_celsius double,
    pothole_detected boolean,
    icing_risk_level text,
    friction_index double,
    incident_type text,
    severity text,
    average_speed_kmh double,
    vehicle_count int,
    prediction int,
    features_json text,
    ts timestamp,
    PRIMARY KEY (id, ts)
);