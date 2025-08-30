import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, XCircle, Bot, Zap, ChevronsRight, Thermometer, Wind, Car, Footprints, Siren, Send, Server } from 'lucide-react';

// --- Helper Functions for Data Generation (Unchanged) ---
const getRandomFloat = (min, max, decimals = 2) => (Math.random() * (max - min) + min).toFixed(decimals);
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const generateVehicleId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    return `${getRandomElement(chars)}${getRandomElement(chars)}${getRandomElement(chars)}${getRandomInt(100, 999)}`;
};

// --- Data Generation Functions (Unchanged) ---
const generateBaseMetadata = (sensor) => ({ timestamp: new Date().toISOString(), sensor_id: sensor.id, sensor_type: sensor.type, location: sensor.location, confidence_score: parseFloat(getRandomFloat(0.85, 0.99)), });
const generateVehicleCountData = (config) => ({ type: 'VehicleCount', icon: Car, data: { vehicle_count: getRandomInt(config.vehicleCountMin, config.vehicleCountMax), vehicle_class_counts: { car: getRandomInt(0, config.vehicleCountMax), truck: getRandomInt(0, 20), bus: getRandomInt(0, 5), motorcycle: getRandomInt(0, 15) }, measurement_interval_seconds: config.periodicity, } });
const generateVehicleSpeedData = (config) => ({ type: 'VehicleSpeed', icon: ChevronsRight, data: { average_speed_kmh: parseFloat(getRandomFloat(config.avgSpeedMin, config.avgSpeedMax)), speed_limit_kmh: 60, measurement_interval_seconds: config.periodicity, } });
const generateIncidentData = () => ({ type: 'Incident', icon: Siren, data: { incident_id: `INC-${Date.now()}`, incident_type: getRandomElement(['Accident', 'Stalled Vehicle', 'Debris on Road']), severity: getRandomElement(['Low', 'Moderate', 'High']), vehicles_involved: [generateVehicleId()], lane_affected: [String(getRandomInt(1, 4))], verified: false, detection_method: 'AI_Video_Analytics', } });
const generateAirQualityData = (config) => ({ type: 'AirQuality', icon: Wind, data: { co_ppm: parseFloat(getRandomFloat(config.coMin, config.coMax)), no2_ppb: parseFloat(getRandomFloat(config.no2Min, config.no2Max)), pm2_5_ug_per_m3: parseFloat(getRandomFloat(config.pm25Min, config.pm25Max)), aqi: getRandomInt(20, 150), measurement_interval_seconds: 300, } });
const generateRoadConditionData = (config) => ({ type: 'RoadCondition', icon: Thermometer, data: { road_condition: getRandomElement(['Dry', 'Wet', 'Very Wet']), surface_temperature_celsius: parseFloat(getRandomFloat(config.tempMin, config.tempMax)), pothole_detected: Math.random() < 0.05, icing_risk_level: getRandomElement(['Low', 'Medium', 'High']), } });
const generatePedestrianData = (config) => ({ type: 'PedestrianCount', icon: Footprints, data: { pedestrian_count: getRandomInt(config.pedestrianMin, config.pedestrianMax), cyclist_count: getRandomInt(config.cyclistMin, config.cyclistMax), measurement_interval_seconds: 300, } });


// Main App Component
export default function App() {
    const [config, setConfig] = useState({
        numSensors: 10,
        periodicity: 5, // seconds
        faultChance: 0.05, // 5% chance
        batchSize: 25,
        endpointUrl: 'https://httpbin.org/post', // A public test endpoint
        vehicleCountMin: 10,
        vehicleCountMax: 200,
        avgSpeedMin: 40,
        avgSpeedMax: 90,
        coMin: 1,
        coMax: 10,
        no2Min: 20,
        no2Max: 100,
        pm25Min: 5,
        pm25Max: 50,
        tempMin: -5,
        tempMax: 35,
        pedestrianMin: 0,
        pedestrianMax: 50,
        cyclistMin: 0,
        cyclistMax: 25,
    });

    const [isRunning, setIsRunning] = useState(false);
    const [log, setLog] = useState([]);
    const [sensors, setSensors] = useState([]);
    const [pushStatus, setPushStatus] = useState({ message: 'Idle', type: 'idle' });
    const [bufferCount, setBufferCount] = useState(0);
    
    const intervalRef = useRef(null);
    const logContainerRef = useRef(null);
    const dataBufferRef = useRef([]);

    const SENSOR_TYPES = ['Radar', 'Infrared', 'LiDAR', 'Camera', 'AirQualityStation'];
    const DATA_GENERATORS = { 'Radar': [generateVehicleCountData, generateVehicleSpeedData], 'LiDAR': [generateVehicleCountData, generateVehicleSpeedData], 'Infrared': [generatePedestrianData, generateRoadConditionData], 'Camera': [generateIncidentData, generateVehicleCountData], 'AirQualityStation': [generateAirQualityData] };
    const SUVA_REKA_CENTER = { lat: 42.3594, lon: 20.8258 };

    const sendBatchData = useCallback(async (batch) => {
        if (!config.endpointUrl) {
            setPushStatus({ message: 'Endpoint URL not set.', type: 'error' });
            return;
        }
        setPushStatus({ message: `Sending ${batch.length} records...`, type: 'sending' });
        try {
            const response = await fetch(config.endpointUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batch),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server responded with ${response.status}: ${errorText}`);
            }
            setPushStatus({ message: `Success! Sent ${batch.length} records.`, type: 'success' });
        } catch (error) {
            setPushStatus({ message: `Error: ${error.message}`, type: 'error' });
            console.error("Batch send failed:", error);
        }
    }, [config.endpointUrl]);

    const addVisualLogEntry = (type, data, isFaulty, IconComponent) => {
        const newEntry = { id: Date.now() + Math.random(), type, data: JSON.stringify(data, null, 2), timestamp: new Date().toLocaleTimeString(), isFaulty, Icon: IconComponent || Bot };
        setLog(prev => {
            const newLog = [...prev, newEntry];
            return newLog.length > 200 ? newLog.slice(newLog.length - 200) : newLog;
        });
    };

    const generateData = useCallback(() => {
        const packetsForBuffer = [];
        sensors.forEach(sensor => {
            if (Math.random() < 0.7) {
                const possibleGenerators = DATA_GENERATORS[sensor.type] || [generateVehicleCountData];
                const generatorFunc = getRandomElement(possibleGenerators);
                let eventData, fullPacket, isFaulty = false;

                if (Math.random() < 0.02 && sensor.type === 'Camera') {
                    eventData = generateIncidentData();
                    fullPacket = { ...generateBaseMetadata(sensor), ...eventData.data };
                } else {
                    eventData = generatorFunc(config);
                    isFaulty = Math.random() < config.faultChance;
                    fullPacket = { ...generateBaseMetadata(sensor), ...eventData.data };
                    if (isFaulty) {
                        const keyToFault = getRandomElement(Object.keys(fullPacket).filter(k => typeof fullPacket[k] === 'number'));
                        if (keyToFault) fullPacket[keyToFault] = fullPacket[keyToFault] * getRandomElement([-10, 10, 100]);
                        fullPacket.confidence_score = parseFloat(getRandomFloat(0.1, 0.4));
                    }
                }
                addVisualLogEntry(eventData.type, fullPacket, isFaulty, eventData.icon);
                packetsForBuffer.push(fullPacket);
            }
        });

        if (packetsForBuffer.length > 0) {
            dataBufferRef.current.push(...packetsForBuffer);
            setBufferCount(dataBufferRef.current.length);
        }
    }, [sensors, config]);
    
    useEffect(() => {
        const buffer = dataBufferRef.current;
        if (buffer.length >= config.batchSize) {
            const batch = buffer.splice(0, config.batchSize);
            setBufferCount(buffer.length);
            sendBatchData(batch);
        }
    }, [bufferCount, config.batchSize, sendBatchData]);

    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(generateData, config.periodicity * 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [isRunning, config.periodicity, generateData]);

    useEffect(() => {
        if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }, [log]);

    const handleConfigChange = (e) => {
        const { name, value, type } = e.target;
        setConfig(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
    };

    const initializeSensors = () => {
        const newSensors = Array.from({ length: config.numSensors }, (_, i) => {
            const type = getRandomElement(SENSOR_TYPES);
            return { id: `SENSOR-${type.slice(0, 4).toUpperCase()}-${String(i + 1).padStart(3, '0')}`, type: type, location: { type: "Point", coordinates: [parseFloat(getRandomFloat(SUVA_REKA_CENTER.lon - 0.1, SUVA_REKA_CENTER.lon + 0.1, 6)), parseFloat(getRandomFloat(SUVA_REKA_CENTER.lat - 0.1, SUVA_REKA_CENTER.lat + 0.1, 6))] } };
        });
        setSensors(newSensors);
    };

    const startSimulation = () => {
        setLog([]);
        dataBufferRef.current = [];
        setBufferCount(0);
        setPushStatus({ message: 'Idle', type: 'idle' });
        initializeSensors();
        setIsRunning(true);
    };

    const stopSimulation = () => {
        setIsRunning(false);
        const buffer = dataBufferRef.current;
        if (buffer.length > 0) {
            sendBatchData(buffer);
            dataBufferRef.current = [];
            setBufferCount(0);
        }
    };

    const Slider = ({ name, label, min, max, step = 1 }) => (<div><label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">{label}: {config[name]}</label><input type="range" id={name} name={name} min={min} max={max} step={step} value={config[name]} onChange={handleConfigChange} disabled={isRunning} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:opacity-50" /></div>);
    const statusColors = { idle: 'bg-gray-700', sending: 'bg-blue-600', success: 'bg-green-600', error: 'bg-red-600' };

    return (
        <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white font-sans">
            <div className="w-full md:w-1/3 lg:w-1/4 p-4 bg-gray-800 shadow-lg overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4 text-cyan-400 flex items-center"><Bot size={28} className="mr-2" />Sensor Simulator</h2>
                <div className="space-y-4">
                    {/* Core Settings */}
                    <div><h3 className="text-lg font-semibold mb-2 border-b border-gray-600 pb-1">Core Settings</h3><div className="space-y-3 p-2"><Slider name="numSensors" label="Number of Sensors" min="1" max="100" /><Slider name="periodicity" label="Periodicity (sec)" min="1" max="10" /><Slider name="faultChance" label="Fault Chance" min="0" max="1" step="0.01" /></div></div>
                    
                    {/* Backend Settings */}
                    <div>
                        <h3 className="text-lg font-semibold mb-2 border-b border-gray-600 pb-1">Backend Settings</h3>
                        <div className="space-y-3 p-2">
                            <div>
                                <label htmlFor="endpointUrl" className="block text-sm font-medium text-gray-300 mb-1">Ingestion Endpoint URL</label>
                                <input type="text" id="endpointUrl" name="endpointUrl" value={config.endpointUrl} onChange={handleConfigChange} disabled={isRunning} className="w-full p-2 bg-gray-700 rounded-md border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50" />
                            </div>
                            <Slider name="batchSize" label="Batch Size" min="1" max="100" />
                            <div className="text-sm text-gray-400">Buffer: {bufferCount} / {config.batchSize}</div>
                        </div>
                    </div>
                    
                    {/* Data Ranges */}
                    <div><h3 className="text-lg font-semibold mb-2 border-b border-gray-600 pb-1">Data Ranges</h3><div className="space-y-3 p-2"><Slider name="vehicleCountMin" label="Vehicle Count Min" min="0" max="100" /><Slider name="vehicleCountMax" label="Vehicle Count Max" min="100" max="500" /><Slider name="avgSpeedMin" label="Avg Speed Min (km/h)" min="10" max="60" /><Slider name="avgSpeedMax" label="Avg Speed Max (km/h)" min="60" max="140" /><Slider name="pedestrianMin" label="Pedestrian Min" min="0" max="50" /><Slider name="pedestrianMax" label="Pedestrian Max" min="50" max="200" /><Slider name="tempMin" label="Surface Temp Min (°C)" min="-20" max="10" /><Slider name="tempMax" label="Surface Temp Max (°C)" min="10" max="50" /></div></div>
                </div>

                <div className="mt-6 flex space-x-2"><button onClick={startSimulation} disabled={isRunning} className="w-full flex items-center justify-center p-2 bg-green-600 hover:bg-green-500 rounded-md font-bold transition-all duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"><Play className="mr-2" size={20} />Start</button><button onClick={stopSimulation} disabled={!isRunning} className="w-full flex items-center justify-center p-2 bg-yellow-500 hover:bg-yellow-400 rounded-md font-bold transition-all duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"><Pause className="mr-2" size={20} />Stop</button></div>
                <button onClick={() => setLog([])} className="mt-2 w-full flex items-center justify-center p-2 bg-red-600 hover:bg-red-500 rounded-md font-bold transition-all duration-200"><XCircle className="mr-2" size={20} />Clear Log</button>
                <div className={`mt-4 p-2 rounded-md text-center text-sm font-bold flex items-center justify-center ${statusColors[pushStatus.type]}`}>
                    {pushStatus.type === 'sending' && <Send size={16} className="mr-2 animate-pulse" />}
                    {pushStatus.type === 'idle' && <Server size={16} className="mr-2" />}
                    {pushStatus.message}
                </div>
            </div>

            <div className="flex-1 flex flex-col p-4"><h2 className="text-xl font-bold mb-2 text-cyan-400">Generated Sensor Data Stream</h2><div ref={logContainerRef} className="flex-1 bg-black bg-opacity-50 rounded-lg p-3 overflow-y-auto font-mono text-sm leading-6">{log.length === 0 && (<div className="flex items-center justify-center h-full text-gray-500">{isRunning ? 'Generating data...' : 'Simulation stopped. Press Start to begin.'}</div>)}{log.map(entry => {const { Icon } = entry; return (<div key={entry.id} className={`p-3 mb-2 rounded-lg border-l-4 ${entry.isFaulty ? 'border-red-500 bg-red-900 bg-opacity-20' : 'border-cyan-500 bg-gray-800 bg-opacity-40'} transition-colors duration-500`}><div className="flex justify-between items-center mb-2"><div className="flex items-center font-semibold"><Icon size={16} className={`mr-2 ${entry.isFaulty ? 'text-red-400' : 'text-cyan-400'}`} /><span className={`${entry.isFaulty ? 'text-red-400' : 'text-cyan-400'}`}>{entry.type}</span>{entry.isFaulty && <span className="ml-3 text-xs font-bold bg-red-600 px-2 py-0.5 rounded-full flex items-center"><Zap size={12} className="mr-1" />FAULT DETECTED</span>}</div><span className="text-xs text-gray-400">{entry.timestamp}</span></div><pre className="w-full overflow-x-auto bg-black bg-opacity-30 p-2 rounded text-gray-200 text-xs">{entry.data}</pre></div>)})}</div></div>
        </div>
    );
}
