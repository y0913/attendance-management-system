'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

export interface DropdownItem {
  key: string;
  href: string;
  label: string;
  badge?: number;
}

interface Props {
  label: string;
  items: DropdownItem[];
  activeKey: string;
  /** 折りたたんだ summary に表示するバッジ（dropdown 内の合計件数など）。 */
  badge?: number;
}

// <details>/<summary> ベースの軽量 dropdown。
// - クリックで開閉、Esc / 外クリックで閉じる
// - サーバー側で children を生成しつつ summary 部分の挙動だけ client で
export function NavDropdown({ label, items, activeKey, badge }: Props) {
  const ref = useRef<HTMLDetailsElement>(null);
  const isActive = items.some((item) => item.key === activeKey);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = ref.current;
      if (el?.open && !el.contains(e.target as Node)) {
        el.removeAttribute('open');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current?.open) {
        ref.current.removeAttribute('open');
      }
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const close = () => ref.current?.removeAttribute('open');

  return (
    <details ref={ref} className="relative">
      <summary
        className={`flex cursor-pointer list-none select-none items-center gap-1 rounded-md px-3 py-1.5 ${
          isActive ? 'bg-muted font-medium' : 'hover:bg-muted'
        }`}
      >
        {label}
        {badge != null && badge > 0 && (
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
            {badge}
          </span>
        )}
        <span aria-hidden className="text-xs">
          ▾
        </span>
      </summary>
      <div className="absolute left-0 z-50 mt-1 min-w-[160px] rounded-md border bg-background py-1 shadow-md">
        {items.map((item) => {
          const itemActive = item.key === activeKey;
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={close}
              className={`flex items-center justify-between gap-2 px-3 py-1.5 text-sm ${
                itemActive ? 'bg-muted font-medium' : 'hover:bg-muted'
              }`}
            >
              <span>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </details>
  );
}
