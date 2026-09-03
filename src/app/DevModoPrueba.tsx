import { entrarComoAdminDePrueba, entrarComoCobradorDePrueba } from "./dev-modo-prueba-actions";

/**
 * SOLO PARA PRUEBAS — borrar junto con `dev-modo-prueba-actions.ts` cuando
 * la app esté terminada. Deja saltar entre la vista de administrador y la
 * de cobrador con un clic, usando 2 cuentas de prueba dedicadas (no tocan
 * ninguna cuenta real).
 */
export function DevModoPrueba() {
  return (
    <div className="fixed top-2 right-2 z-50 flex gap-2 bg-slate-950/90 border border-dashed border-amber-500 rounded-lg p-2 text-xs">
      <span className="text-amber-400 self-center pl-1 hidden sm:inline">MODO PRUEBA</span>
      <form action={entrarComoAdminDePrueba}>
        <button className="bg-slate-800 hover:bg-slate-700 text-white rounded-md px-3 py-1.5">
          Ver como Admin
        </button>
      </form>
      <form action={entrarComoCobradorDePrueba}>
        <button className="bg-slate-800 hover:bg-slate-700 text-white rounded-md px-3 py-1.5">
          Ver como Cobrador
        </button>
      </form>
    </div>
  );
}
