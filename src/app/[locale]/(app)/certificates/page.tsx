import { CertificatesView } from '@/components/views/certificates-view';
import { AccessDenied } from '@/components/shell/access-denied';
import { pageState, pageTitle } from '@/lib/guard';
import { certificates } from '@/lib/queries';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'certificates');

export default async function CertificatesPage({ params }: Props) {
  const { locale, actor, permitted } = await pageState(params, ['Admin', 'Instructor']);
  if (!permitted) return <AccessDenied locale={locale} role={actor.role} />;
  return <CertificatesView items={await certificates(actor, false)} role={actor.role} />;
}
