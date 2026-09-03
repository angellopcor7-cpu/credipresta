# CrediPresta

Sistema de gestión de préstamos: clientes, préstamos y pagos, construido con
Next.js y Supabase.

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript, Tailwind CSS)
- [Supabase](https://supabase.com) (Postgres, Auth, Row Level Security)
- Despliegue en [Vercel](https://vercel.com)

## Desarrollo local

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` a `.env.local` y completa las variables con los datos
   de tu proyecto de Supabase (Project Settings → API):

   ```bash
   cp .env.example .env.local
   ```

3. Levanta el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   Abre [http://localhost:3000](http://localhost:3000).

## Base de datos

El esquema (tablas `clients`, `loans`, `payments`, políticas de Row Level
Security y la vista `loan_balances`) vive en Supabase y se gestiona con
migraciones aplicadas vía el MCP de Supabase.

## Despliegue en Vercel

1. Importa este repositorio en [vercel.com/new](https://vercel.com/new).
2. Configura las variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (mismas que en `.env.local`).
3. Despliega. Vercel te dará una URL tipo `credipresta.vercel.app`.
