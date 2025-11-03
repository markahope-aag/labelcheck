'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">LabelCheck API Documentation</h1>
          <p className="text-muted-foreground">
            Interactive API documentation for FDA and USDA regulatory compliance analysis.
          </p>
        </div>

        <div className="bg-card rounded-lg border">
          <SwaggerUI url="/api/openapi" />
        </div>
      </div>
    </div>
  );
}
