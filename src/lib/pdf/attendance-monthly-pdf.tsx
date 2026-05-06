import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import { formatInTimeZone } from 'date-fns-tz';
import { JST_TIMEZONE } from '@/lib/calc/constants';
import type { EffectiveMonthlySummary } from '@/lib/mock/attendance-closings';
import type { MockCompany } from '@/lib/mock/companies';
import type { MockUser } from '@/lib/mock/users';
import { ensureJapaneseFontRegistered } from './fonts';

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'] as const;

const fmtMinutes = (n: number | null): string => {
  if (n == null) return '-';
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

const weekdayOf = (jstDate: string): number => {
  const d = new Date(`${jstDate}T00:00:00+09:00`);
  return Number(formatInTimeZone(d, JST_TIMEZONE, 'i')) % 7;
};

const fmtDateTime = (d: Date) =>
  formatInTimeZone(d, JST_TIMEZONE, 'yyyy-MM-dd HH:mm');

const fmtMonth = (ym: string): string => {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
};

interface Props {
  company: MockCompany;
  user: MockUser;
  yearMonth: string;
  summary: EffectiveMonthlySummary;
  generatedAt: Date;
}

export function AttendanceMonthlyPdf({
  company,
  user,
  yearMonth,
  summary,
  generatedAt,
}: Props) {
  const fontFamily = ensureJapaneseFontRegistered();

  const styles = StyleSheet.create({
    page: {
      fontFamily,
      fontSize: 9,
      padding: 32,
      color: '#222',
    },
    header: {
      borderBottomWidth: 1,
      borderBottomColor: '#888',
      paddingBottom: 8,
      marginBottom: 12,
    },
    company: { fontSize: 10, color: '#666' },
    title: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
    metaRow: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 4,
      fontSize: 9,
    },
    summaryBlock: {
      flexDirection: 'row',
      gap: 12,
      marginVertical: 12,
    },
    summaryCell: {
      flexGrow: 1,
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 3,
      padding: 6,
    },
    summaryLabel: { fontSize: 8, color: '#666' },
    summaryValue: { fontSize: 12, fontWeight: 'bold', marginTop: 2 },
    closedBanner: {
      marginVertical: 6,
      padding: 6,
      backgroundColor: '#eef2ff',
      borderRadius: 3,
      fontSize: 9,
      color: '#3730a3',
    },
    table: { marginTop: 4, borderWidth: 1, borderColor: '#ddd' },
    headRow: {
      flexDirection: 'row',
      backgroundColor: '#f4f4f5',
      borderBottomWidth: 1,
      borderBottomColor: '#ddd',
    },
    row: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
    },
    rowEmpty: { color: '#888' },
    cell: { padding: 4, fontSize: 8 },
    colDate: { width: '14%' },
    colDow: { width: '6%', textAlign: 'center' },
    colClock: { width: '12%', textAlign: 'center' },
    colBreak: { width: '10%', textAlign: 'right' },
    colWork: { width: '14%', textAlign: 'right' },
    colNote: { width: '32%' },
    weekend: { color: '#0369a1' },
    sunday: { color: '#be123c' },
    footRow: {
      flexDirection: 'row',
      backgroundColor: '#f4f4f5',
      borderTopWidth: 1,
      borderTopColor: '#888',
    },
    footer: {
      marginTop: 16,
      fontSize: 8,
      color: '#888',
      textAlign: 'right',
    },
  });

  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="portrait">
        <View style={styles.header}>
          <Text style={styles.company}>{company.name}</Text>
          <Text style={styles.title}>
            月次勤怠表 ・ {fmtMonth(yearMonth)}
          </Text>
          <View style={styles.metaRow}>
            <Text>対象者：{user.name}</Text>
            <Text>メール：{user.email}</Text>
          </View>
        </View>

        {summary.isClosed && summary.closedAt && (
          <View style={styles.closedBanner}>
            <Text>
              この月は {fmtDateTime(summary.closedAt)} に締め済み（snapshot
              凍結）。表示値は snapshot に基づきます。
            </Text>
          </View>
        )}

        <View style={styles.summaryBlock}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>勤務日数</Text>
            <Text style={styles.summaryValue}>{summary.workedDays} 日</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>合計勤務時間</Text>
            <Text style={styles.summaryValue}>
              {fmtMinutes(summary.totalWorkMinutes)}
            </Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>合計休憩</Text>
            <Text style={styles.summaryValue}>
              {fmtMinutes(summary.totalBreakMinutes)}
            </Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>承認済有給</Text>
            <Text style={styles.summaryValue}>
              {summary.approvedLeaveDays} 日
            </Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>退勤未打刻</Text>
            <Text style={styles.summaryValue}>
              {summary.missingClockOutDays} 日
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.headRow}>
            <Text style={[styles.cell, styles.colDate]}>日付</Text>
            <Text style={[styles.cell, styles.colDow]}>曜日</Text>
            <Text style={[styles.cell, styles.colClock]}>出勤</Text>
            <Text style={[styles.cell, styles.colClock]}>退勤</Text>
            <Text style={[styles.cell, styles.colBreak]}>休憩</Text>
            <Text style={[styles.cell, styles.colWork]}>勤務時間</Text>
            <Text style={[styles.cell, styles.colNote]}>業務内容</Text>
          </View>
          {summary.daily.map((d) => {
            const wd = weekdayOf(d.date);
            const empty = !d.clockIn && !d.clockOut;
            const dowStyle =
              wd === 0 ? styles.sunday : wd === 6 ? styles.weekend : null;
            return (
              <View
                key={d.date}
                style={empty ? [styles.row, styles.rowEmpty] : styles.row}
              >
                <Text style={[styles.cell, styles.colDate]}>{d.date}</Text>
                <Text
                  style={[
                    styles.cell,
                    styles.colDow,
                    ...(dowStyle ? [dowStyle] : []),
                  ]}
                >
                  {WEEKDAY[wd]}
                </Text>
                <Text style={[styles.cell, styles.colClock]}>
                  {d.clockIn ?? '-'}
                </Text>
                <Text style={[styles.cell, styles.colClock]}>
                  {d.clockOut ?? '-'}
                </Text>
                <Text style={[styles.cell, styles.colBreak]}>
                  {d.breakMinutes > 0 ? fmtMinutes(d.breakMinutes) : '-'}
                </Text>
                <Text style={[styles.cell, styles.colWork]}>
                  {fmtMinutes(d.workMinutes)}
                </Text>
                <Text style={[styles.cell, styles.colNote]} />
              </View>
            );
          })}
          <View style={styles.footRow}>
            <Text style={[styles.cell, styles.colDate]}>合計</Text>
            <Text style={[styles.cell, styles.colDow]} />
            <Text style={[styles.cell, styles.colClock]} />
            <Text style={[styles.cell, styles.colClock]} />
            <Text style={[styles.cell, styles.colBreak]}>
              {fmtMinutes(summary.totalBreakMinutes)}
            </Text>
            <Text style={[styles.cell, styles.colWork]}>
              {fmtMinutes(summary.totalWorkMinutes)}
            </Text>
            <Text style={[styles.cell, styles.colNote]} />
          </View>
        </View>

        <Text style={styles.footer}>
          作成日時: {fmtDateTime(generatedAt)}
        </Text>
      </Page>
    </Document>
  );
}
