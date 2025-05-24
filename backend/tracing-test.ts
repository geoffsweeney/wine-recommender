import { initTracing } from './tracing';

const tracer = initTracing('test-service');

// Create a simple span
const span = tracer.startSpan('test-operation');
span.setAttribute('test', 'value');
span.end();

console.log('Tracing test completed');