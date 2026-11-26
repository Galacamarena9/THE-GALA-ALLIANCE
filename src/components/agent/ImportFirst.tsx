'use client';

import Link from 'next/link';
import { FileUp, Search } from 'lucide-react';
import { EmptyState, buttonClass } from '@/components/ui';
import { useT } from '@/lib/i18n/client';

/**
 * Cartera vacía (QA agente, hallazgo 6): el agente nuevo ya tiene sus atletas en un Excel, así que lo primero es
 * importarlo e invitarlos. «Buscar talento» queda como opción secundaria (solo muestra a mayores de edad).
 * `importHref`: en Hoy lleva a Mis atletas; en Mis atletas, al panel de importación de la misma página.
 */
export function ImportFirst({ pendingProposals = 0, importHref = '/app/portfolio#importar' }: { pendingProposals?: number; importHref?: string }) {
  const tx = useT();
  return (
    <EmptyState
      title={tx('Tu cartera está vacía')}
      action={
        <div className="flex flex-wrap justify-center gap-2" data-testid="import-first">
          <Link href={importHref} className={buttonClass('primary')} data-cta="import"><FileUp className="h-4 w-4" aria-hidden /> {tx('Importar mi cartera (Excel/CSV)')}</Link>
          <Link href="/app/discover" className={buttonClass('secondary')}><Search className="h-4 w-4" aria-hidden /> {tx('Buscar talento')}</Link>
        </div>
      }
    >
      {pendingProposals
        ? tx(pendingProposals === 1 ? 'Tienes 1 propuesta esperando respuesta. Mientras tanto, importa el resto de tu cartera: te damos un enlace por atleta para que se lo envíes.' : `Tienes ${pendingProposals} propuestas esperando respuesta. Mientras tanto, importa el resto de tu cartera: te damos un enlace por atleta para que se lo envíes.`)
        : tx('Empieza por los atletas que ya llevas: sube tu Excel (CSV) y te damos un enlace por atleta para que se lo envíes. Aparecen aquí cuando aceptan tu propuesta de representación; nada se comparte sin su permiso.')}
    </EmptyState>
  );
}
