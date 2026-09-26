import { MyCertificates } from '@/components/views/certificates-view';
import { pageState, pageTitle } from '@/lib/guard';
import { certificates } from '@/lib/queries';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'myCertificates');

export default async function MyCertificatesPage({ params }: Props) {
  const { actor } = await pageState(params);
  return <MyCertificates items={await certificates(actor, true)} />;
}
