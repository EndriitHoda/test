// tirana_sensor_init.js - MongoDB initialization script with unified _id
// Run with: mongosh mongodb://localhost:27017/iot_traffic_monitoring sensor_init.js

// Clear existing collections
db.sensors.drop();

// Configuration
const SENSOR_TYPES = ["Radar", "Camera", "AirQualityStation", "RoadSensor", "PedestrianSensor"];
const ROAD_PREFIXES = ["TIA", "RIN", "KAV", "DUR", "SHK"];
const DIRECTIONS = ["Northbound", "Southbound", "Eastbound", "Westbound"];

// Tirana geographic bounds (more precise)
const MIN_LON = 19.75;
const MAX_LON = 19.85;
const MIN_LAT = 41.29;
const MAX_LAT = 41.35;

// Major landmarks in Tirana
const LANDMARKS = {
  "Skanderbeg_Square": [19.8186, 41.3275],
  "Airport": [19.7206, 41.4147],
  "Blloku": [19.8300, 41.3250],
  "Pazari_i_Ri": [19.8194, 41.3289],
  "Qemal_Stafa": [19.8192, 41.3215]
};

function generateNearLandmark(landmarkCoords, dispersion = 0.01) {
  return [
    landmarkCoords[0] + (Math.random() * dispersion * 2 - dispersion),
    landmarkCoords[1] + (Math.random() * dispersion * 2 - dispersion)
  ];
}

function generateSensors(count) {
  const sensors = [];
  const landmarkKeys = Object.keys(LANDMARKS);

  for (let i = 0; i < count; i++) {
    const type = SENSOR_TYPES[Math.floor(Math.random() * SENSOR_TYPES.length)];
    const useLandmark = Math.random() > 0.7;
    const sensorId = `${type.slice(0, 4).toUpperCase()}-${String(i+1).padStart(4, '0')}`;

    const coordinates = useLandmark
        ? generateNearLandmark(LANDMARKS[landmarkKeys[Math.floor(Math.random() * landmarkKeys.length)]])
        : [
          MIN_LON + (Math.random() * (MAX_LON - MIN_LON)),
          MIN_LAT + (Math.random() * (MAX_LAT - MIN_LAT))
        ];

    const sensor = {
      _id: sensorId, // Using _id as the primary sensor identifier
      type: type,
      location: {
        type: "Point",
        coordinates: coordinates
      },
      last_updated: new Date()
    };

    // Add type-specific metadata
    switch(type) {
      case "Radar":
      case "Camera":
        sensor.road_segment_id = `ROAD-${ROAD_PREFIXES[Math.floor(Math.random() * ROAD_PREFIXES.length)]}-${String(Math.floor(Math.random() * 50)).padStart(3, '0')}`;
        sensor.lane_number = Math.floor(Math.random() * 3) + 1;
        sensor.direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
        break;

      case "AirQualityStation":
        sensor.height = Math.round((Math.random() * 5 + 3) * 10) / 10;
        if (coordinates[0] > 19.81 && coordinates[0] < 19.82) {
          sensor.quality = "High";
        }
        break;

      case "PedestrianSensor":
        sensor.area_type = ["Commercial", "Residential", "Park"][Math.floor(Math.random() * 3)];
        break;
    }

    sensors.push(sensor);
  }

  return sensors;
}

try {
  const result = db.getCollection("sensor-config").insertMany(generateSensors(800));
  print(`Successfully inserted ${result.insertedCount} sensors`);
} catch (e) {
  print(`Error inserting sensors: ${e}`);
}

// Create optimal indexes
db.sensors.createIndex({ "location": "2dsphere" });
db.sensors.createIndex({ "type": 1 });
db.sensors.createIndex({ "road_segment_id": 1 });

// Verification
print("\nSample Sensors by Type:");
SENSOR_TYPES.forEach(type => {
  const sample = db.sensors.findOne({ type: type }, { _id: 1, type: 1, "location.coordinates": 1 });
  printjson(sample);
});

print("\nGeographic Distribution Summary:");
printjson(db.sensors.aggregate([
  {
    $group: {
      _id: "$type",
      count: { $sum: 1 },
      minLon: { $min: "$location.coordinates[0]" },
      maxLon: { $max: "$location.coordinates[0]" },
      minLat: { $min: "$location.coordinates[1]" },
      maxLat: { $max: "$location.coordinates[1]" }
    }
  }
]).toArray());