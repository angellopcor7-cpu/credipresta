"use client";

import { useId, useRef, useState } from "react";

export type PuntoGanancia = {
  /** clave_lunes de esa semana, para la key. */
  id: string;
  /** Texto completo (con año) — se usa en el tooltip al pasar el mouse. */
  etiqueta: string;
  /** Texto corto (sin año) — se usa en las etiquetas del eje, donde no cabe el completo. */
  etiquetaCorta: string;
  ingreso: number;
  comision: number;
  gasto: number;
  ganancia: number;
};

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

const VERDE = "#22c55e";
const ROJO = "#f87171";

const ALTO = 220;
const ANCHO = 760;
const MARGEN = { arriba: 16, abajo: 28, izquierda: 8, derecha: 8 };

/**
 * Ganancia (o pérdida) semanal estimada = cobrado − comisión de cobradores
 * − gastos de esa semana. Es una estimación de FLUJO DE CAJA, no una
 * utilidad contable exacta (no distingue todavía cuánto de lo cobrado es
 * capital que vuelve vs. interés ganado — esa separación sigue pendiente).
 * Pero para responder "¿el negocio va rentable o no?" de un vistazo, ver
 * semana a semana si entra más dinero del que sale ya dice bastante.
 *
 * Barras divergentes alrededor de cero: verde = esa semana entró más de lo
 * que salió, rojo = salió más de lo que entró. Pasar el mouse (o tocar en
 * celular) sobre cualquier parte de la gráfica muestra el desglose de la
 * semana más cercana — no hace falta acertarle exacto a una barra angosta.
 */
export function GananciaChart({ datos }: { datos: PuntoGanancia[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const idGradiente = useId();
  const svgRef = useRef<SVGSVGElement>(null);

  if (datos.length === 0) {
    return <p className="text-ink-muted text-sm">Todavía no hay suficientes semanas para graficar.</p>;
  }

  const maxAbs = Math.max(1, ...datos.map((d) => Math.abs(d.ganancia)));
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const yCero = MARGEN.arriba + altoUtil / 2;

  // Compresión en raíz cuadrada (no lineal): si una sola semana tuvo una
  // pérdida o ganancia muy grande frente a las demás, una escala lineal
  // deja esa barra gigante y el resto casi invisibles (justo lo que
  // reportó Angel). Con raíz cuadrada la barra más grande sigue siendo la
  // más alta, pero una semana con el 1% del valor máximo ya no se ve como
  // el 1% de la altura — se ve como ~10%, perfectamente visible — sin
  // perder el orden ni el signo. El tooltip siempre muestra el monto real.
  const altoMedio = altoUtil / 2;
  function alturaBarra(valorAbs: number) {
    if (valorAbs <= 0) return 0;
    return Math.sqrt(valorAbs / maxAbs) * altoMedio;
  }

  const anchoBarra = Math.min(36, (anchoUtil / datos.length) * 0.56);
  const paso = anchoUtil / datos.length;

  function indiceDesdeClientX(clientX: number): number | null {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const escalaX = ANCHO / rect.width;
    const xSvg = (clientX - rect.left) * escalaX;
    const i = Math.floor((xSvg - MARGEN.izquierda) / paso);
    return Math.min(datos.length - 1, Math.max(0, i));
  }
  // Si hay muchas semanas, no se puede poner una etiqueta por barra (se
  // amontonan, sobre todo en celular) — se eligen como máximo 4,
  // repartidas parejo, siempre incluyendo la primera y la última semana.
  const MAX_ETIQUETAS = 4;
  const indicesConEtiqueta = new Set<number>();
  if (datos.length <= MAX_ETIQUETAS) {
    datos.forEach((_, i) => indicesConEtiqueta.add(i));
  } else {
    for (let k = 0; k < MAX_ETIQUETAS; k++) {
      indicesConEtiqueta.add(Math.round((k * (datos.length - 1)) / (MAX_ETIQUETAS - 1)));
    }
  }

  const puntoActivo = activo !== null ? datos[activo] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: VERDE }} />
          Esa semana entró más de lo que salió
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ROJO }} />
          Esa semana salió más de lo que entró
        </span>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="w-full h-auto touch-none"
          role="img"
          aria-label="Ganancia o pérdida estimada por semana"
          onPointerMove={(e) => {
            // En touch no hay "hover" real — ahí usamos onPointerDown (tap)
            // más abajo, para no dejar el tooltip pegado al dedo.
            if (e.pointerType === "touch") return;
            setActivo(indiceDesdeClientX(e.clientX));
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "touch") return;
            setActivo(null);
          }}
          onPointerDown={(e) => {
            if (e.pointerType !== "touch") return;
            const i = indiceDesdeClientX(e.clientX);
            setActivo((prev) => (prev === i ? null : i));
          }}
        >
          <defs>
            <clipPath id={`${idGradiente}-clip`}>
              <rect x={0} y={0} width={ANCHO} height={ALTO} />
            </clipPath>
          </defs>
          {/* Línea base (cero) */}
          <line x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={yCero} y2={yCero} stroke="var(--border-strong)" strokeWidth={1} />

          {datos.map((d, i) => {
            const x = MARGEN.izquierda + i * paso + (paso - anchoBarra) / 2;
            const alto = Math.max(d.ganancia === 0 ? 0 : 3, alturaBarra(Math.abs(d.ganancia)));
            const esGanancia = d.ganancia >= 0;
            const y = esGanancia ? yCero - alto : yCero;
            const color = esGanancia ? VERDE : ROJO;
            const estaActivo = activo === i;

            return (
              <g key={d.id}>
                <rect
                  x={x}
                  y={y}
                  width={anchoBarra}
                  height={alto}
                  rx={4}
                  fill={color}
                  opacity={estaActivo || activo === null ? 1 : 0.45}
                  className="transition-opacity"
                />
                {estaActivo && (
                  <rect x={x - 2} y={MARGEN.arriba} width={anchoBarra + 4} height={altoUtil} fill={color} opacity={0.06} />
                )}
                {/* Elemento invisible, solo para navegación con teclado (Tab) — el
                    mouse/touch ya los detecta con los handlers del <svg> de arriba. */}
                <rect
                  x={MARGEN.izquierda + i * paso}
                  y={MARGEN.arriba}
                  width={paso}
                  height={altoUtil}
                  fill="transparent"
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.etiqueta}: ${d.ganancia >= 0 ? "ganancia" : "pérdida"} de ${currency(Math.abs(d.ganancia))}`}
                />
              </g>
            );
          })}
        </svg>

        {puntoActivo && activo !== null && (
          <div
            className="absolute top-0 bg-surface border border-border-strong rounded-lg px-3 py-2 text-xs shadow-lg pointer-events-none whitespace-nowrap"
            style={{
              left: `${Math.min(82, Math.max(18, ((MARGEN.izquierda + activo * paso + paso / 2) / ANCHO) * 100))}%`,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-semibold text-ink-strong mb-1">{puntoActivo.etiqueta}</p>
            <p className="text-ink-secondary">Cobrado: {currency(puntoActivo.ingreso)}</p>
            <p className="text-ink-secondary">Comisión: {currency(puntoActivo.comision)}</p>
            <p className="text-ink-secondary">Gastos: {currency(puntoActivo.gasto)}</p>
            <p className={`font-semibold mt-1 ${puntoActivo.ganancia >= 0 ? "text-green-500" : "text-danger-text"}`}>
              {puntoActivo.ganancia >= 0 ? "Ganancia" : "Pérdida"}: {currency(Math.abs(puntoActivo.ganancia))}
            </p>
          </div>
        )}
      </div>

      <div
        className="flex text-[10px] text-ink-muted"
        style={{ paddingLeft: `${(MARGEN.izquierda / ANCHO) * 100}%`, paddingRight: `${(MARGEN.derecha / ANCHO) * 100}%` }}
      >
        {datos.map((d, i) => {
          if (!indicesConEtiqueta.has(i)) {
            return <div key={d.id} style={{ width: `${(paso / ANCHO) * 100}%` }} />;
          }
          // Cada etiqueta vive en la franja de SU barra (para quedar bien
          // alineada), pero puede desbordarse hacia las franjas vacías de al
          // lado sin cortarse — si no, en celular quedaban truncadas a una
          // sola letra. La primera se alinea a la izquierda y la última a la
          // derecha para no salirse de la gráfica.
          const alineacion = i === 0 ? "text-left" : i === datos.length - 1 ? "text-right" : "text-center";
          return (
            <div
              key={d.id}
              className={`whitespace-nowrap overflow-visible ${alineacion}`}
              style={{ width: `${(paso / ANCHO) * 100}%` }}
            >
              {d.etiquetaCorta}
            </div>
          );
        })}
      </div>
    </div>
  );
}
