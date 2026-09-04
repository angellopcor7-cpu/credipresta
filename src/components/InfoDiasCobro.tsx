const NOMBRES_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Describe un arreglo de días de la semana (0=domingo..6=sábado) como texto legible. */
function describirDias(dias: number[]): string {
  const ordenado = [...dias].sort((a, b) => a - b);
  const esRangoSeguido = ordenado.every((d, i) => i === 0 || d === ordenado[i - 1] + 1);
  if (esRangoSeguido && ordenado.length > 1) {
    return `de ${NOMBRES_DIA[ordenado[0]]} a ${NOMBRES_DIA[ordenado[ordenado.length - 1]]}`;
  }
  return ordenado.map((d) => NOMBRES_DIA[d]).join(", ");
}

function diasSinCobro(dias: number[]): string {
  const faltantes = [0, 1, 2, 3, 4, 5, 6].filter((d) => !dias.includes(d));
  if (faltantes.length === 0) return "ninguno";
  return faltantes.map((d) => NOMBRES_DIA[d]).join(" y ");
}

/**
 * Explica, con las mismas reglas configuradas en `configuraciones`, por qué
 * el calendario de cobro salta ciertos días — para que tanto el admin como
 * el cliente entiendan por qué el plazo en días no siempre coincide con la
 * cantidad de días de calendario hasta la fecha límite.
 */
export function InfoDiasCobro({
  umbral,
  diasMenorUmbral,
  diasMayorIgualUmbral,
}: {
  umbral: number;
  diasMenorUmbral: number[];
  diasMayorIgualUmbral: number[];
}) {
  const formatoMoneda = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });

  return (
    <details className="text-sm bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 max-w-2xl">
      <summary className="cursor-pointer text-slate-300 font-medium">
        ¿Por qué algunos días no se cobra?
      </summary>
      <div className="mt-3 space-y-2 text-slate-400">
        <p>
          El calendario de cobro de cada préstamo salta los días que no le tocan según su monto — por eso el
          plazo en días (ej. 20 días de cobro) casi siempre termina abarcando más días de calendario.
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Préstamos menores a {formatoMoneda.format(umbral)}: se cobra {capitalizar(describirDias(diasMenorUmbral))}{" "}
            (no se cobra {diasSinCobro(diasMenorUmbral)}).
          </li>
          <li>
            Préstamos de {formatoMoneda.format(umbral)} en adelante: se cobra{" "}
            {capitalizar(describirDias(diasMayorIgualUmbral))} (no se cobra {diasSinCobro(diasMayorIgualUmbral)}).
          </li>
        </ul>
        <p>La fecha límite que se muestra ya toma en cuenta estos días saltados — es la fecha real del último cobro.</p>
      </div>
    </details>
  );
}
