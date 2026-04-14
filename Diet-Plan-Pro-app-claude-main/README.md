# 🥗 NutriPlan Paziente — App PWA

App mobile/desktop per i pazienti del dietista, installabile da browser senza passare dagli store.

---

## 📱 Funzionalità

| Sezione | Cosa fa |
|---|---|
| **Login / Registrazione** | Autenticazione con lo stesso Supabase del sito dietista |
| **Dashboard** | Riepilogo kcal, macro e acqua del giorno con grafici |
| **La mia dieta** | Visualizza il piano prescritto dal dietista, suddiviso per giorni e pasti |
| **Traccia pasti** | Cerca tra milioni di alimenti (Open Food Facts), aggiunge grammi, calcola macro |
| **Acqua** | Tracciamento idratazione con grafica animata |
| **Database alimenti** | Salva alimenti preferiti o aggiunge personalizzati |
| **Profilo** | Info utente, impostazioni, logout |

---

## 🚀 Deploy — Guida step-by-step

### 1. Ottieni le credenziali Supabase

1. Vai su [supabase.com](https://supabase.com) e accedi al tuo progetto
2. Vai su **Settings → API**
3. Copia:
   - **Project URL** (es. `https://abcdef.supabase.co`)
   - **anon public** key

### 2. Crea le tabelle nel database

Nel tuo progetto Supabase, vai su **SQL Editor** e incolla ed esegui questo script:

```sql
-- Diete assegnate dal dietista al paziente
create table if not exists patient_diets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text,
  kcal_target int,
  protein_target int,
  carbs_target int,
  fats_target int,
  meals_count int default 5,
  duration_weeks int,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Pasti della dieta
create table if not exists diet_meals (
  id uuid primary key default gen_random_uuid(),
  diet_id uuid references patient_diets not null,
  meal_type text,
  day_number int,
  meal_order int,
  description text,
  notes text,
  kcal int,
  proteins numeric,
  carbs numeric,
  fats numeric,
  foods jsonb default '[]'::jsonb
);

-- Diario alimentare giornaliero
create table if not exists food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  date date not null,
  meal_type text,
  food_name text,
  grams numeric,
  kcal int,
  proteins numeric,
  carbs numeric,
  fats numeric,
  food_data jsonb,
  created_at timestamptz default now()
);

-- Totali giornalieri (aggiornati automaticamente dall'app)
create table if not exists daily_logs (
  user_id uuid references auth.users not null default auth.uid(),
  date date not null,
  kcal int default 0,
  proteins numeric default 0,
  carbs numeric default 0,
  fats numeric default 0,
  primary key (user_id, date)
);

-- Registro acqua
create table if not exists water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  date date not null,
  amount_ml int not null,
  created_at timestamptz default now()
);

-- Alimenti personalizzati dell'utente
create table if not exists custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  brand text,
  kcal_100g numeric,
  proteins_100g numeric,
  carbs_100g numeric,
  fats_100g numeric,
  fiber_100g numeric,
  source text default 'custom',
  created_at timestamptz default now()
);

-- Abilita Row Level Security su tutte le tabelle
alter table patient_diets enable row level security;
alter table diet_meals enable row level security;
alter table food_logs enable row level security;
alter table daily_logs enable row level security;
alter table water_logs enable row level security;
alter table custom_foods enable row level security;

-- Policy: ogni utente vede solo i propri dati
create policy "utenti vedono i propri dati" on food_logs
  for all using (auth.uid() = user_id);

create policy "utenti vedono i propri dati" on daily_logs
  for all using (auth.uid() = user_id);

create policy "utenti vedono i propri dati" on water_logs
  for all using (auth.uid() = user_id);

create policy "utenti vedono i propri dati" on custom_foods
  for all using (auth.uid() = user_id);

-- Pazienti vedono solo la propria dieta
create policy "pazienti vedono la propria dieta" on patient_diets
  for select using (auth.uid() = user_id);

-- Il dietista può scrivere le diete dei pazienti (da aggiungere nel pannello dietista)
create policy "dietisti gestiscono le diete" on patient_diets
  for all using (true); -- raffina con ruoli se necessario

create policy "accesso ai pasti della dieta" on diet_meals
  for select using (
    exists (
      select 1 from patient_diets
      where id = diet_id and user_id = auth.uid()
    )
  );
```

### 3. Pubblica il codice su GitHub

1. Crea un account su [github.com](https://github.com) se non ce l'hai
2. Crea un nuovo repository (es. `nutri-patient-app`)
3. Carica tutti i file di questa cartella nel repository

   Via terminale (se hai Git installato):
   ```bash
   cd nutri-patient-app
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TUO-USERNAME/nutri-patient-app.git
   git push -u origin main
   ```

### 4. Deploy su Vercel (gratuito)

1. Vai su [vercel.com](https://vercel.com) e fai login con GitHub
2. Clicca **"Add New Project"** e seleziona il repository `nutri-patient-app`
3. Nella sezione **Environment Variables** aggiungi:
   ```
   VITE_SUPABASE_URL       = https://IL-TUO-PROGETTO.supabase.co
   VITE_SUPABASE_ANON_KEY  = la-tua-anon-key
   ```
4. Clicca **Deploy** — Vercel builderà e pubblicherà l'app
5. Riceverai un link tipo `nutri-patient-app.vercel.app`

> 💡 Puoi anche impostare un dominio personalizzato es. `app.tuosito.it` dalle impostazioni Vercel

### 5. Aggiorna il CORS di Supabase

1. In Supabase → **Settings → API → CORS Allowed Origins**
2. Aggiungi il dominio Vercel: `https://nutri-patient-app.vercel.app`

### 6. Inserisci il link sul tuo sito

Nel sito del dietista (`nutri-plan-pro-cxee.vercel.app`) aggiungi un bottone:

```html
<a href="https://nutri-patient-app.vercel.app" target="_blank">
  📱 Scarica l'app per i pazienti
</a>
```

---

## 📲 Come si installa l'app

### Su iPhone/iPad (iOS)
1. Apri il link con **Safari**
2. Tocca l'icona **Condividi** (quadrato con freccia in su)
3. Seleziona **"Aggiungi a schermata Home"**
4. L'app appare come un'app nativa

### Su Android
1. Apri il link con **Chrome**
2. Apparirà in automatico il banner **"Installa app"**
3. Oppure: menu → **"Aggiungi alla schermata Home"**

### Su Windows/Mac (come app desktop)
1. Apri il link in **Chrome** o **Edge**
2. Nella barra degli indirizzi appare l'icona di installazione
3. Clicca per installare come app standalone

---

## 🔧 Sviluppo locale

```bash
# Copia il file .env
cp .env.example .env.local
# Inserisci le credenziali Supabase nel file .env.local

# Installa le dipendenze
npm install

# Avvia il server di sviluppo
npm run dev

# Build di produzione
npm run build
```

---

## 🗂 Struttura del progetto

```
nutri-patient-app/
├── public/
│   ├── favicon.svg
│   └── icons/           ← icone PWA (generare con generate-icons.js)
├── src/
│   ├── components/
│   │   ├── BottomNav.jsx       ← navigazione inferiore
│   │   ├── InstallBanner.jsx   ← banner installazione PWA
│   │   └── LoadingScreen.jsx   ← schermata di caricamento
│   ├── context/
│   │   └── AuthContext.jsx     ← gestione autenticazione
│   ├── lib/
│   │   └── supabase.js         ← client Supabase
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── RegisterPage.jsx
│   │   ├── DashboardPage.jsx   ← home con riepilogo
│   │   ├── DietPage.jsx        ← visualizza dieta prescritta
│   │   ├── MacroTrackerPage.jsx ← traccia pasti e macro
│   │   ├── WaterPage.jsx       ← traccia acqua
│   │   ├── FoodDatabasePage.jsx ← database alimenti
│   │   └── ProfilePage.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .env.example
├── vite.config.js      ← configurazione Vite + PWA
├── vercel.json         ← routing Vercel
└── package.json
```

---

## 🔮 Funzionalità future (espansioni)

- [ ] Notifiche push (promemoria pasto, acqua)
- [ ] Grafico andamento peso nel tempo
- [ ] Foto dei pasti
- [ ] Chat con il dietista
- [ ] Sincronizzazione con Apple Health / Google Fit
- [ ] Modalità offline completa
- [ ] Ricette associate alla dieta

---

## ❓ Supporto

Per problemi o domande, contatta il tuo dietista o apri una issue su GitHub.
