# CREATEE Comment Agent

Premium golf- en padelreacties met een menselijke laatste stap. React 19,
TypeScript, Vite, Tailwind 4, shadcn/ui Button (Radix/CVA), Supabase Auth en een
Supabase Edge Function voor OpenAI en officiële Meta-API-aanvragen.

## Status en grenzen

De frontend is gebouwd. De workflow kan lokaal worden gestart en met gemockte
providers worden getest. **De live integratie is nog niet geverifieerd**: de
kolommen, constraints en policies zijn op basis van de aangeleverde CSV-bestanden gecontroleerd en de adapter is aangepast en toegang tot het project vanuit
de cloudomgeving werd door de proxy geweigerd. Er zijn geen bestaande tabellen
aangemaakt of gewijzigd, geen functies gedeployed en geen secrets opgeslagen.

De backend is aangepast aan de bestaande kolommen. De aangeleverde constraints, policies en defaults zijn verwerkt; live tests met echte accounts staan nog open. Voer niet blind een nieuwe basismigratie uit.
Zie [het contract](supabase/schema/CONTRACT.md).

## Lokaal starten

Node 22.12+ of 24 LTS. Gebruik de bestaande checkout, geen extra Git-worktree.

```sh
cd /workspace/createe-insta
npm ci
cp .env.example .env # alleen indien .env nog niet bestaat
# Vul VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in
npm run dev
```

De publieke configuratie die in deze sessie is opgegeven staat al in de genegeerde
`.env`. Zonder clientconfiguratie toont de app een lege configuratiewerkplek;
met Supabase-configuratie toont hij het inlog-/registratieformulier. Er worden
geen verzonnen posts, AI-resultaten of succesvolle koppelingen getoond.

```sh
npm run build
npm test
npm run test:browser
npm run check:edge
```

`npm test` bevat domein-/validatietests en een React-workflowtest met een expliciet
gemockte backend. Browsertests gebruiken geïnstalleerde Chromium en een geïsoleerde
Vite-server zonder Supabase-configuratie. Deze tests bewijzen geen live API-toegang.

## 1. Inspecteer eerst Supabase

Open je bestaande project → **SQL Editor**. Voer
[supabase/schema/inspect.sql](supabase/schema/inspect.sql) uit. Deze query leest
alleen kolommen, constraints en policies; geen gebruikersdata of tokens. Deel de
resultaten voor de zes bestaande tabellen. Pas daarna de queries in
`supabase/functions/agent/index.ts` aan op de werkelijke kolomnamen en relaties.

Let vooral op categorie-ID's versus categorienamen, eigenaarschap (`user_id`),
unieke sleutels en bestaande tokenkolommen. Beperk browsertoegang tot eigen
records met RLS. Het service-role token staat alleen server-side; elke Edge
Function-actie valideert de sessie en beperkt queries tot die gebruiker.

Pas na inspectie zijn twee nieuwe, uitsluitend server-side OAuth-opslagtabellen
nodig. Hun contract en toegangsbeperkingen staan in CONTRACT.md. Er is bewust
geen migratie die bestaande tabellen overschrijft. Zonder die controle is de
app niet gereed voor live gebruik.

## 2. Supabase Auth

Project Settings → API: project-URL en publieke publishable/anon key gaan in `.env`.
**Nooit service-role of geheime sleutels met een VITE\_-prefix.**

Authentication → Providers: schakel e-mail/wachtwoord in. Configureer Site URL en
Redirect URLs voor je frontend-domein. Registratie respecteert Supabase-e-mail-
bevestiging; bevestig je account voordat je inlogt.

## 3. Serverconfiguratie en deploy

Gebruik de officiële Supabase CLI. Link het bestaande project:

```sh
supabase login
supabase link --project-ref gyzsbewdnxltufuxwnzy
# Na schemacontrole en veilige opslagconfiguratie:
supabase functions deploy agent
```

Configureer via **Edge Functions → Secrets** (geen waarden in Git of chat):

| Naam                 | Waar vandaan / betekenis                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| APP_URL              | Exacte frontend-origin, bijv. https://createe.example; lokaal http://localhost:5173                           |
| OPENAI_API_KEY       | OpenAI Platform → API keys; zet billing en gebruikslimieten aan                                               |
| OPENAI_MODEL         | Optioneel; standaard gpt-4.1-mini, vereist beeldinput en structured outputs                                   |
| META_APP_ID          | 2590785931395245                                                                                              |
| META_CONFIG_ID       | 2128827377731884, Facebook Login for Business-configuratie                                                    |
| META_APP_SECRET      | Meta App Dashboard → Settings → Basic; **reset de in chat gedeelde secret**                                   |
| META_GRAPH_VERSION   | Bijvoorbeeld v23.0; kies een nog ondersteunde versie in je Meta-app en controleer de actuele API-documentatie |
| TOKEN_ENCRYPTION_KEY | Base64 van 32 cryptografisch willekeurige bytes; genereer lokaal en sla alleen als secret op                  |

SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY worden in gehoste Edge Functions door
Supabase geïnjecteerd. Gebruik ze nooit in de frontend. Bewaar de encryptiesleutel
veilig; bij rotatie moeten bestaande tokens opnieuw versleuteld of accounts
opnieuw gekoppeld worden.

`verify_jwt=false` staat bewust in config.toml: de browserloze Meta-callback heeft
geen Supabase-JWT. **Alle andere acties** verifiëren server-side het Bearer JWT met
`auth.getUser`. OAuth vereist cryptografische state, met een gehashte, tien minuten
geldige en atomair verbruikte database-entry. Tokens zijn AES-256-GCM-versleuteld
in server-only opslag. Een verlopen token vereist opnieuw koppelen.

## 4. Meta instellen

Voer bij Facebook Login for Business → Settings → **Valid OAuth Redirect URIs**
exact deze URI in:

```text
https://gyzsbewdnxltufuxwnzy.supabase.co/functions/v1/agent?action=oauthCallback
```

Zet het frontend-domein in App Domains en configureer je geldige privacybeleid,
data deletion-instructies en businessgegevens voor app-review. De OAuth-configuratie
gebruikt bovenstaande Configuration ID; configureer de benodigde toestemmingen
in die Business Login-configuratie. Voor dit pad zijn doorgaans
`instagram_basic`, `pages_show_list` en `pages_read_engagement` relevant.
Verifieer aanvullende vereisten en Instagram Public Content Access voor hashtag-
search bij de gekozen Graph API-versie. De actuele Meta-documentatie was vanuit
de sessie niet bereikbaar; app-review/advanced access is niet als voltooid getest.

Kies precies één Facebook-pagina met het gewenste professionele Instagram-account
bij toestemming. Bij meerdere toegestane gekoppelde accounts geeft de callback een
expliciete fout en slaat geen willekeurig gekozen account op.

Ondersteunde officiële ontdekking:

- `ig_hashtag_search` voor golf, padel, golfhumor, padelhumor en sportswear.
- `/{hashtag-id}/recent_media`, maximaal 25 resultaten per categorie per verzoek.
- Geen onbeperkte zoekmachine voor alle Instagram-posts, geen scraping en geen
  private-accounttoegang. Meta bepaalt de beschikbaarheid van recent_media,
  terugkijkperiode, quota (waaronder unieke hashtags) en toegestane app-rollen.
- Geen automatische comments/publicatie; er is geen POST naar een comment-endpoint.

## Workflow

1. Registreer/log in en koppel Instagram bij Instellingen.
2. Selecteer categorieën en sla voorkeuren op.
3. Ontdek recente hashtagposts of voer een publieke post-/Reel-link met caption in.
4. Filter op categorie, werkelijke publicatiedatum, caption en AI-relevantie.
   Handmatige links hebben onbekende publicatiedatums; ze vallen buiten een
   actieve datumfilter. Relevantie wordt na analyse berekend, niet verzonnen.
5. Open de reactiestudio. Beschikbare officiële foto's worden server-side opgehaald
   via beperkte Meta-CDN-hostnames. Captions zonder foto worden als tekst geanalyseerd.
   Voeg een eigen beschikbare foto of videoframe toe via upload (JPEG/PNG/WebP, 5 MB).
   Media zijn vluchtig: uploads worden alleen voor de AI-aanvraag gebruikt.
6. Genereer Speels, Sarcastisch en Woordgrap. Pas humor, toon, lengte, taal en
   instructies aan; bewerk concepten en keur ze goed.
7. Kopieer, open Instagram en publiceer zelf. Pas daarna **Als geplaatst markeren**.
   Dit is een eigen bevestiging, geen via Meta geverifieerde publicatie.

Een handmatige URL onthult op zichzelf geen caption of media. De app omzeilt dat
niet met scraping. Reels worden niet volledig bekeken door het model: er worden
alleen daadwerkelijk beschikbare foto's, thumbnails of geüploade losse frames
geanalyseerd. Er is geen automatische video-download/transcodering. Een caption
of frame kan nooit een betrouwbare beoordeling van de volledige video geven.

Opnieuw genereren bewaart eerdere concepten. Het dashboard telt alle opgeslagen
concepten. Het huidige overzicht laadt maximaal 200 posts per gebruiker. Voeg voor
productieschaal paginatie, een transactionele RPC, server-side quota en telemetry
zonder tokens toe. De limiet op 25 posts per hashtag beperkt de MVP-ontdekking;
er is geen background crawler.

## Cloudomgeving

Netwerkdomeinen zijn als concept opgeslagen voor dit Supabase-project,
`developers.facebook.com`, `www.facebook.com`, `graph.facebook.com` en
`api.openai.com`. Opslaan van een concept past de actieve proxy niet direct aan:
bekijk/sla op in omgevingsinstellingen en publiceer de omgeving. Controleer toegang
opnieuw na toepassing. Credentials voor gehoste functies blijven in Supabase.

## Wat nog live getest moet worden

- Schemacompatibiliteit en RLS tussen twee echte accounts.
- E-mailregistratie/inloggen tegen het echte project.
- Meta consent, state replay, accountselectie, tokenverval en hashtagtoestemming.
- OpenAI beeld-/captionanalyse met echte billing en ondersteund model.
- Bewaren, opnieuw laden en handmatig publiceren van een echte reactie.

Deze stappen zijn niet als geslaagd aangemerkt. Er is geen automatische publicatie,
geen databasewijziging en geen deployment uitgevoerd.

## Inspectieresultaat en volgende configuratiestap

De schema- en toegangsregels zijn aangeleverd en statisch gecontroleerd. De echte
database gebruikt `posted` voor handmatig geplaatste reacties. De adapter vertaalt
dit naar de UI-status zonder de bestaande CHECK constraint te veranderen.

Er is een uitsluitend aanvullende OAuth-opslagmigratie voorbereid in
`supabase/migrations/20261030103000_createe_oauth_storage.sql`. Deze is niet
uitgevoerd. Installeer de twee nieuwe server-only tabellen pas na controle op
bestaande gelijknamige tabellen/vault-integraties. Deploy vervolgens de volledige
`agent`-functie inclusief schema.ts en validation.ts. Een Vercel-deployment
publiceert deze Supabase-functie niet automatisch.

Voor de volgende stap is de echte Vercel-URL nodig als APP_URL. Daarna moeten de
servergeheimen in Supabase worden ingevuld. Geen geheimen horen in chat, GitHub of
Vercel-variabelen met VITE_-prefix. Roteer de eerder gedeelde Meta-secret.
