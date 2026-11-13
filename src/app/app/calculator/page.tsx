import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { PageHeader } from '@/components/ui';
import { NetCostCalculator } from '@/components/NetCostCalculator';

export const metadata: Metadata = { title: 'Calculadora de becas' };

export default async function CalculatorPage() {
  await requireSession();
  return (
    <>
      <PageHeader kicker="Calculadora de becas" title="¿Cuánto vais a pagar de verdad?" description="Introduce el coste y las ayudas de cada oferta. Verás tres escenarios, el total a 4 años y un comparador de hasta 5 opciones." />
      <NetCostCalculator />
    </>
  );
}
