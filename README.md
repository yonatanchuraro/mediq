# MediQ

מערכת ניהול תורים למרפאה — React + Supabase + Gemini AI booking assistant.

## Stack

- **Frontend**: Vite + React + TypeScript + Tailwind + Shadcn/UI
- **Backend / DB**: Supabase (Postgres + Auth + RLS + Edge Functions)
- **AI**: Google Gemini API (Edge Function proxy)
- **Hosting**: Vercel (planned)

## Roles

- **Admin** — manages doctors, services, working hours, all appointments
- **Doctor** — manages own schedule and appointments
- **Client** — books appointments (UI or AI chat)

## Status

Currently scaffolding. Schema lives in [`supabase/schema.sql`](supabase/schema.sql).
