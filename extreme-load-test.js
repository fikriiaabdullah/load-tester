import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// Mencatat jumlah permintaan berhasil dan gagal
const successCounter = new Counter('success_counter');
const failCounter = new Counter('fail_counter');

// Membuat payload dengan ukuran tertentu (dalam bytes)
function generatePayload(sizeInKB) {
  const sizeInBytes = sizeInKB * 1024;
  return 'A'.repeat(sizeInBytes);
}

// Konfigurasi pengujian beban EKSTREM untuk mencapai batas server
export const options = {
  scenarios: {
    extreme_load: {
      executor: 'ramping-vus',
      startVUs: 50,  // Mulai lebih tinggi
      stages: [
        { duration: '30s', target: 500 },    // Langsung ke 500 pengguna
        { duration: '1m', target: 1000 },    // Naik ke 1000 pengguna
        { duration: '1m', target: 2000 },    // Naik ke 2000 pengguna
        { duration: '1m', target: 3000 },    // Naik ke 3000 pengguna
        { duration: '1m', target: 4000 },    // Naik ke 4000 pengguna
        { duration: '2m', target: 5000 },    // Naik ke 5000 pengguna
        { duration: '2m', target: 7000 },    // Naik ke 7000 pengguna
        { duration: '2m', target: 10000 },   // EKSTREM: 10000 pengguna
        { duration: '2m', target: 10000 },   // Pertahankan 10000 pengguna
        { duration: '1m', target: 0 },       // Cool down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<10000'],  // Meningkatkan threshold menjadi 10 detik
    http_req_failed: ['rate<0.5'],       // Menerima tingkat kegagalan hingga 50%
  },
};

export default function() {
  const url = 'http://localhost:3000/test';
  
  // Test 10KB Request - Frekuensi tinggi
  const payload10KB = generatePayload(10);
  const response10KB = http.post(url, payload10KB, {
    tags: { name: 'Request-10KB' },
    headers: { 'Content-Type': 'text/plain' },
    timeout: '5s',  // Timeout lebih pendek untuk memaksa error
  });
  
  check(response10KB, {
    'status 10KB is 200': (r) => r.status === 200,
    'response time 10KB < 3000ms': (r) => r.timings.duration < 3000,
  }) ? successCounter.add(1, { size: '10KB' }) : failCounter.add(1, { size: '10KB' });
  
  // TANPA SLEEP - Maksimalkan pressure
  
  // Test 100KB Request
  const payload100KB = generatePayload(100);
  const response100KB = http.post(url, payload100KB, {
    tags: { name: 'Request-100KB' },
    headers: { 'Content-Type': 'text/plain' },
    timeout: '8s',
  });
  
  check(response100KB, {
    'status 100KB is 200': (r) => r.status === 200,
    'response time 100KB < 5000ms': (r) => r.timings.duration < 5000,
  }) ? successCounter.add(1, { size: '100KB' }) : failCounter.add(1, { size: '100KB' });
  
  // Test 1MB Request - Payload maksimal tetap 1MB
  const payload1MB = generatePayload(1024);
  const response1MB = http.post(url, payload1MB, {
    tags: { name: 'Request-1MB' },
    headers: { 'Content-Type': 'text/plain' },
    timeout: '10s',
  });
  
  check(response1MB, {
    'status 1MB is 200': (r) => r.status === 200,
    'response time 1MB < 8000ms': (r) => r.timings.duration < 8000,
  }) ? successCounter.add(1, { size: '1MB' }) : failCounter.add(1, { size: '1MB' });
  
  // BONUS: Tambah request ekstra untuk meningkatkan pressure
  // Multiple small requests berturut-turut
  for (let i = 0; i < 3; i++) {
    const quickPayload = generatePayload(5); // 5KB payload
    const quickResponse = http.post(url, quickPayload, {
      tags: { name: 'Quick-Request' },
      headers: { 'Content-Type': 'text/plain' },
      timeout: '3s',
    });
    
    check(quickResponse, {
      'quick status is 200': (r) => r.status === 200,
    }) ? successCounter.add(1, { size: '5KB' }) : failCounter.add(1, { size: '5KB' });
  }
  
  // Sleep minimal untuk memaksimalkan request rate
  sleep(0.1);  // Hanya 100ms sleep
}