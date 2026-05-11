import { renderToBuffer } from '@react-pdf/renderer';
import type { NextRequest } from 'next/server';
import { AttendanceMonthlyPdf } from '@/lib/pdf/attendance-monthly-pdf';
import { getEffectiveMonthlySummary } from '@/lib/data/attendance-closings';
import { currentYearMonthJst } from '@/lib/data/attendance-summary';
import { getCompany } from '@/lib/data/companies';
import { getMockSession } from '@/lib/data/session';
import { findMockUserById } from '@/lib/data/users';

export const runtime = 'nodejs';

const isValidYm = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const session = await getMockSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  if (session.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  const { userId } = await context.params;
  const target = await findMockUserById(userId);
  if (!target || target.companyId !== session.companyId) {
    return new Response('Not Found', { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const ymParam = searchParams.get('ym');
  const ym = ymParam && isValidYm(ymParam) ? ymParam : currentYearMonthJst();

  const company = await getCompany(session.companyId);
  const summary = await getEffectiveMonthlySummary(target.id, ym);

  const buffer = await renderToBuffer(
    AttendanceMonthlyPdf({
      company,
      user: target,
      yearMonth: ym,
      summary,
      generatedAt: new Date(),
    }),
  );

  const filename = `attendance_${target.id}_${ym}.pdf`;
  // Convert Node Buffer to Uint8Array for the Web Response body.
  const body = new Uint8Array(buffer);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(body.byteLength),
    },
  });
}
