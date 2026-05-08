// Server Action のテスト全般で共通利用する MockUser 風のフィクスチャ。
// 各テストで MOCK_USERS をローカルに inline 定義するのを避けるため集約。
//
// 値は `getMockSession()` の戻り型 (lib/data/users の MockUser) に合わせた形にしている。
// テストは role / id を override したい場合がほとんどなので、spread でカスタムするのが定石。

export const adminUser = {
  id: 'u_admin',
  email: 'admin@example.com',
  name: '管理 太郎',
  role: 'admin' as const,
  managerId: null,
  employmentType: 'monthly' as const,
  hiredAt: new Date('2018-04-01'),
  baseSalary: 600000,
  deactivatedAt: null,
};

export const approverUser = {
  id: 'u_approver',
  email: 'approver@example.com',
  name: '承認 花子',
  role: 'approver' as const,
  managerId: null,
  employmentType: 'monthly' as const,
  hiredAt: new Date('2020-04-01'),
  baseSalary: 400000,
  deactivatedAt: null,
};

export const generalUser = {
  id: 'u_general',
  email: 'general@example.com',
  name: '一般 次郎',
  role: 'general' as const,
  managerId: 'u_approver',
  employmentType: 'monthly' as const,
  hiredAt: new Date('2023-10-01'),
  baseSalary: 300000,
  deactivatedAt: null,
};
