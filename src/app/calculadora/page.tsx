import type { Metadata } from 'next';
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
      <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <p className="text-[13px] font-semibold text-brass">Calculadora · gratis, sin registro</p>
        <h1 className="mb-8 mt-3 text-5xl text-paper">¿Cuánto vais a pagar de verdad?</h1>
        <NetCostCalculator />
      </main>
      <PublicFooter />
    </>
  );
}
