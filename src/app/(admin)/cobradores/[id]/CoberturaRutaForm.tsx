"use client";

import { useState } from "react";
import { Plus, X, ShieldCheck, HandHelping, ArrowRight } from "lucide-react";
import { iniciarCobertura, terminarCobertura } from "../actions";

type CobradorOpcion = { id: string; nombre: string };
type CoberturaActiva = { id: string; cobradorId: string; nombre: string };

/**
 * Cobertura de ruta: comparte temporalmente los clientes de un cobrador con
 * otro, sin quitárselos — para cuando alguien va a cubrir mientras el
 * cobrador titular no está. Se ve y se controla desde la ficha de
 * cualquiera de los dos cobradores involucrados. Son DOS cosas distintas y
 * fácil de confundir, por eso van en tarjetas separadas con color y flecha
 * de dirección: "alguien cubre A ESTE cobrador" (recibe ayuda) vs. "ESTE
 * cobrador cubre a alguien más" (da ayuda).
 */
export function CoberturaRutaForm({
  cobradorId,
  nombreCobrador,
  cubriendoAEste,
  esteCubreA,
  otrosCobradores,
}: {
  cobradorId: string;
  nombreCobrador: string;
  /** Quién(es) está cubriendo la ruta de este cobrador ahorita. */
  cubriendoAEste: CoberturaActiva[];
  /** La(s) ruta(s) de quién está cubriendo este cobrador ahorita. */
  esteCubreA: CoberturaActiva[];
  otrosCobradores: CobradorOpcion[];
}) {
  const volverA = `/cobradores/${cobradorId}`;
  const primerNombre = nombreCobrador.trim().split(/\s+/)[0] ?? nombreCobrador;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2.5 rounded-lg border border-accent-chip-border bg-accent-chip-bg/40 p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-chip-bg text-accent-text">
            <ShieldCheck className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-xs font-semibold text-ink-strong">Lo están ayudando a él</h3>
        </div>
        <p className="text-ink-muted text-[11px] leading-snug">
          Estos cobradores ven y cobran a los clientes de <strong>{primerNombre}</strong>, además de los suyos.
          Nadie más los ve.
        </p>
        {cubriendoAEste.length === 0 ? (
          <p className="text-ink-muted text-xs italic">Por ahorita, nadie lo está ayudando.</p>
        ) : (
          <ul className="space-y-1.5">
            {cubriendoAEste.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 bg-surface border border-border rounded-md px-3 py-1.5 text-sm"
              >
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <span className="font-medium truncate">{c.nombre}</span>
                  <ArrowRight className="h-3 w-3 text-ink-muted shrink-0" />
                  <span className="text-ink-muted text-xs truncate">clientes de {primerNombre}</span>
                </span>
                <TerminarBoton coberturaId={c.id} volverA={volverA} nombre={c.nombre} />
              </li>
            ))}
          </ul>
        )}
        <EmpezarCoberturaForm
          label="Agregar quién lo ayude"
          nombreCampoCubre="cobrador_cubre_id"
          valorFijoCampo="cobrador_cubierto_id"
          valorFijo={cobradorId}
          otrosCobradores={otrosCobradores}
          volverA={volverA}
        />
      </div>

      <div className="space-y-2.5 rounded-lg border border-border-strong bg-surface-2/60 p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-strong">
            <HandHelping className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-xs font-semibold text-ink-strong">Él está ayudando a otros</h3>
        </div>
        <p className="text-ink-muted text-[11px] leading-snug">
          <strong>{primerNombre}</strong> ve y cobra los clientes de estos cobradores, además de los suyos.
        </p>
        {esteCubreA.length === 0 ? (
          <p className="text-ink-muted text-xs italic">Por ahorita, no está ayudando a nadie más.</p>
        ) : (
          <ul className="space-y-1.5">
            {esteCubreA.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 bg-surface border border-border rounded-md px-3 py-1.5 text-sm"
              >
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <span className="font-medium truncate">{primerNombre}</span>
                  <ArrowRight className="h-3 w-3 text-ink-muted shrink-0" />
                  <span className="text-ink-muted text-xs truncate">clientes de {c.nombre}</span>
                </span>
                <TerminarBoton coberturaId={c.id} volverA={volverA} nombre={c.nombre} />
              </li>
            ))}
          </ul>
        )}
        <EmpezarCoberturaForm
          label={`Hacer que ${primerNombre} ayude a otro`}
          nombreCampoCubre="cobrador_cubierto_id"
          valorFijoCampo="cobrador_cubre_id"
          valorFijo={cobradorId}
          otrosCobradores={otrosCobradores}
          volverA={volverA}
        />
      </div>
    </div>
  );
}

function TerminarBoton({ coberturaId, volverA, nombre }: { coberturaId: string; volverA: string; nombre: string }) {
  return (
    <form
      action={terminarCobertura}
      onSubmit={(e) => {
        if (!confirm(`¿Terminar la cobertura con ${nombre}?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="cobertura_id" value={coberturaId} />
      <input type="hidden" name="volver_a" value={volverA} />
      <button type="submit" className="text-xs text-danger-text hover:underline shrink-0">
        Terminar
      </button>
    </form>
  );
}

function EmpezarCoberturaForm({
  label,
  nombreCampoCubre,
  valorFijoCampo,
  valorFijo,
  otrosCobradores,
  volverA,
}: {
  label: string;
  nombreCampoCubre: "cobrador_cubre_id" | "cobrador_cubierto_id";
  valorFijoCampo: "cobrador_cubre_id" | "cobrador_cubierto_id";
  valorFijo: string;
  otrosCobradores: CobradorOpcion[];
  volverA: string;
}) {
  const [abierto, setAbierto] = useState(false);

  if (otrosCobradores.length === 0) return null;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1 text-xs text-accent-text hover:underline"
      >
        <Plus className="h-3 w-3" />
        {label}
      </button>
    );
  }

  return (
    <form action={iniciarCobertura} className="animate-panel-in flex flex-wrap items-center gap-2">
      <input type="hidden" name={valorFijoCampo} value={valorFijo} />
      <input type="hidden" name="volver_a" value={volverA} />
      <select
        name={nombreCampoCubre}
        required
        defaultValue=""
        className="rounded-md bg-surface-2 border border-border-strong px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        <option value="" disabled>
          Elige un cobrador…
        </option>
        {otrosCobradores.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre}
          </option>
        ))}
      </select>
      <button type="submit" className="text-xs bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-md px-3 py-1.5">
        Empezar
      </button>
      <button type="button" onClick={() => setAbierto(false)} className="text-ink-muted hover:text-ink">
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}
