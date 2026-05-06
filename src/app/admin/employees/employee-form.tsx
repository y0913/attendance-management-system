'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { upsertEmployeeAction } from './actions';

export interface EmployeeFormInitial {
  id?: string;
  name: string;
  email: string;
  role: 'admin' | 'approver' | 'general';
  managerId: string | null;
  employmentType: 'monthly' | 'hourly';
  hiredAt: string;
  baseSalary: number | null;
}

interface ManagerOption {
  id: string;
  name: string;
  role: string;
}

interface Props {
  initial: EmployeeFormInitial;
  managerCandidates: ManagerOption[];
  isCreate: boolean;
}

const ROLE_OPTIONS: Array<{ value: 'admin' | 'approver' | 'general'; label: string }> = [
  { value: 'general', label: '一般' },
  { value: 'approver', label: '承認者' },
  { value: 'admin', label: '管理者' },
];

const EMPLOYMENT_OPTIONS: Array<{ value: 'monthly' | 'hourly'; label: string }> = [
  { value: 'monthly', label: '月給' },
  { value: 'hourly', label: '時給' },
];

export function EmployeeForm({ initial, managerCandidates, isCreate }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [role, setRole] = useState(initial.role);
  const [managerId, setManagerId] = useState<string | ''>(
    initial.managerId ?? '',
  );
  const [employmentType, setEmploymentType] = useState(initial.employmentType);
  const [hiredAt, setHiredAt] = useState(initial.hiredAt);
  const [baseSalary, setBaseSalary] = useState<string>(
    initial.baseSalary === null ? '' : String(initial.baseSalary),
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length === 0) {
      setError('名前を入力してください');
      return;
    }
    if (email.trim().length === 0) {
      setError('メールアドレスを入力してください');
      return;
    }
    let salary: number | null = null;
    if (baseSalary.trim().length > 0) {
      const n = Number(baseSalary);
      if (!Number.isInteger(n) || n < 0) {
        setError('基本給は 0 以上の整数で入力してください');
        return;
      }
      salary = n;
    }

    startTransition(async () => {
      const result = await upsertEmployeeAction({
        id: initial.id,
        name: name.trim(),
        email: email.trim(),
        role,
        managerId: managerId === '' ? null : managerId,
        employmentType,
        hiredAt,
        baseSalary: salary,
      });
      if (result.ok) {
        router.push('/admin/employees');
        router.refresh();
        return;
      }
      if (result.error.code === 'CONFLICT') {
        setError(result.error.message ?? '更新に失敗しました');
      } else if (result.error.code === 'VALIDATION') {
        setError('入力内容に誤りがあります');
      } else if (result.error.code === 'FORBIDDEN') {
        setError('権限がありません');
      } else if (result.error.code === 'NOT_FOUND') {
        setError('対象ユーザーが見つかりません');
      } else {
        setError('保存に失敗しました');
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emp-name">名前</Label>
          <Input
            id="emp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emp-email">メールアドレス</Label>
          <Input
            id="emp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emp-role">ロール</Label>
          <select
            id="emp-role"
            value={role}
            onChange={(e) =>
              setRole(e.target.value as 'admin' | 'approver' | 'general')
            }
            className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emp-manager">承認者（上長）</Label>
          <select
            id="emp-manager"
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
          >
            <option value="">（なし）</option>
            {managerCandidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}（{m.role}）
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emp-employment">雇用形態</Label>
          <select
            id="emp-employment"
            value={employmentType}
            onChange={(e) =>
              setEmploymentType(e.target.value as 'monthly' | 'hourly')
            }
            className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
          >
            {EMPLOYMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emp-salary">
            基本給
            <span className="ml-1 text-xs text-muted-foreground">
              （円・空欄可）
            </span>
          </Label>
          <Input
            id="emp-salary"
            type="number"
            inputMode="numeric"
            min={0}
            value={baseSalary}
            onChange={(e) => setBaseSalary(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emp-hired-at">入社日</Label>
          <Input
            id="emp-hired-at"
            type="date"
            value={hiredAt}
            onChange={(e) => setHiredAt(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/employees')}
          disabled={pending}
        >
          キャンセル
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? '保存中...' : isCreate ? '作成' : '保存'}
        </Button>
      </div>
    </form>
  );
}
