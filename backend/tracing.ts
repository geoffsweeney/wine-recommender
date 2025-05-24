import { trace, Tracer, Span, SpanOptions, Context } from '@opentelemetry/api';

export function initTracing(serviceName: string): Tracer {
  const tracer = trace.getTracer(serviceName);
  
  // Add basic logging to verify spans
  const originalStartSpan = tracer.startSpan.bind(tracer);
  tracer.startSpan = function(name: string, options?: SpanOptions, context?: Context) {
    console.log(`Starting span: ${name}`);
    const span = originalStartSpan(name, options, context);
    
    const originalEnd = span.end.bind(span);
    span.end = function(endTime?: number) {
      console.log(`Ending span: ${name}`);
      return originalEnd(endTime);
    };
    
    return span;
  };
  
  return tracer;
}