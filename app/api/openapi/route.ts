import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';

/**
 * Serve OpenAPI specification
 * GET /api/openapi
 */
export async function GET() {
  try {
    // Read the OpenAPI spec file
    const specPath = join(process.cwd(), 'openapi.yaml');
    const specContent = readFileSync(specPath, 'utf-8');

    // Parse YAML to JSON
    const specJson = yaml.parse(specContent);

    // Return as JSON
    return NextResponse.json(specJson, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Allow CORS for API docs
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load OpenAPI specification' }, { status: 500 });
  }
}
