# Jouw speelveld: selecteren vóór opslaan

1. Open supabase/migrations/20261030120000_playfield_settings.sql op GitHub.
   Kopieer de volledige SQL naar Supabase > SQL Editor > New query en Run.
   Deze update voegt ontbrekende filterkolommen toe en bewaart bestaande data,
   kolommen en toegangsregels. Hij werkt ook als de vorige filterupdate al is gedaan.
   Onverwachte bestaande kolomtypes geven een fout en volledige rollback.
2. Open supabase/deploy/agent.ts op GitHub en kies Copy raw file.
3. Open Supabase > Edge Functions > agent > Code. Vervang index.ts volledig door
   die code en kies Deploy updates. Alle helpers zitten in dit ene bestand.
4. Na de Vercel-deployment: ga naar Instellingen > Jouw speelveld, stel de filters
   in en klik Instellingen opslaan. Nieuwe zoekopdrachten gebruiken alleen de
   opgeslagen criteria; losse categorie-tabs bepalen de zoekopdracht niet meer.

De criteria worden per account in agent_settings.discovery_filters bewaard en
server-side opnieuw geladen. De oude categoriekeuze blijft als beginwaarde
behouden totdat het nieuwe speelveld is opgeslagen. Onopgeslagen wijzigingen
veranderen het ontdekken niet. Het overzicht behoudt eerder geselecteerde posts;
het speelveld dient niet meer als achteraf verbergfilter.

## Selectieproces

- Per categorie/hashtag haalt de functie maximaal 25 recente kandidaten op.
- Datum, media, trefwoorden, hashtags en engagement worden eerst gecontroleerd.
- De browser vraagt daarna één selectie per kandidaat aan. Zo ontstaat geen lange
  serveraanvraag met 25 AI-analyses achter elkaar. Voortgang en losse fouten zijn zichtbaar.
- Bij 'eerder behandeld verbergen' worden posts met een bestaande reactie vóór AI
  overgeslagen. Als taal of relevantie aanstaat, voert de server beeld-/captionanalyse
  uit voor kandidaten die de goedkope criteria doorstaan. Dit gebruikt OpenAI-tegoed.
- Alleen als alle actieve criteria passen, wordt de post opgeslagen of bijgewerkt.
  De selectieanalyse wordt mee opgeslagen. Afgewezen nieuwe kandidaten worden
  niet als instagram_posts opgeslagen en er worden geen reacties voor gegenereerd.
- Als AI faalt, wordt de kandidaat niet toegelaten; de app meldt de fout en gaat
  verder met de andere kandidaten. Bestaande resultaten worden niet verwijderd.
- Als de opgeslagen criteria tijdens een zoekopdracht wijzigen, worden oude
  selectieaanvragen geweigerd met de instructie opnieuw te zoeken.

Onbekende vereiste aantallen, publicatiedatum of taal voldoen niet. Alle Meta-
beperkingen op recente media en unieke hashtags blijven gelden. Er is geen extra
paginatie buiten de eerste 25 resultaten. Eigen hashtags worden onder de eerste
gekozen categorie opgeslagen. Handmatig ingevoerde posts zijn een bewuste invoer
van de gebruiker en vallen buiten deze automatische selectie.

De browserpilot en handmatige publicatie zijn niet gewijzigd; zie BROWSERPILOT.md.
