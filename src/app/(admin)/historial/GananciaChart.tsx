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
const MARGEN = { arriba: 16, abajo: 28, izquierda: 10, derecha: 10 };

/**
 * Ganancia (o pérdida) semanal estimada = cobrado − comisión de cobradores
 * − gastos de esa semana. Es una estimación de FLUJO DE CAJA, no una
 * utilidad contable exacta (no distingue todavía cuánto de lo cobrado es
 * capital que vuelve vs. interés ganado — esa separación sigue pendiente).
 * Pero para responder "¿el negocio va rentable o no?" de un vistazo, ver
 * semana a semana si entra más dinero del que sale ya dice bastante.
 *
 * Gráfica de línea simple (a petición de Angel, sin flechas ni compresión
 * rara de la escala): una sola línea que sube y baja con la ganancia real
 * de cada semana, en escala normal — verde en la parte de arriba de cero,
 * roja en la de abajo (el tramo de la línea cambia de color justo donde
 * cruza el cero). Cada punto también es verde o rojo según si esa semana
 * en concreto ganó o perdió. Pasar el mouse (o tocar en celular) sobre
 * cualquier parte de la gráfica muestra el desglose de la semana más
 * cercana.
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
  const escalaY = altoUtil / 2 / maxAbs;

  const paso = datos.length > 1 ? anchoUtil / (datos.length - 1) : 0;
  const puntos = datos.map((d, i) => ({
    x: datos.length > 1 ? MARGEN.izquierda + i * paso : MARGEN.izquierda + anchoUtil / 2,
    y: yCero - d.ganancia * escalaY,
  }));

  const lineaPath = puntos.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Franja de cada semana para detectar el hover/tap: centrada en SU punto
  // (de -paso/2 a +paso/2), recortada a los bordes de la gráfica — así la
  // zona detectada queda alineada con lo que se ve, no corrida aparte.
  function franjaDePunto(i: number) {
    const centro = puntos[i].x;
    const mitad = datos.length > 1 ? paso / 2 : anchoUtil / 2;
    const inicio = Math.max(MARGEN.izquierda, centro - mitad);
    const fin = Math.min(MARGEN.izquierda + anchoUtil, centro + mitad);
    return { inicio, ancho: fin - inicio };
  }

  function indiceDesdeClientX(clientX: number): number | null {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    if (datos.length === 1) return 0;
    const escalaX = ANCHO / rect.width;
    const xSvg = (clientX - rect.left) * escalaX;
    const i = Math.round((xSvg - MARGEN.izquierda) / paso);
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
  // Dónde cae el cero dentro del área de la gráfica (0 = arriba, 1 = abajo)
  // — el degradado de la línea cambia de verde a rojo justo en ese punto,
  // para que el tramo que está arriba de cero se vea verde y el de abajo rojo.
  const fraccionCero = (yCero - MARGEN.arriba) / altoUtil;

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
            <linearGradient id={`${idBase}-linea`} x1={0} y1={MARGEN.arriba} x2={0} y2={ALTO - MARGEN.abajo} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={VERDE} />
              <stop offset={fraccionCero} stopColor={VERDE} />
              <stop offset={fraccionCero} stopColor={ROJO} />
              <stop offset="1" stopColor={ROJO} />
            </linearGradient>
          </defs>

          {/* Línea base (cero) */}
          <line x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={yCero} y2={yCero} stroke="var(--border-strong)" strokeWidth={1} />

          <path d={lineaPath} fill="none" stroke={`url(#${idBase}-linea)`} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

          {puntos.map((p, i) => {
            const esGanancia = datos[i].ganancia >= 0;
            const color = esGanancia ? VERDE : ROJO;
            const estaActivo = activo === i;
            return (
              <g key={datos[i].id}>
                {estaActivo && (
                  <line x1={p.x} x2={p.x} y1={MARGEN.arriba} y2={ALTO - MARGEN.abajo} stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
                )}
                <circle cx={p.x} cy={p.y} r={estaActivo ? 5.5 : 3.5} fill={color} stroke="var(--surface)" strokeWidth={1.5} className="transition-all" />
                {/* Elemento invisible, solo para navegación con teclado (Tab) — el
                    mouse/touch ya lo detectan los handlers del <svg> de arriba. */}
                <rect
                  x={franjaDePunto(i).inicio}
                  y={MARGEN.arriba}
                  width={franjaDePunto(i).ancho}
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
          const ancho = datos.length > 0 ? (1 / datos.length) * 100 : 0;
          if (!indicesConEtiqueta.has(i)) {
            return <div key={d.id} style={{ width: `${ancho}%` }} />;
          }
          // Cada etiqueta vive en una franja pareja (para quedar bien
          // repartida), pero puede desbordarse hacia las franjas vacías de al
          // lado sin cortarse — si no, en celular quedaban truncadas a una
          // sola letra. La primera se alinea a la izquierda y la última a la
          // derecha para no salirse de la gráfica.
          const alineacion = i === 0 ? "text-left" : i === datos.length - 1 ? "text-right" : "text-center";
          return (
            <div key={d.id} className={`whitespace-nowrap overflow-visible ${alineacion}`} style={{ width: `${ancho}%` }}>
              {d.etiquetaCorta}
            </div>
          );
        })}
      </div>
    </div>
  );
}
