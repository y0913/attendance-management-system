'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { recordAuditLog } from '@/lib/mock/audit-logs';
import { getMockSession } from '@/lib/mock/session';
import {
  createMockUser,
  findMockUserById,
  isEmailTaken,
  setUserDeactivation,
  updateMockUser,
} from '@/lib/mock/users';

const RoleEnum = z.enum(['admin', 'approver', 'general']);
const EmploymentEnum = z.enum(['monthly', 'hourly']);

const UpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(80),
  email: z.string().email().max(200),
  role: RoleEnum,
  managerId: z.string().nullable(),
  employmentType: EmploymentEnum,
  hiredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  baseSalary: z.number().int().nonnegative().nullable(),
});

const SetDeactivationSchema = z.object({
  id: z.string().min(1),
  deactivate: z.boolean(),
});

interface UpsertInput {
  id?: string;
  name: string;
  email: string;
  role: 'admin' | 'approver' | 'general';
  managerId: string | null;
  employmentType: 'monthly' | 'hourly';
  hiredAt: string;
  baseSalary: number | null;
}

const toJstStartOfDay = (jstDate: string): Date =>
  new Date(`${jstDate}T00:00:00+09:00`);

export async function upsertEmployeeAction(
  input: UpsertInput,
): Promise<ActionResult<{ id: string }>> {
  const session = await getMockSession();
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED' } };
  if (session.role !== 'admin') {
    return { ok: false, error: { code: 'FORBIDDEN' } };
  }

  const parsed = UpsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }
  const data = parsed.data;

  // 自分自身が管理者でなくなる更新は禁止（管理権限のロックアウト防止）
  if (data.id === session.id && data.role !== 'admin') {
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message: '自分自身のロールを admin から降格することはできません',
      },
    };
  }

  // 自分自身を管理者として指定（循環）
  if (data.id && data.managerId === data.id) {
    return {
      ok: false,
      error: { code: 'CONFLICT', message: '自分自身を承認者に指定できません' },
    };
  }

  if (data.managerId !== null && !(await findMockUserById(data.managerId))) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: { managerId: '存在しないユーザー' } },
    };
  }

  if (await isEmailTaken(data.email, data.id)) {
    return {
      ok: false,
      error: { code: 'CONFLICT', message: 'メールアドレスが既に使われています' },
    };
  }

  const hiredAt = toJstStartOfDay(data.hiredAt);

  if (data.id) {
    const target = await findMockUserById(data.id);
    if (!target) return { ok: false, error: { code: 'NOT_FOUND' } };
    const beforeSnap = { ...target };
    const updated = await updateMockUser(data.id, {
      name: data.name,
      email: data.email,
      role: data.role,
      managerId: data.managerId,
      employmentType: data.employmentType,
      hiredAt,
      baseSalary: data.baseSalary,
    });
    await recordAuditLog({
      entityType: 'user',
      entityId: data.id,
      action: 'update',
      actorId: session.id,
      before: beforeSnap,
      after: updated,
    });
    revalidatePath('/admin/employees');
    revalidatePath(`/admin/employees/${data.id}`);
    revalidatePath('/admin/audit-logs');
    return { ok: true, data: { id: data.id } };
  }

  const created = await createMockUser({
    name: data.name,
    email: data.email,
    role: data.role,
    managerId: data.managerId,
    employmentType: data.employmentType,
    hiredAt,
    baseSalary: data.baseSalary,
  });
  await recordAuditLog({
    entityType: 'user',
    entityId: created.id,
    action: 'create',
    actorId: session.id,
    before: null,
    after: created,
  });
  revalidatePath('/admin/employees');
  revalidatePath('/admin/audit-logs');
  return { ok: true, data: { id: created.id } };
}

export async function setEmployeeDeactivationAction(input: {
  id: string;
  deactivate: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const session = await getMockSession();
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED' } };
  if (session.role !== 'admin') {
    return { ok: false, error: { code: 'FORBIDDEN' } };
  }

  const parsed = SetDeactivationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', details: parsed.error.flatten() },
    };
  }

  if (parsed.data.id === session.id && parsed.data.deactivate) {
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message: '自分自身を無効化することはできません',
      },
    };
  }

  const target = await findMockUserById(parsed.data.id);
  if (!target) return { ok: false, error: { code: 'NOT_FOUND' } };

  const beforeSnap = { ...target };
  const updated = await setUserDeactivation(
    parsed.data.id,
    parsed.data.deactivate ? new Date() : null,
  );
  await recordAuditLog({
    entityType: 'user',
    entityId: parsed.data.id,
    action: parsed.data.deactivate ? 'deactivate' : 'reactivate',
    actorId: session.id,
    before: beforeSnap,
    after: updated,
  });
  revalidatePath('/admin/employees');
  revalidatePath(`/admin/employees/${parsed.data.id}`);
  revalidatePath('/admin/audit-logs');
  return { ok: true, data: { id: parsed.data.id } };
}
