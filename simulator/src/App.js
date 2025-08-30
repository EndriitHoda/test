import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, XCircle, Bot, Zap, ChevronsRight, Thermometer, Wind, Car, Footprints, Siren, Send, Server, RefreshCw, Filter } from 'lucide-react';

// --- Helper Functions ---
const getRandomFloat = (min, max, decimals = 2) => (Math.random() * (max - min) + min).toFixed(decimals);
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const generateVehicleId = () => `${getRandomInt(1000, 9999)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;

// --- Data Generation Functions ---
const generateBaseMetadata = (sensor) => ({
  timestamp: new Date().toISOString(),
  sensor_id: sensor.id,
  sensor_type: sensor.type,
  location: sensor.location,
  road_segment_id: sensor.road_segment_id || `ROAD-${sensor.location.coordinates[0].toFixed(4)}-${sensor.location.coordinates[1].toFixed(4)}`,
  lane_number: sensor.lane_number || getRandomInt(1, 4),
  direction: getRandomElement(['Northbound', 'Southbound', 'Eastbound', 'Westbound']),
  confidence_score: parseFloat(getRandomFloat(0.85, 0.99))
});

const generateVehicleCountData = (sensorConfig) => ({
  type: 'VehicleCount',
  icon: Car,
  data: {
    vehicle_count: getRandomInt(sensorConfig.vehicleCountMin, sensorConfig.vehicleCountMax),
    vehicle_class_counts: {
      car: getRandomInt(sensorConfig.vehicleCountMin * 0.7, sensorConfig.vehicleCountMax * 0.7),
      truck: getRandomInt(0, sensorConfig.vehicleCountMax * 0.15),
      bus: getRandomInt(0, sensorConfig.vehicleCountMax * 0.05),
      motorcycle: getRandomInt(0, sensorConfig.vehicleCountMax * 0.1)
    },
    measurement_interval_seconds: sensorConfig.periodicity
  }
});

const generateVehicleSpeedData = (sensorConfig) => {
  const avgSpeed = parseFloat(getRandomFloat(sensorConfig.avgSpeedMin, sensorConfig.avgSpeedMax));
  return {
    type: 'VehicleSpeed',
    icon: ChevronsRight,
    data: {
      average_speed_kmh: avgSpeed,
      vehicle_speeds: Array.from({ length: getRandomInt(1, 5) }, () => ({
        vehicle_id: generateVehicleId(),
        speed_kmh: parseFloat(getRandomFloat(avgSpeed - 10, avgSpeed + 10))
      })),
      speed_limit_kmh: sensorConfig.speedLimit || 60,
      measurement_interval_seconds: sensorConfig.periodicity
    }
  };
};

const generateIncidentData = () => ({
  type: 'Incident',
  icon: Siren,
  data: {
    incident_id: `INC-${Date.now()}`,
    incident_type: getRandomElement(['Accident', 'Stalled Vehicle', 'Debris on Road', 'Construction', 'Weather Hazard']),
    severity: getRandomElement(['Low', 'Moderate', 'High', 'Critical']),
    vehicles_involved: Array.from({ length: getRandomInt(1, 3) }, generateVehicleId),
    incident_start_time: new Date(Date.now() - getRandomInt(0, 300) * 1000).toISOString(),
    incident_end_time: Math.random() > 0.7 ? new Date().toISOString() : null,
    lane_affected: Array.from({ length: getRandomInt(1, 2) }, () => String(getRandomInt(1, 4))),
    verified: Math.random() > 0.8,
    detection_method: 'AI_Video_Analytics'
  }
});

const generateAirQualityData = (sensorConfig) => {
  const baseCo = parseFloat(getRandomFloat(sensorConfig.coMin, sensorConfig.coMax));
  const baseNo2 = parseFloat(getRandomFloat(sensorConfig.no2Min, sensorConfig.no2Max));
  return {
    type: 'AirQuality',
    icon: Wind,
    data: {
      co_ppm: baseCo,
      no2_ppb: baseNo2,
      pm2_5_ug_per_m3: parseFloat(getRandomFloat(sensorConfig.pm25Min, sensorConfig.pm25Max)),
      pm10_ug_per_m3: parseFloat(getRandomFloat(sensorConfig.pm25Min * 1.5, sensorConfig.pm25Max * 1.5)),
      aqi: getRandomInt(20, 150),
      sensor_height_meters: sensorConfig.height || 2.5,
      measurement_interval_seconds: sensorConfig.periodicity
    }
  };
};

const generateRoadConditionData = (sensorConfig) => ({
  type: 'RoadCondition',
  icon: Thermometer,
  data: {
    road_condition: getRandomElement(['Dry', 'Wet', 'Very Wet', 'Icy', 'Snow Covered']),
    surface_temperature_celsius: parseFloat(getRandomFloat(sensorConfig.tempMin, sensorConfig.tempMax)),
    pothole_detected: Math.random() < 0.05,
    icing_risk_level: getRandomElement(['Low', 'Medium', 'High', 'Critical']),
    friction_index: parseFloat(getRandomFloat(0.4, 0.9))
  }
});

const generatePedestrianData = (sensorConfig) => ({
  type: 'PedestrianCount',
  icon: Footprints,
  data: {
    pedestrian_count: getRandomInt(sensorConfig.pedestrianMin, sensorConfig.pedestrianMax),
    cyclist_count: getRandomInt(sensorConfig.cyclistMin, sensorConfig.cyclistMax),
    group_count: {
      pedestrian: {
        single: getRandomInt(sensorConfig.pedestrianMin * 0.7, sensorConfig.pedestrianMax * 0.7),
        group: getRandomInt(0, sensorConfig.pedestrianMax * 0.3)
      },
      cyclist: {
        single: getRandomInt(sensorConfig.cyclistMin * 0.8, sensorConfig.cyclistMax * 0.8),
        group: getRandomInt(0, sensorConfig.cyclistMax * 0.2)
      }
    },
    measurement_interval_seconds: sensorConfig.periodicity
  }
});

const generateVehicleClassificationData = () => ({
  type: 'VehicleClassification',
  icon: Car,
  data: {
    vehicle_id: generateVehicleId(),
    vehicle_type: getRandomElement(['Car', 'Truck', 'Bus', 'Motorcycle', 'Emergency', 'Construction']),
    axle_count: getRandomInt(2, 4),
    vehicle_length_meters: parseFloat(getRandomFloat(3.5, 12.0))
  }
});

// Type-level configurations
const SENSOR_TYPE_CONFIG = {
  'Radar': {
    generators: [generateVehicleCountData, generateVehicleSpeedData],
    dataRanges: {
      vehicleCountMin: 10,
      vehicleCountMax: 200,
      avgSpeedMin: 40,
      avgSpeedMax: 90,
      speedLimit: 60
    }
  },
  'Camera': {
    generators: [generateVehicleCountData, generateIncidentData, generateVehicleClassificationData],
    dataRanges: {
      vehicleCountMin: 5,
      vehicleCountMax: 150
    }
  },
  'AirQualityStation': {
    generators: [generateAirQualityData],
    dataRanges: {
      coMin: 1,
      coMax: 10,
      no2Min: 20,
      no2Max: 100,
      pm25Min: 5,
      pm25Max: 50,
      height: 2.5
    }
  },
  'RoadSensor': {
    generators: [generateRoadConditionData],
    dataRanges: {
      tempMin: -5,
      tempMax: 35
    }
  },
  'PedestrianSensor': {
    generators: [generatePedestrianData],
    dataRanges: {
      pedestrianMin: 0,
      pedestrianMax: 50,
      cyclistMin: 0,
      cyclistMax: 25
    }
  }
};

export default function TrafficMonitoringSimulator() {
  const [config, setConfig] = useState({
    simulationSpeed: 1.0,
    faultChance: 0.05,
    batchSize: 50,
    periodicity: 60, // Global periodicity in seconds
    endpointUrl: 'http://localhost:9090/ingest',
    sensorsEndpoint: 'http://localhost:9090/sensors',
    maxSensors: 1000,
    fetchSensors: true
  });

  const [isRunning, setIsRunning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isFetchingSensors, setIsFetchingSensors] = useState(false);
  const [log, setLog] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [pushStatus, setPushStatus] = useState({ message: 'Idle', type: 'idle' });
  const [bufferCount, setBufferCount] = useState(0);
  const [stats, setStats] = useState({
    totalSent: 0,
    lastMinuteRate: 0,
    faultsDetected: 0
  });
  
  // Add sensor type filter state
  const [selectedSensorTypes, setSelectedSensorTypes] = useState([]);
  const [showSensorFilter, setShowSensorFilter] = useState(false);
  const [availableSensorTypes, setAvailableSensorTypes] = useState([]);
  
  const intervalRef = useRef(null);
  const logContainerRef = useRef(null);
  const dataBufferRef = useRef([]);
  const statsRef = useRef({
    lastMinuteCount: 0,
    lastMinuteTimestamps: []
  });

  // Initialize with all sensor types selected when component mounts
  useEffect(() => {
    const initialTypes = Object.keys(SENSOR_TYPE_CONFIG);
    setAvailableSensorTypes(initialTypes);
    setSelectedSensorTypes(initialTypes);
  }, []);

  const fetchConfiguredSensors = useCallback(async () => {
    if (!config.fetchSensors || !config.sensorsEndpoint) {
      return;
    }

    setIsFetchingSensors(true);
    try {
      const response = await fetch(config.sensorsEndpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch sensors: ${response.status}`);
      }
      const sensorList = await response.json();
      
      // Limit to maxSensors if needed
      const limitedSensors = config.maxSensors > 0 
        ? sensorList.slice(0, config.maxSensors)
        : sensorList;
      
      // Enrich sensor data with type-specific configuration
      const enrichedSensors = limitedSensors.map(sensor => {
        const typeConfig = SENSOR_TYPE_CONFIG[sensor.type] || SENSOR_TYPE_CONFIG['Radar'];
        return {
          ...sensor,
          dataRanges: typeConfig.dataRanges // Use type-level configuration
        };
      });
      
      // Filter out sensors with unknown types if they don't have a fallback
      const validSensors = enrichedSensors.filter(sensor => 
        SENSOR_TYPE_CONFIG[sensor.type] || sensor.type === 'Radar'
      );
      
      if (validSensors.length !== enrichedSensors.length) {
        console.warn(`Filtered out ${enrichedSensors.length - validSensors.length} sensors with unknown types`);
      }
      
      setSensors(enrichedSensors);
      
      // Update available sensor types based on fetched sensors
      const fetchedSensorTypes = [...new Set(validSensors.map(s => s.type))];
      setAvailableSensorTypes(fetchedSensorTypes);
      
      // Update selected sensor types to only include fetched types
      setSelectedSensorTypes(prev => 
        prev.filter(type => fetchedSensorTypes.includes(type))
      );
      
      // If no valid sensor types from backend, fall back to random generation
      if (fetchedSensorTypes.length === 0) {
        setPushStatus({ message: 'No valid sensor types from backend, falling back to random generation', type: 'warning' });
        generateRandomSensors();
        return;
      }
      
      setSensors(validSensors);
      setPushStatus({ message: `Loaded ${validSensors.length} sensors`, type: 'success' });
    } catch (error) {
      console.error("Sensor fetch failed:", error);
      setPushStatus({ message: `Error loading sensors: ${error.message}`, type: 'error' });
      generateRandomSensors();
    } finally {
      setIsFetchingSensors(false);
    }
  }, [config.sensorsEndpoint, config.fetchSensors, config.maxSensors]);

  const generateRandomSensors = useCallback(() => {
    const sensorTypes = Object.keys(SENSOR_TYPE_CONFIG);
    const newSensors = Array.from({ length: config.maxSensors || 100 }, (_, i) => {
      const type = getRandomElement(sensorTypes);
      const typeConfig = SENSOR_TYPE_CONFIG[type];
      return {
        id: `SENSOR-${type.slice(0, 4).toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
        type: type,
        location: {
          type: "Point",
          coordinates: [
            parseFloat(getRandomFloat(19.7, 20.0, 6)),
            parseFloat(getRandomFloat(41.2, 41.5, 6))
          ]
        },
        road_segment_id: `ROAD-${getRandomElement(['TIR', 'DUR', 'VLOR', 'KUK'])}-${String(getRandomInt(1, 100)).padStart(3, '0')}`,
        lane_number: getRandomInt(1, 4),
        dataRanges: typeConfig.dataRanges // Use type-level configuration
      };
    });
    setSensors(newSensors);
    
    // Update available sensor types based on randomly generated sensors
    const generatedSensorTypes = [...new Set(newSensors.map(s => s.type))];
    setAvailableSensorTypes(generatedSensorTypes);
    
    // Update selected sensor types to only include generated types
    setSelectedSensorTypes(prev => 
      prev.filter(type => generatedSensorTypes.includes(type))
    );
    
    // If no sensor types are available, show a warning
    if (generatedSensorTypes.length === 0) {
      setPushStatus({ message: 'Warning: No valid sensor types generated', type: 'error' });
    } else {
      setPushStatus({ message: `Generated ${newSensors.length} random sensors`, type: 'success' });
    }
  }, [config.maxSensors]);

  const sendBatchData = useCallback(async (batch) => {
    if (!config.endpointUrl || batch.length === 0) return;

    setIsSending(true);
    setPushStatus({ message: `Sending ${batch.length} records...`, type: 'sending' });
    
    try {
      const startTime = performance.now();
      const response = await fetch(config.endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      
      const duration = performance.now() - startTime;
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
      
      setPushStatus({ 
        message: `Sent ${batch.length} records in ${duration.toFixed(1)}ms`, 
        type: 'success' 
      });
      
      // Update statistics
      setStats(prev => ({
        totalSent: prev.totalSent + batch.length,
        lastMinuteRate: statsRef.current.lastMinuteCount,
        faultsDetected: prev.faultsDetected + batch.filter(d => d.confidence_score < 0.5).length
      }));
      
      return true;
    } catch (error) {
      console.error("Batch send failed:", error);
      setPushStatus({ message: `Error: ${error.message}`, type: 'error' });
      return false;
    } finally {
      setIsSending(false);
    }
  }, [config.endpointUrl]);

  const addVisualLogEntry = (type, data, isFaulty, IconComponent) => {
    const newEntry = { 
      id: Date.now() + Math.random(), 
      type, 
      data: JSON.stringify(data, null, 2), 
      timestamp: new Date().toLocaleTimeString(), 
      isFaulty, 
      Icon: IconComponent || Bot 
    };
    
    setLog(prev => {
      const newLog = [...prev, newEntry];
      return newLog.length > 200 ? newLog.slice(newLog.length - 200) : newLog;
    });
  };

  const introduceFaults = (data, sensorType) => {
    const faultyData = { ...data };
    const faultType = getRandomElement([
      'extreme_value',
      'zero_value',
      'null_value',
      'negative_value',
      'stuck_value'
    ]);
    
    // Select a random numeric field to corrupt
    const numericFields = Object.keys(faultyData)
      .filter(key => typeof faultyData[key] === 'number');
    
    if (numericFields.length === 0) return faultyData;
    
    const fieldToCorrupt = getRandomElement(numericFields);
    
    switch (faultType) {
      case 'extreme_value':
        faultyData[fieldToCorrupt] *= getRandomElement([10, 100, 1000]);
        break;
      case 'zero_value':
        faultyData[fieldToCorrupt] = 0;
        break;
      case 'null_value':
        faultyData[fieldToCorrupt] = null;
        break;
      case 'negative_value':
        faultyData[fieldToCorrupt] *= -1;
        break;
      case 'stuck_value':
        // Keep the same value as previous
        break;
    }
    
    faultyData.confidence_score = parseFloat(getRandomFloat(0.1, 0.4));
    faultyData.fault_type = faultType;
    faultyData.fault_timestamp = new Date().toISOString();
    
    return faultyData;
  };

  const generateData = useCallback(() => {
    const packetsForBuffer = [];
    const now = Date.now();
    
    // Update rate statistics
    statsRef.current.lastMinuteTimestamps = statsRef.current.lastMinuteTimestamps
      .filter(t => now - t <= 60000);
    statsRef.current.lastMinuteTimestamps.push(now);
    statsRef.current.lastMinuteCount = statsRef.current.lastMinuteTimestamps.length;
    
    // Filter sensors by selected types
    const filteredSensors = sensors.filter(sensor => 
      selectedSensorTypes.includes(sensor.type)
    );
    
    filteredSensors.forEach(sensor => {
      // Skip some sensors randomly to simulate real-world irregular reporting
      if (Math.random() > 0.8) return;
      
      const sensorTypeConfig = SENSOR_TYPE_CONFIG[sensor.type] || SENSOR_TYPE_CONFIG['Radar'];
      const generatorFunc = getRandomElement(sensorTypeConfig.generators);
      
      if (!generatorFunc) return;
      
      // Combine type-level dataRanges with global periodicity
      const generationConfig = {
        ...sensor.dataRanges,
        periodicity: config.periodicity // Global periodicity
      };
      
      const eventData = generatorFunc(generationConfig);
      const isFaulty = Math.random() < config.faultChance;
      
      let fullPacket = { 
        ...generateBaseMetadata(sensor), 
        ...eventData.data 
      };
      
      if (isFaulty) {
        fullPacket = introduceFaults(fullPacket, sensor.type);
      }
      
      addVisualLogEntry(eventData.type, fullPacket, isFaulty, eventData.icon);
      packetsForBuffer.push(fullPacket);
    });
    
    if (packetsForBuffer.length > 0) {
      dataBufferRef.current.push(...packetsForBuffer);
      setBufferCount(dataBufferRef.current.length);
    }
  }, [sensors, selectedSensorTypes, config.faultChance, config.periodicity]);

  // Effect for sending full batches while running
  useEffect(() => {
    if (isRunning && !isSending && dataBufferRef.current.length >= config.batchSize) {
      const batch = dataBufferRef.current.splice(0, config.batchSize);
      setBufferCount(dataBufferRef.current.length);
      sendBatchData(batch);
    }
  }, [bufferCount, isRunning, isSending, config.batchSize, sendBatchData]);

  // Effect for flushing remaining data when stopping
  useEffect(() => {
    if (!isRunning && !isSending && dataBufferRef.current.length > 0) {
      const finalBatch = dataBufferRef.current.splice(0, dataBufferRef.current.length);
      setBufferCount(0);
      sendBatchData(finalBatch);
    }
  }, [isRunning, isSending, sendBatchData]);

  // Effect for the main generation interval
  useEffect(() => {
    if (isRunning) {
      const interval = 1000 / config.simulationSpeed;
      intervalRef.current = setInterval(generateData, interval);
      return () => clearInterval(intervalRef.current);
    }
  }, [isRunning, config.simulationSpeed, generateData]);

  // Auto-scroll log
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [log]);

  useEffect(() => {
    if (config.fetchSensors && sensors.length > 0) {
      setConfig(prev => ({
        ...prev,
        maxSensors: Math.min(prev.maxSensors, sensors.length)
      }));
    }
  }, [sensors, config.fetchSensors]);

  const handleConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value
    }));
  };

  const startSimulation = async () => {
    setLog([]);
    dataBufferRef.current = [];
    setBufferCount(0);
    setPushStatus({ message: 'Initializing...', type: 'idle' });
    
    if (config.fetchSensors) {
      await fetchConfiguredSensors();
    } else {
      generateRandomSensors();
    }
    
    setIsRunning(true);
  };

  const stopSimulation = () => {
    setIsRunning(false);
  };

  const refreshSensors = async () => {
    if (config.fetchSensors) {
      await fetchConfiguredSensors();
    } else {
      generateRandomSensors();
    }
  };

  const handleSensorTypeToggle = (sensorType) => {
    setSelectedSensorTypes(prev => {
      if (prev.includes(sensorType)) {
        return prev.filter(type => type !== sensorType);
      } else {
        return [...prev, sensorType];
      }
    });
  };

  const selectAllSensorTypes = () => {
    setSelectedSensorTypes([...availableSensorTypes]);
  };

  const deselectAllSensorTypes = () => {
    setSelectedSensorTypes([]);
  };

  const Slider = ({ name, label, min, max, step = 1 }) => (
    <div className="mb-3">
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">
        {label}: {config[name]}
      </label>
      <input
        type="range"
        id={name}
        name={name}
        min={min}
        max={max}
        step={step}
        value={config[name]}
        onChange={handleConfigChange}
        disabled={isRunning}
        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
      />
    </div>
  );

  const statusColors = {
    idle: 'bg-gray-700',
    sending: 'bg-blue-600',
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-yellow-600'
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white font-sans">
      {/* Control Panel */}
      <div className="w-full md:w-1/3 lg:w-1/4 p-4 bg-gray-800 shadow-lg overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-cyan-400 flex items-center">
          <Bot size={28} className="mr-2" />
          Traffic Monitoring Simulator
        </h2>
        
        {/* Core Settings */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 border-b border-gray-600 pb-1">
            Core Settings
          </h3>
          <div className="space-y-3 p-2">
            <Slider name="simulationSpeed" label="Simulation Speed" min="0.1" max="5" step="0.1" />
            <Slider name="faultChance" label="Fault Chance" min="0" max="0.5" step="0.01" />
            <Slider name="periodicity" label="Global Periodicity (sec)" min="1" max="300" />
            <Slider name="batchSize" label="Batch Size" min="1" max="1000" />
            
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="fetchSensors"
                name="fetchSensors"
                checked={config.fetchSensors}
                onChange={handleConfigChange}
                disabled={isRunning}
                className="mr-2"
              />
              <label htmlFor="fetchSensors" className="text-sm text-gray-300">
                Fetch sensors from backend
              </label>
            </div>
            
            {config.fetchSensors && (
              <div>
                <label htmlFor="sensorsEndpoint" className="block text-sm font-medium text-gray-300 mb-1">
                  Sensors Endpoint URL
                </label>
                <input
                  type="text"
                  id="sensorsEndpoint"
                  name="sensorsEndpoint"
                  value={config.sensorsEndpoint}
                  onChange={handleConfigChange}
                  disabled={isRunning}
                  className="w-full p-2 bg-gray-700 rounded-md border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50"
                />
              </div>
            )}
            
            <div>
              <label htmlFor="endpointUrl" className="block text-sm font-medium text-gray-300 mb-1">
                Ingestion Endpoint URL
              </label>
              <input
                type="text"
                id="endpointUrl"
                name="endpointUrl"
                value={config.endpointUrl}
                onChange={handleConfigChange}
                disabled={isRunning}
                className="w-full p-2 bg-gray-700 rounded-md border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50"
              />
            </div>
          </div>
        </div>
        
        {/* Sensor Type Filter */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 border-b border-gray-600 pb-1 flex items-center">
            <Filter size={20} className="mr-2" />
            Sensor Type Filter
          </h3>
          <div className="space-y-3 p-2">
            <div className="flex space-x-2 mb-2">
              <button
                onClick={selectAllSensorTypes}
                disabled={isRunning}
                className="flex-1 p-1 text-xs bg-green-600 hover:bg-green-500 rounded disabled:bg-gray-500 disabled:cursor-not-allowed"
              >
                Select All
              </button>
              <button
                onClick={deselectAllSensorTypes}
                disabled={isRunning}
                className="flex-1 p-1 text-xs bg-red-600 hover:bg-red-500 rounded disabled:bg-gray-500 disabled:cursor-not-allowed"
              >
                Clear All
              </button>
            </div>
            
            <div className="text-xs text-gray-400 mb-2">
              Selected: {selectedSensorTypes.length} of {availableSensorTypes.length}
            </div>
            
            {availableSensorTypes.length === 0 && (
              <div className="text-xs text-blue-400 bg-blue-900 bg-opacity-30 p-2 rounded">
                🔄 Loading sensor types...
              </div>
            )}
            
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {availableSensorTypes.map(sensorType => (
                <label key={sensorType} className="flex items-center text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSensorTypes.includes(sensorType)}
                    onChange={() => handleSensorTypeToggle(sensorType)}
                    disabled={isRunning}
                    className="mr-2"
                  />
                  <span className="text-gray-300">{sensorType}</span>
                </label>
              ))}
            </div>
            
            {selectedSensorTypes.length === 0 && availableSensorTypes.length > 0 && (
              <div className="text-xs text-yellow-400 bg-yellow-900 bg-opacity-30 p-2 rounded">
                ⚠️ No sensor types selected. No data will be generated.
              </div>
            )}
            
            <div className="text-xs text-gray-500 italic">
              Filter updates automatically based on available sensors
            </div>
          </div>
        </div>
        
        {/* Sensor Configuration */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 border-b border-gray-600 pb-1">
            Sensor Configuration
          </h3>
          <div className="space-y-3 p-2">
            <Slider name="maxSensors" label="Max Sensors" min={1} max={config.fetchSensors ? sensors.length || 1 : 5000} />
            <button
              onClick={refreshSensors}
              disabled={isRunning || isFetchingSensors}
              className="w-full flex items-center justify-center p-2 bg-blue-600 hover:bg-blue-500 rounded-md font-bold transition-all duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              <RefreshCw className="mr-2" size={20} />
              {isFetchingSensors ? 'Loading...' : 'Refresh Sensors'}
            </button>
            <div className="text-sm text-gray-400">
              Active Sensors: {sensors.length}
            </div>
            <div className="text-sm text-gray-400">
              Filtered Sensors: {sensors.filter(s => selectedSensorTypes.includes(s.type)).length}
            </div>
          </div>
        </div>
        
        {/* Statistics */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 border-b border-gray-600 pb-1">
            Statistics
          </h3>
          <div className="space-y-2 p-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">Total Records Sent:</span>
              <span className="font-mono">{stats.totalSent}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Current Rate:</span>
              <span className="font-mono">{stats.lastMinuteRate} records/min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Faults Detected:</span>
              <span className="font-mono">{stats.faultsDetected}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Buffer Size:</span>
              <span className="font-mono">{bufferCount} / {config.batchSize}</span>
            </div>
          </div>
        </div>
        
        {/* Control Buttons */}
        <div className="space-y-2">
          <button
            onClick={startSimulation}
            disabled={isRunning || isFetchingSensors || selectedSensorTypes.length === 0}
            className="w-full flex items-center justify-center p-2 bg-green-600 hover:bg-green-500 rounded-md font-bold transition-all duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            <Play className="mr-2" size={20} />
            Start Simulation
          </button>
          <button
            onClick={stopSimulation}
            disabled={!isRunning || isSending}
            className="w-full flex items-center justify-center p-2 bg-yellow-500 hover:bg-yellow-400 rounded-md font-bold transition-all duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            <Pause className="mr-2" size={20} />
            Stop Simulation
          </button>
          <button
            onClick={() => setLog([])}
            className="w-full flex items-center justify-center p-2 bg-red-600 hover:bg-red-500 rounded-md font-bold transition-all duration-200"
          >
            <XCircle className="mr-2" size={20} />
            Clear Log
          </button>
        </div>
        
        {/* Status Indicator */}
        <div className={`mt-4 p-2 rounded-md text-center text-sm font-bold flex items-center justify-center ${statusColors[pushStatus.type]}`}>
          {pushStatus.type === 'sending' && <Send size={16} className="mr-2 animate-pulse" />}
          {pushStatus.type === 'idle' && <Server size={16} className="mr-2" />}
          {pushStatus.message}
        </div>
      </div>
      
      {/* Data Log Panel */}
      <div className="flex-1 flex flex-col p-4">
        <h2 className="text-xl font-bold mb-2 text-cyan-400">
          Generated Sensor Data Stream
        </h2>
        <div className="mb-2 text-sm text-gray-400">
          Generating data for: {selectedSensorTypes.join(', ') || 'No sensor types selected'}
        </div>
        <div
          ref={logContainerRef}
          className="flex-1 bg-black bg-opacity-50 rounded-lg p-3 overflow-y-auto font-mono text-sm leading-6"
        >
          {log.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-500">
              {isRunning ? 'Generating data...' : 'Simulation stopped. Press Start to begin.'}
            </div>
          )}
          {log.map(entry => {
    const { Icon } = entry;
    return (
      <div
        key={entry.id}
        className={`p-3 mb-2 rounded-lg border-l-4 ${
          entry.isFaulty
            ? 'border-red-500 bg-red-900 bg-opacity-20'
            : 'border-cyan-500 bg-gray-800 bg-opacity-40'
        } transition-colors duration-500`}
      >
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center font-semibold">
            <Icon
              size={16}
              className={`mr-2 ${entry.isFaulty ? 'text-red-400' : 'text-cyan-400'}`}
            />
            <span className={`${entry.isFaulty ? 'text-red-400' : 'text-cyan-400'}`}>
              {entry.type}
            </span>
            {entry.isFaulty && (
              <span className="ml-3 text-xs font-bold bg-red-600 px-2 py-0.5 rounded-full flex items-center">
                <Zap size={12} className="mr-1" />
                FAULT DETECTED
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">{entry.timestamp}</span>
        </div>

        {/* Dropdown for full data */}
        <div className="w-full">
          <div
            className="cursor-pointer text-xs text-gray-400 hover:text-cyan-400"
            onClick={() => setLog(prev =>
              prev.map(e =>
                e.id === entry.id ? { ...e, expanded: !e.expanded } : e
              )
            )}
          >
            {entry.expanded ? 'Hide Details ▲' : 'Show Details ▼'}
          </div>
          {entry.expanded && (
            <pre className="w-full overflow-x-auto bg-black bg-opacity-30 p-2 rounded text-gray-200 text-xs mt-1">
              {entry.data}
            </pre>
          )}
        </div>
      </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}