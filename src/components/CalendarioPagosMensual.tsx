/**
 * El calendario de cobro de un préstamo, dibujado como calendario de
 * verdad (cuadrícula de días por mes) en vez de una tabla de renglones —
 * mucho más fácil de leer de un vistazo: qué días ya se pagaron, cuál es
 * hoy, y cuáles quedaron atrasados.
 *
 * El sistema no guarda a qué día del calendario corresponde cada pago (ver
 * `obtenerFechasPagadas` en `lib/finance/calculos.ts`), así que quién llama
 * a este componente ya debe traer el conjunto de fechas que cuentan como
 * pagadas, calculado con esa función.
 */

const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

export function CalendarioPagosMensual({
  calendario,
  fechasPagadas,
  hoy,
}: {
  calendario: { fecha_programada: string; monto_esperado: number }[];
  fechasPagadas: Set<string>;
  hoy: string;
}) {
  if (calendario.length === 0) {
    return <p className="text-ink-muted text-sm">Este préstamo no tiene calendario de cobro.</p>;
  }

  const porFecha = new Map(calendario.map((d) => [d.fecha_programada, Number(d.monto_esperado)]));

  // Un mes por tarjeta, en el orden en que aparecen en el calendario (de
  // más viejo a más nuevo).
  const mesesClaves: string[] = [];
  for (const d of calendario) {
    const clave = d.fecha_programada.slice(0, 7); // "YYYY-MM"
    if (!mesesClaves.includes(clave)) mesesClaves.push(clave);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
        <Leyenda color="bg-green-500" texto="Pagado" />
        <Leyenda color="bg-amber-500" texto="Hoy" />
        <Leyenda color="bg-red-500" texto="Atrasado, sin pagar" />
        <Leyenda color="bg-surface-3" texto="Programado" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {mesesClaves.map((clave) => (
          <MesCalendario key={clave} clave={clave} porFecha={porFecha} fechasPagadas={fechasPagadas} hoy={hoy} />
        ))}
      </div>
    </div>
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {texto}
    </span>
  );
}

function MesCalendario({
  clave,
  porFecha,
  fechasPagadas,
  hoy,
}: {
  clave: string;
  porFecha: Map<string, number>;
  fechasPagadas: Set<string>;
  hoy: string;
}) {
  const [anioTexto, mesTexto] = clave.split("-");
  const anio = Number(anioTexto);
  const mesIndice = Number(mesTexto) - 1;

  const primerDiaSemana = new Date(Date.UTC(anio, mesIndice, 1)).getUTCDay();
  const diasEnMes = new Date(Date.UTC(anio, mesIndice + 1, 0)).getUTCDate();

  const celdas: (string | null)[] = [];
  for (let i = 0; i < primerDiaSemana; i++) celdas.push(null);
  for (let dia = 1; dia <= diasEnMes; dia++) {
    celdas.push(`${anioTexto}-${mesTexto}-${String(dia).padStart(2, "0")}`);
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-3">
      <p className="font-medium text-sm mb-2 capitalize">
        {MESES[mesIndice]} {anio}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-ink-muted mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((fecha, i) => {
          if (!fecha) return <span key={`vacio-${i}`} />;

          const numeroDia = Number(fecha.slice(8, 10));
          const esDiaDeCobro = porFecha.has(fecha);

          if (!esDiaDeCobro) {
            return (
              <span key={fecha} className="h-9 flex items-center justify-center text-xs text-ink-muted/50">
                {numeroDia}
              </span>
            );
          }

          const monto = porFecha.get(fecha) ?? 0;
          const pagado = fechasPagadas.has(fecha);
          const esHoy = fecha === hoy;
          const atrasado = !pagado && fecha < hoy;

          const estilo = pagado
            ? "bg-green-500/15 text-green-500 border-green-500/40"
            : esHoy
              ? "bg-amber-500/15 text-accent-text border-amber-500 ring-1 ring-amber-500"
              : atrasado
                ? "bg-danger-chip-bg text-danger-text border-danger-chip-border"
                : "bg-surface-2 text-ink-secondary border-border-strong";

          return (
            <span
              key={fecha}
              title={`${fecha} · ${currency(monto)}${pagado ? " · pagado" : atrasado ? " · atrasado" : ""}`}
              className={`h-9 flex items-center justify-center rounded-md border text-xs font-medium ${estilo}`}
            >
              {numeroDia}
            </span>
          );
        })}
      </div>
    </div>
  );
}
