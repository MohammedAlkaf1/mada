'use client';

import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Card, EmptyState, PageHeader, Table, Td, Th, Tr } from '@/components/ui';
import { formatDateTime, formatNumber } from '@/lib/format';
import type { AuditRow } from '@/lib/types';

const AR: Record<string, string> = {
  'course.create': 'إنشاء دورة', 'course.update': 'تعديل دورة', 'course.archive': 'أرشفة دورة', 'course.restore': 'استعادة دورة',
  'version.update': 'تعديل نسخة', 'version.publish': 'نشر نسخة', 'version.next': 'إنشاء نسخة جديدة', 'version.discard': 'حذف مسودة',
  'module.save': 'حفظ وحدة', 'module.delete': 'حذف وحدة', 'lesson.save': 'حفظ درس', 'lesson.delete': 'حذف درس', 'outline.reorder': 'إعادة ترتيب الدروس',
  'question.save': 'حفظ سؤال', 'question.delete': 'حذف سؤال', 'question.reorder': 'إعادة ترتيب الأسئلة',
  'enrollment.assign': 'إسناد دورة', 'enrollment.withdraw': 'سحب دورة', 'enrollment.due': 'تعديل موعد',
  'member.invite': 'إضافة مستخدم', 'member.update': 'تعديل صلاحيات', 'member.resend': 'إعادة إرسال دعوة', 'invitation.accept': 'قبول دعوة',
  'group.save': 'حفظ مجموعة', 'group.archive': 'أرشفة مجموعة', 'group.members': 'تعديل أعضاء مجموعة', 'import.apply': 'استيراد مستخدمين',
  'certificate.issue': 'إصدار شهادة', 'certificate.revoke': 'إلغاء شهادة', 'certificate.download': 'تنزيل شهادة',
  'quiz.start': 'بدء اختبار', 'quiz.submit': 'تسليم اختبار', 'asset.upload': 'رفع ملف', 'tenant.update': 'تعديل هوية الجهة', 'tenant.logo': 'تحديث الشعار', 'tenant.logoRemove': 'إزالة الشعار', 'tenant.signup': 'إنشاء الجهة',
  'export.request': 'طلب تصدير', 'export.download': 'تنزيل تصدير', 'support.grant': 'منح وصول دعم', 'support.revoke': 'إلغاء وصول دعم',
  'billing.changePlan': 'تغيير الباقة', 'billing.cancel': 'إيقاف التجديد', 'billing.checkout': 'بدء سداد', 'invoice.paid': 'سداد فاتورة', 'profile.update': 'تعديل البيانات الشخصية', 'outbox.retry': 'إعادة إرسال بريد',
};

/** Read only by design (FR-18): no row can be edited or removed from here. Details never carry passwords, tokens or answers. */
export function AuditView({ rows, total, page, size }: { rows: AuditRow[]; total: number; page: number; size: number }) {
  const { t, locale } = useApp();
  const pages = Math.max(1, Math.ceil(total / size));
  const label = (action: string) => (locale === 'ar' ? AR[action] ?? action : action);
  return (
    <>
      <PageHeader title={t.audit.title} subtitle={t.audit.subtitle} />
      <Card padded={false}>
        {rows.length === 0 ? <EmptyState title={t.audit.empty} icon={<ScrollText size={19} />} /> : (
          <Table>
            <thead><tr><Th>{t.audit.when}</Th><Th>{t.audit.actor}</Th><Th>{t.audit.action}</Th><Th>{t.audit.detail}</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="whitespace-nowrap text-[12.5px] tabular-nums">{formatDateTime(r.createdAt, locale)}</Td>
                  <Td className="text-[13px]">{r.actorName || '…'}</Td>
                  <Td><span className="font-medium">{label(r.action)}</span>{locale === 'ar' ? <span className="block text-[11px] text-[var(--text-faint)]" dir="ltr">{r.action}</span> : null}</Td>
                  <Td className="max-w-md"><code className="block truncate text-[11.5px] text-[var(--text-muted)]" dir="ltr" title={JSON.stringify(r.detail)}>{Object.keys(r.detail).length ? JSON.stringify(r.detail) : ''}</code></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--line-soft)] px-4 py-3 text-[12.5px] text-[var(--text-muted)]">
            <span className="tabular-nums">{t.common.page} {formatNumber(page + 1, locale)} {t.common.of} {formatNumber(pages, locale)}</span>
            <span className="flex gap-3">
              {page > 0 ? <Link href={`?page=${page - 1}`} className="font-medium text-copper-700 hover:underline">{t.common.previous}</Link> : null}
              {page < pages - 1 ? <Link href={`?page=${page + 1}`} className="font-medium text-copper-700 hover:underline">{t.common.next}</Link> : null}
            </span>
          </div>
        ) : null}
      </Card>
    </>
  );
}
