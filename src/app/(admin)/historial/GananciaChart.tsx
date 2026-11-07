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
const GRIS = "#9ca3af";

const ALTO = 220;
const ANCHO = 760;
const MARGEN = { arriba: 20, abajo: 28, izquierda: 10, derecha: 14 };

/**
 * Ganancia (o pérdida) semanal estimada = cobrado − comisión de cobradores
 * − gastos de esa semana. Es una estimación de FLUJO DE CAJA, no una
 * utilidad contable exacta (no distingue todavía cuánto de lo cobrado es
 * capital que vuelve vs. interés ganado — esa separación sigue pendiente).
 * Pero para responder "¿el negocio va rentable o no?" de un vistazo, ver
 * semana a semana si entra más dinero del que sale ya dice bastante.
 *
 * Línea con flechas (a petición de Angel, antes eran barras): un punto por
 * semana (verde si esa semana entró más de lo que salió, rojo si salió
 * más), conectados por flechas que apuntan hacia arriba cuando una semana
 * mejoró respecto a la anterior y hacia abajo cuando empeoró — mismo
 * criterio que ya usa la columna "Tendencia" de la tabla de abajo. Pasar
 * el mouse (o tocar en celular) sobre cualquier parte de la gráfica
 * muestra el desglose de la semana más cercana.
 */
export function GananciaChart({ datos }: { datos: PuntoGanancia[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const idBase = useId();
  const svgRef = useRef<SVGSVGElement>(null);

  if (datos.length === 0) {
    return <p className="text-ink-muted text-sm">Todavía no hay suficientes semanas para graficar.</p>;
  }

  const maxAbs = Math.max(1, ...datos.map((d) => Math.abs(d.ganancia)));
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const yCero = MARGEN.arriba + altoUtil / 2;
  const altoMedio = altoUtil / 2;

  // Compresión en raíz cuadrada (no lineal, con signo): si una sola semana
  // tuvo una pérdida o ganancia muy grande frente a las demás, una escala
  // lineal aplana el resto de la línea contra el cero y ya no se distingue
  // nada entre semanas normales. Con raíz cuadrada el punto más extremo
  // sigue siendo el más alto/bajo, pero una semana con poco valor frente
  // al máximo ya no queda pegada a la línea de cero — el tooltip siempre
  // muestra el monto real exacto.
  function yDeValor(v: number) {
    if (v === 0) return yCero;
    const signo = v > 0 ? 1 : -1;
    return yCero - signo * Math.sqrt(Math.abs(v) / maxAbs) * altoMedio;
  }

  const paso = anchoUtil / datos.length;
  const puntos = datos.map((d, i) => ({
    x: MARGEN.izquierda + i * paso + paso / 2,
    y: yDeValor(d.ganancia),
  }));

  function indiceDesdeClientX(clientX: number): number | null {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const escalaX = ANCHO / rect.width;
    const xSvg = (clientX - rect.left) * escalaX;
    const i = Math.floor((xSvg - MARGEN.izquierda) / paso);
    return Math.min(datos.length - 1, Math.max(0, i));
  }

  // Si hay muchas semanas, no se puede poner una etiqueta por punto (se
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: VERDE }} />
          Esa semana entró más de lo que salió
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ROJO }} />
          Esa semana salió más de lo que entró
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="10" viewBox="0 0 14 10" className="shrink-0">
            <path d="M 1 8 L 13 2" stroke={VERDE} strokeWidth={2} fill="none" />
            <path d="M 7 1 L 13 2 L 10 7 z" fill={VERDE} />
          </svg>
          Mejoró vs. la semana anterior
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="10" viewBox="0 0 14 10" className="shrink-0">
            <path d="M 1 2 L 13 8" stroke={ROJO} strokeWidth={2} fill="none" />
            <path d="M 7 9 L 13 8 L 10 3 z" fill={ROJO} />
          </svg>
          Empeoró vs. la semana anterior
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
            {([
              [`${idBase}-flecha-verde`, VERDE],
              [`${idBase}-flecha-roja`, ROJO],
              [`${idBase}-flecha-gris`, GRIS],
            ] as const).map(([id, color]) => (
              <marker key={id} id={id} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
              </marker>
            ))}
          </defs>

          {/* Línea base (cero) */}
          <line x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={yCero} y2={yCero} stroke="var(--border-strong)" strokeWidth={1} />

          {/* Flechas entre semanas consecutivas: verde si mejoró, roja si empeoró, gris si quedó igual */}
          {puntos.slice(1).map((p, idx) => {
            const i = idx + 1;
            const anterior = puntos[i - 1];
            const diferencia = datos[i].ganancia - datos[i - 1].ganancia;
            const color = diferencia > 0 ? VERDE : diferencia < 0 ? ROJO : GRIS;
            const marcador = diferencia > 0 ? `${idBase}-flecha-verde` : diferencia < 0 ? `${idBase}-flecha-roja` : `${idBase}-flecha-gris`;
            const atenuada = activo !== null && activo !== i && activo !== i - 1;
            // La línea termina un poco antes del punto para dejarle espacio
            // a la cabeza de la flecha y que no se encime con el círculo.
            const dx = p.x - anterior.x;
            const dy = p.y - anterior.y;
            const largo = Math.hypot(dx, dy) || 1;
            const recorte = 7;
            const xFin = p.x - (dx / largo) * recorte;
            const yFin = p.y - (dy / largo) * recorte;
            return (
              <line
                key={datos[i].id}
                x1={anterior.x}
                y1={anterior.y}
                x2={xFin}
                y2={yFin}
                stroke={color}
                strokeWidth={2.5}
                opacity={atenuada ? 0.35 : 1}
                className="transition-opacity"
                markerEnd={`url(#${marcador})`}
              />
            );
          })}

          {/* Puntos: verde = semana con ganancia, rojo = semana con pérdida */}
          {puntos.map((p, i) => {
            const esGanancia = datos[i].ganancia >= 0;
            const color = esGanancia ? VERDE : ROJO;
            const estaActivo = activo === i;
            return (
              <g key={datos[i].id}>
                {estaActivo && (
                  <line x1={p.x} x2={p.x} y1={MARGEN.arriba} y2={ALTO - MARGEN.abajo} stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={estaActivo ? 6 : 4}
                  fill="var(--surface)"
                  stroke={color}
                  strokeWidth={2.5}
                  className="transition-all"
                />
                {/* Elemento invisible, solo para navegación con teclado (Tab) — el
                    mouse/touch ya lo detectan los handlers del <svg> de arriba. */}
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
                  aria-label={`${datos[i].etiqueta}: ${esGanancia ? "ganancia" : "pérdida"} de ${currency(Math.abs(datos[i].ganancia))}`}
                />
              </g>
            );
          })}
        </svg>

        {puntoActivo && activo !== null && (
          <div
            className="absolute top-0 bg-surface border border-border-strong rounded-lg px-3 py-2 text-xs shadow-lg pointer-events-none whitespace-nowrap"
            style={{
              left: `${Math.min(82, Math.max(18, (puntos[activo].x / ANCHO) * 100))}%`,
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
          // Cada etiqueta vive en la franja de SU punto (para quedar bien
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
