"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirAdministrador } from "@/lib/auth/roles";
import type { TipoComision } from "@/lib/types";

/** Lee y valida el tipo/porcentaje de comisión de un FormData; redirige si vienen mal. */
function leerComision(formData: FormData, redirectPath: string) {
  const tipoComisionTexto = String(formData.get("tipo_comision") || "recolectado");
  const porcentajeComision = Number(formData.get("porcentaje_comision") || 0);

  if (tipoComisionTexto !== "prestado" && tipoComisionTexto !== "recolectado") {
    redirect(`${redirectPath}?error=${encodeURIComponent("Tipo de comisión inválido")}`);
  }
  if (!Number.isFinite(porcentajeComision) || porcentajeComision < 0 || porcentajeComision > 100) {
    redirect(`${redirectPath}?error=${encodeURIComponent("El porcentaje de comisión debe estar entre 0 y 100")}`);
  }

  return { tipoComision: tipoComisionTexto as TipoComision, porcentajeComision };
}

/**
 * Crea la cuenta de un cobrador nuevo: usuario en Supabase Auth (con la
 * llave service_role, porque un admin creando la cuenta de otra persona no
 * es un "signUp" normal), su fila en `usuarios` con rol=cobrador, y su fila
 * en `cobradores`. Si algo falla a medio camino, se intenta deshacer lo ya
 * creado para no dejar cuentas huérfanas.
 */
export async function crearCobrador(formData: FormData) {
  const sesion = await exigirAdministrador();

  const nombreCompleto = String(formData.get("nombre_completo") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const telefono = String(formData.get("telefono") || "").trim() || null;
  const password = String(formData.get("password") || "");
  const rutaId = String(formData.get("ruta_id") || "").trim();
  const rutaNueva = String(formData.get("ruta_nueva") || "").trim();

  if (!nombreCompleto || !email || password.length < 6) {
    redirect(
      `/cobradores/nuevo?error=${encodeURIComponent(
        "Nombre, correo y una contraseña de al menos 6 caracteres son obligatorios"
      )}`
    );
  }

  const { tipoComision, porcentajeComision } = leerComision(formData, "/cobradores/nuevo");

  const admin = createAdminClient();

  const { data: nuevoUsuario, error: errorAuth } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (errorAuth || !nuevoUsuario.user) {
    redirect(`/cobradores/nuevo?error=${encodeURIComponent(errorAuth?.message || "No se pudo crear la cuenta")}`);
  }

  const supabase = await createClient();
  const { data: rolCobrador } = await supabase.from("roles").select("id").eq("nombre", "cobrador").single();

  const { error: errorUsuario } = await admin.from("usuarios").insert({
    id: nuevoUsuario.user.id,
    nombre_completo: nombreCompleto,
    telefono,
    rol_id: rolCobrador?.id,
    activo: true,
  });

  if (errorUsuario) {
    await admin.auth.admin.deleteUser(nuevoUsuario.user.id);
    redirect(`/cobradores/nuevo?error=${encodeURIComponent(errorUsuario.message)}`);
  }

  const { data: nuevoCobrador, error: errorCobrador } = await admin
    .from("cobradores")
    .insert({
      usuario_id: nuevoUsuario.user.id,
      activo: true,
      tipo_comision: tipoComision,
      porcentaje_comision: porcentajeComision,
    })
    .select("id")
    .single();

  if (errorCobrador || !nuevoCobrador) {
    await admin.auth.admin.deleteUser(nuevoUsuario.user.id);
    redirect(`/cobradores/nuevo?error=${encodeURIComponent(errorCobrador?.message || "No se pudo crear el cobrador")}`);
  }

  // Ruta: o se le asigna una ya existente (sin dueño), o se crea una nueva y se le asigna de una vez.
  if (rutaId) {
    await admin.from("rutas").update({ cobrador_id: nuevoCobrador.id }).eq("id", rutaId).is("cobrador_id", null);
  } else if (rutaNueva) {
    await admin.from("rutas").insert({ nombre: rutaNueva, cobrador_id: nuevoCobrador.id, activa: true });
  }

  await admin.from("historial_movimientos").insert({
    usuario_id: sesion.id,
    tipo_movimiento: "creacion_cobrador",
    descripcion: `Se creó la cuenta de cobrador para ${nombreCompleto} (${email})`,
  });

  revalidatePath("/cobradores");
  redirect("/cobradores");
}

/** Corrige nombre/teléfono (tabla `usuarios`) y comisión (tabla `cobradores`) de un cobrador ya existente. La ruta se reasigna aparte (ver "Rutas asignadas"). */
export async function actualizarCobrador(formData: FormData) {
  await exigirAdministrador();
  const supabase = await createClient();

  const cobradorId = String(formData.get("cobrador_id") || "");
  const usuarioId = String(formData.get("usuario_id") || "");
  const nombreCompleto = String(formData.get("nombre_completo") || "").trim();
  const telefono = String(formData.get("telefono") || "").trim() || null;

  if (!nombreCompleto) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent("El nombre es obligatorio")}`);
  }

  const { tipoComision, porcentajeComision } = leerComision(formData, `/cobradores/${cobradorId}`);

  const { error: errorUsuario } = await supabase
    .from("usuarios")
    .update({ nombre_completo: nombreCompleto, telefono })
    .eq("id", usuarioId);

  if (errorUsuario) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent(errorUsuario.message)}`);
  }

  const { error: errorCobrador } = await supabase
    .from("cobradores")
    .update({ tipo_comision: tipoComision, porcentaje_comision: porcentajeComision })
    .eq("id", cobradorId);

  if (errorCobrador) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent(errorCobrador.message)}`);
  }

  revalidatePath("/cobradores");
  revalidatePath(`/cobradores/${cobradorId}`);
  redirect(`/cobradores/${cobradorId}?exito=${encodeURIComponent("Datos actualizados")}`);
}

/**
 * Crea una ruta y se la asigna de una vez a este cobrador — reemplaza a la
 * antigua pantalla independiente /rutas/nueva. Se usa tanto desde "Nuevo
 * cobrador" como desde la ficha de un cobrador que todavía no tiene ruta.
 */
export async function agregarRutaACobrador(formData: FormData) {
  await exigirAdministrador();
  const supabase = await createClient();

  const cobradorId = String(formData.get("cobrador_id") || "");
  const nombre = String(formData.get("nombre") || "").trim();

  if (!nombre) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent("Escribe el nombre de la ruta")}`);
  }

  const { error } = await supabase.from("rutas").insert({ nombre, cobrador_id: cobradorId, activa: true });

  if (error) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/cobradores/${cobradorId}`);
  redirect(`/cobradores/${cobradorId}?exito=${encodeURIComponent(`Ruta "${nombre}" agregada`)}`);
}

/**
 * Activa o desactiva a un cobrador de un jalón: `usuarios.activo` (le
 * bloquea/permite iniciar sesión) y `cobradores.activo` (lo saca/mete de la
 * lista de elegibles para nuevas rutas y de los conteos del panel). No borra
 * ni reasigna nada de su historial, clientes o préstamos.
 */
export async function cambiarEstadoCobrador(formData: FormData) {
  await exigirAdministrador();
  const supabase = await createClient();

  const cobradorId = String(formData.get("cobrador_id") || "");
  const usuarioId = String(formData.get("usuario_id") || "");
  const nuevoEstado = String(formData.get("nuevo_estado") || "") === "activar";

  const { error: errorCobrador } = await supabase
    .from("cobradores")
    .update({ activo: nuevoEstado })
    .eq("id", cobradorId);

  if (errorCobrador) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent(errorCobrador.message)}`);
  }

  const { error: errorUsuario } = await supabase
    .from("usuarios")
    .update({ activo: nuevoEstado })
    .eq("id", usuarioId);

  if (errorUsuario) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent(errorUsuario.message)}`);
  }

  revalidatePath("/cobradores");
  revalidatePath(`/cobradores/${cobradorId}`);
  redirect(
    `/cobradores/${cobradorId}?exito=${encodeURIComponent(
      nuevoEstado ? "Cobrador reactivado" : "Cobrador desactivado"
    )}`
  );
}

/** Le pone una contraseña nueva a la cuenta de acceso del cobrador (requiere la llave service_role). */
export async function restablecerPasswordCobrador(formData: FormData) {
  await exigirAdministrador();

  const cobradorId = String(formData.get("cobrador_id") || "");
  const usuarioId = String(formData.get("usuario_id") || "");
  const password = String(formData.get("password") || "");

  if (password.length < 6) {
    redirect(
      `/cobradores/${cobradorId}?error=${encodeURIComponent("La contraseña debe tener al menos 6 caracteres")}`
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(usuarioId, { password });

  if (error) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/cobradores/${cobradorId}?exito=${encodeURIComponent("Contraseña actualizada")}`);
}

/**
 * Mueve un cliente de un cobrador a otro. Sus préstamos activos o en mora se
 * mueven con él (para que el nuevo cobrador los pueda cobrar); los ya
 * liquidados o cancelados se quedan con su cobrador original para no alterar
 * el historial de quién los cobró.
 */
export async function reasignarCliente(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const clienteId = String(formData.get("cliente_id") || "");
  const cobradorOrigenId = String(formData.get("cobrador_origen_id") || "");
  const nuevoCobradorId = String(formData.get("nuevo_cobrador_id") || "");

  if (!nuevoCobradorId || nuevoCobradorId === cobradorOrigenId) {
    redirect(
      `/cobradores/${cobradorOrigenId}?error=${encodeURIComponent("Elige un cobrador distinto para reasignar")}`
    );
  }

  const { data: destino } = await supabase
    .from("cobradores")
    .select("id, usuarios(nombre_completo)")
    .eq("id", nuevoCobradorId)
    .eq("activo", true)
    .maybeSingle();

  if (!destino) {
    redirect(`/cobradores/${cobradorOrigenId}?error=${encodeURIComponent("Ese cobrador ya no está activo")}`);
  }

  const nombreDestino =
    (destino as unknown as { usuarios: { nombre_completo: string } | null }).usuarios?.nombre_completo ??
    "otro cobrador";

  const { data: cliente } = await supabase
    .from("clientes")
    .select("nombre_completo")
    .eq("id", clienteId)
    .single();

  const { error: errorCliente } = await supabase
    .from("clientes")
    .update({ cobrador_id: nuevoCobradorId })
    .eq("id", clienteId);

  if (errorCliente) {
    redirect(`/cobradores/${cobradorOrigenId}?error=${encodeURIComponent(errorCliente.message)}`);
  }

  await supabase
    .from("prestamos")
    .update({ cobrador_id: nuevoCobradorId })
    .eq("cliente_id", clienteId)
    .in("estado", ["activo", "en_mora"]);

  await supabase.from("historial_movimientos").insert({
    usuario_id: sesion.id,
    cliente_id: clienteId,
    tipo_movimiento: "reasignacion_cliente",
    descripcion: `${cliente?.nombre_completo ?? "Cliente"} fue reasignado a ${nombreDestino}`,
  });

  revalidatePath("/cobradores");
  revalidatePath(`/cobradores/${cobradorOrigenId}`);
  revalidatePath(`/cobradores/${nuevoCobradorId}`);
  redirect(`/cobradores/${cobradorOrigenId}?exito=${encodeURIComponent(`Cliente reasignado a ${nombreDestino}`)}`);
}

/**
 * Mueve TODOS los clientes de un cobrador a otro de un jalón (junto con sus
 * préstamos activos o en mora) — para cuando alguien deja de trabajar y hay
 * que repartir su cartera.
 */
export async function reasignarTodosLosClientes(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const cobradorOrigenId = String(formData.get("cobrador_origen_id") || "");
  const nuevoCobradorId = String(formData.get("nuevo_cobrador_id") || "");

  if (!nuevoCobradorId || nuevoCobradorId === cobradorOrigenId) {
    redirect(
      `/cobradores/${cobradorOrigenId}?error=${encodeURIComponent("Elige un cobrador distinto para reasignar")}`
    );
  }

  const { data: destino } = await supabase
    .from("cobradores")
    .select("id, usuarios(nombre_completo)")
    .eq("id", nuevoCobradorId)
    .eq("activo", true)
    .maybeSingle();

  if (!destino) {
    redirect(`/cobradores/${cobradorOrigenId}?error=${encodeURIComponent("Ese cobrador ya no está activo")}`);
  }

  const { data: clientesAMover } = await supabase
    .from("clientes")
    .select("id")
    .eq("cobrador_id", cobradorOrigenId);

  const idsClientes = (clientesAMover ?? []).map((c) => c.id);

  if (idsClientes.length === 0) {
    redirect(
      `/cobradores/${cobradorOrigenId}?error=${encodeURIComponent("Este cobrador no tiene clientes que reasignar")}`
    );
  }

  const { error: errorClientes } = await supabase
    .from("clientes")
    .update({ cobrador_id: nuevoCobradorId })
    .eq("cobrador_id", cobradorOrigenId);

  if (errorClientes) {
    redirect(`/cobradores/${cobradorOrigenId}?error=${encodeURIComponent(errorClientes.message)}`);
  }

  await supabase
    .from("prestamos")
    .update({ cobrador_id: nuevoCobradorId })
    .in("cliente_id", idsClientes)
    .in("estado", ["activo", "en_mora"]);

  const nombreDestino =
    (destino as unknown as { usuarios: { nombre_completo: string } | null }).usuarios?.nombre_completo ??
    "otro cobrador";

  await supabase.from("historial_movimientos").insert({
    usuario_id: sesion.id,
    tipo_movimiento: "reasignacion_cliente",
    descripcion: `Se reasignaron ${idsClientes.length} clientes a ${nombreDestino}`,
  });

  revalidatePath("/cobradores");
  revalidatePath(`/cobradores/${cobradorOrigenId}`);
  revalidatePath(`/cobradores/${nuevoCobradorId}`);
  redirect(
    `/cobradores/${cobradorOrigenId}?exito=${encodeURIComponent(
      `${idsClientes.length} clientes reasignados a ${nombreDestino}`
    )}`
  );
}

/**
 * Prende o apaga el permiso de dar préstamos (dar de alta cliente nuevo /
 * renovar) de un cobrador — pensado para alguien que solo va a cubrir la
 * ruta de otro mientras no está, sin que pueda comprometer dinero de
 * Empresa en préstamos nuevos. No le afecta su acceso para cobrar.
 */
export async function cambiarPuedeDarPrestamos(formData: FormData) {
  await exigirAdministrador();
  const supabase = await createClient();

  const cobradorId = String(formData.get("cobrador_id") || "");
  const puedeDarPrestamos = String(formData.get("puede_dar_prestamos") || "") === "si";

  const { error } = await supabase
    .from("cobradores")
    .update({ puede_dar_prestamos: puedeDarPrestamos })
    .eq("id", cobradorId);

  if (error) {
    redirect(`/cobradores/${cobradorId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/cobradores/${cobradorId}`);
  redirect(
    `/cobradores/${cobradorId}?exito=${encodeURIComponent(
      puedeDarPrestamos ? "Ahora sí puede dar préstamos" : "Ya no puede dar préstamos (solo puede cobrar)"
    )}`
  );
}

/**
 * Empieza una cobertura: `cobradorCubreId` va a poder ver y cobrar, además
 * de los suyos, los clientes de `cobradorCubiertoId` — sin quitárselos, los
 * comparten mientras la cobertura esté activa.
 */
export async function iniciarCobertura(formData: FormData) {
  const sesion = await exigirAdministrador();
  const supabase = await createClient();

  const cobradorCubreId = String(formData.get("cobrador_cubre_id") || "");
  const cobradorCubiertoId = String(formData.get("cobrador_cubierto_id") || "");
  // La ficha de cualquiera de los dos cobradores puede iniciar la cobertura
  // (una tiene el selector "va a cubrir a…", la otra "lo va a cubrir…") —
  // así que quien llama manda a cuál de las dos fichas regresar.
  const volverA = String(formData.get("volver_a") || "");

  if (!cobradorCubreId || !cobradorCubiertoId || cobradorCubreId === cobradorCubiertoId) {
    redirect(`${volverA}?error=${encodeURIComponent("Elige un cobrador distinto para la cobertura")}`);
  }

  const { error } = await supabase.from("coberturas_cobrador").insert({
    cobrador_cubre_id: cobradorCubreId,
    cobrador_cubierto_id: cobradorCubiertoId,
    creado_por: sesion.id,
  });

  if (error) {
    redirect(`${volverA}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/cobradores/${cobradorCubreId}`);
  revalidatePath(`/cobradores/${cobradorCubiertoId}`);
  redirect(`${volverA}?exito=${encodeURIComponent("Cobertura iniciada")}`);
}

/** Termina una cobertura activa — los clientes vuelven a verse solo desde su cobrador original. */
export async function terminarCobertura(formData: FormData) {
  await exigirAdministrador();
  const supabase = await createClient();

  const coberturaId = String(formData.get("cobertura_id") || "");
  const volverA = String(formData.get("volver_a") || "");

  const { data: cobertura, error } = await supabase
    .from("coberturas_cobrador")
    .update({ activo: false, fecha_fin: new Date().toISOString() })
    .eq("id", coberturaId)
    .select("cobrador_cubre_id, cobrador_cubierto_id")
    .single();

  if (error) {
    redirect(`${volverA}?error=${encodeURIComponent(error.message)}`);
  }

  if (cobertura) {
    revalidatePath(`/cobradores/${cobertura.cobrador_cubre_id}`);
    revalidatePath(`/cobradores/${cobertura.cobrador_cubierto_id}`);
  }
  redirect(`${volverA}?exito=${encodeURIComponent("Cobertura terminada")}`);
}
