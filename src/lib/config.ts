import { createClient } from "@/lib/supabase/server";
import type { ReglaDiasCobro, ReglaMora } from "@/lib/finance/calculos";

/**
 * Lee la tabla `configuraciones` y la convierte a valores tipados. Centraliza
 * en un solo lugar la conversión de texto -> número/JSON para que ningún
 * archivo tenga que repetir ese parseo (y para no hardcodear estos valores
 * en el código: si se ajustan desde la base de datos, la app los recoge
 * automáticamente).
 */
export async function obtenerConfiguraciones() {
  const supabase = await createClient();
  const { data } = await supabase.from("configuraciones").select("clave, valor");
  const mapa = new Map((data ?? []).map((c) => [c.clave, c.valor]));

  const numero = (clave: string, porDefecto: number) => {
    const valor = mapa.get(clave);
    const parsed = valor !== undefined ? Number(valor) : NaN;
    return Number.isFinite(parsed) ? parsed : porDefecto;
  };

  const arregloDeDias = (clave: string, porDefecto: number[]) => {
    const valor = mapa.get(clave);
    if (!valor) return porDefecto;
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? (parsed as number[]) : porDefecto;
    } catch {
      return porDefecto;
    }
  };

  const porcentajeInteresDefault = numero("porcentaje_interes_default", 20);
  const plazoDiasDefault = numero("plazo_dias_default", 24);
  const umbralMora = numero("umbral_mora", 5000);
  const moraBaja = numero("mora_baja", 50);
  const moraAlta = numero("mora_alta", 100);
  const diasCobroMenorUmbral = arregloDeDias("dias_cobro_menor_umbral", [1, 2, 3, 4, 5, 6]);
  const diasCobroMayorIgualUmbral = arregloDeDias("dias_cobro_mayor_igual_umbral", [1, 2, 3, 4, 5]);

  const reglaDiasCobro: ReglaDiasCobro = {
    umbral: umbralMora,
    diasMenorUmbral: diasCobroMenorUmbral,
    diasMayorIgualUmbral: diasCobroMayorIgualUmbral,
  };

  const reglaMora: ReglaMora = {
    umbral: umbralMora,
    moraBaja,
    moraAlta,
  };

  return {
    porcentajeInteresDefault,
    plazoDiasDefault,
    umbralMora,
    moraBaja,
    moraAlta,
    diasCobroMenorUmbral,
    diasCobroMayorIgualUmbral,
    reglaDiasCobro,
    reglaMora,
  };
}
