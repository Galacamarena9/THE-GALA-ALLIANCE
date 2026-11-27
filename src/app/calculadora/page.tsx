import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { NetCostCalculator } from '@/components/NetCostCalculator';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';

export const metadata: Metadata = {
  title: 'Calculadora de becas deportivas',
  description: 'Calcula el coste neto real de estudiar y competir en EE. UU. y compara hasta 5 ofertas.',
};

export default function PublicCalculator() {
  return (
    <>
      <PublicHeader />
      <main id="main-content" className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <PageHeader kicker="Calculadora · gratis, sin registro" title={<>¿Cuánto vais a pagar <em>de verdad?</em></>} photo="/media/founder-entrance-sm.webp" />
        <NetCostCalculator />
      </main>
      <PublicFooter />
    </>
  );
}
