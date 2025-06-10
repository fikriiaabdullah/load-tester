const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware untuk menerima request berukuran besar
app.use(bodyParser.json({limit: '10mb'}));
app.use(bodyParser.text({limit: '10mb'}));

// Menyimpan statistik request
let stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  requestsBySize: {
    small: 0,    // <= 10KB
    medium: 0,   // 10KB - 100KB
    large: 0,    // 100KB - 1MB
    xlarge: 0    // > 1MB
  },
  responseTimeStats: {
    totalTime: 0,
    count: 0
  },
  startTime: new Date(),
  currentLoad: 0,
  peakLoad: 0
};

// Simulasi memory usage tracking
let memoryPressure = 0;
const MAX_MEMORY_PRESSURE = 1000;

// Endpoint utama untuk pengujian - dengan simulasi beban yang realistis
app.post('/test', (req, res) => {
  const startTime = Date.now();
  stats.totalRequests++;
  stats.currentLoad++;
  
  // Update peak load
  if (stats.currentLoad > stats.peakLoad) {
    stats.peakLoad = stats.currentLoad;
  }
  
  // Mendapatkan ukuran request body
  const bodySize = req.body ? JSON.stringify(req.body).length : 0;
  
  // Klasifikasi request berdasarkan ukuran
  if (bodySize <= 10 * 1024) {
    stats.requestsBySize.small++;
  } else if (bodySize <= 100 * 1024) {
    stats.requestsBySize.medium++;
  } else if (bodySize <= 1024 * 1024) {
    stats.requestsBySize.large++;
  } else {
    stats.requestsBySize.xlarge++;
  }
  
  // Simulasi memory pressure berdasarkan ukuran request
  memoryPressure += Math.ceil(bodySize / 10240); // Setiap 10KB menambah 1 unit pressure
  
  // Simulasi processing yang lebih realistis
  // Semakin besar request dan semakin tinggi memory pressure, semakin lambat
  const baseProcessingTime = Math.min(bodySize / 5120, 1000); // Base time berdasarkan ukuran
  const pressureMultiplier = Math.min(memoryPressure / 100, 5); // Multiplier berdasarkan pressure
  const processingTime = baseProcessingTime * (1 + pressureMultiplier);
  
  // Simulasi kondisi server overload
  if (memoryPressure > MAX_MEMORY_PRESSURE) {
    stats.failedRequests++;
    stats.currentLoad--;
    
    // Memory pressure cleanup (simulasi garbage collection)
    memoryPressure = Math.max(0, memoryPressure - 100);
    
    return res.status(503).json({
      error: 'Server overloaded',
      message: 'Too many concurrent requests',
      memoryPressure: memoryPressure,
      timestamp: new Date()
    });
  }
  
  // Simulasi random failures pada high load
  if (stats.currentLoad > 5000 && Math.random() < 0.1) {
    stats.failedRequests++;
    stats.currentLoad--;
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Random failure due to high load',
      currentLoad: stats.currentLoad,
      timestamp: new Date()
    });
  }
  
  setTimeout(() => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Update response time stats
    stats.responseTimeStats.totalTime += responseTime;
    stats.responseTimeStats.count++;
    stats.successfulRequests++;
    stats.currentLoad--;
    
    // Memory pressure cleanup (simulasi memory release)
    memoryPressure = Math.max(0, memoryPressure - Math.ceil(bodySize / 20480));
    
    res.json({
      success: true,
      message: 'Request processed successfully',
      receivedBytes: bodySize,
      processingTime: responseTime,
      currentLoad: stats.currentLoad,
      memoryPressure: memoryPressure,
      timestamp: new Date()
    });
  }, processingTime);
});

// Endpoint untuk mendapatkan statistik real-time
app.get('/stats', (req, res) => {
  const runningTime = (new Date() - stats.startTime) / 1000;
  const avgResponseTime = stats.responseTimeStats.count > 0 
    ? (stats.responseTimeStats.totalTime / stats.responseTimeStats.count).toFixed(2)
    : 0;
  
  res.json({
    ...stats,
    runningTimeSeconds: runningTime,
    requestsPerSecond: (stats.totalRequests / runningTime).toFixed(2),
    averageResponseTime: avgResponseTime,
    successRate: ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2),
    currentMemoryPressure: memoryPressure,
    serverStatus: memoryPressure > MAX_MEMORY_PRESSURE * 0.8 ? 'HIGH_LOAD' : 'NORMAL'
  });
});

// Endpoint untuk reset statistik
app.post('/reset-stats', (req, res) => {
  stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    requestsBySize: {
      small: 0,
      medium: 0,
      large: 0,
      xlarge: 0
    },
    responseTimeStats: {
      totalTime: 0,
      count: 0
    },
    startTime: new Date(),
    currentLoad: 0,
    peakLoad: 0
  };
  
  memoryPressure = 0;
  
  res.json({
    success: true,
    message: 'Statistics have been reset'
  });
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: memoryPressure > MAX_MEMORY_PRESSURE * 0.8 ? 'UNDER_PRESSURE' : 'OK',
    message: 'Server is running and ready for extreme load testing',
    currentLoad: stats.currentLoad,
    memoryPressure: memoryPressure,
    maxMemoryPressure: MAX_MEMORY_PRESSURE
  });
});

// Endpoint untuk memaksa server error (untuk testing)
app.post('/force-error', (req, res) => {
  memoryPressure = MAX_MEMORY_PRESSURE + 100;
  res.status(500).json({
    message: 'Server forced into error state',
    memoryPressure: memoryPressure
  });
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Endpoints available:`);
  console.log(`- POST /test - Main testing endpoint`);
  console.log(`- GET /stats - View request statistics`);
  console.log(`- POST /reset-stats - Reset statistics`);
  console.log(`- POST /force-error - Force server into error state`);
  console.log(`\nReady for EXTREME load testing!`);
});