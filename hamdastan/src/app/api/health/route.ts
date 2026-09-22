import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness probe for Docker / Kubernetes.
 *
 * There are no downstream dependencies to check yet. When a database or an
 * external service is added, probe it here and fold the result into `checks`
 * so a degraded dependency returns 503 and takes the instance out of rotation.
 */
export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {};

  const allOk = Object.values(checks).every((v) => v === 'ok');

  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', checks, uptime: process.uptime() },
    { status: allOk ? 200 : 503 }
  );
}
