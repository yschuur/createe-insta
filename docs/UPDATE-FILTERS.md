# Filters activeren in de bestaande app

1. Open supabase/migrations/20261030110000_discovery_filters.sql op GitHub.
   Kopieer de volledige SQL naar Supabase > SQL Editor > New query en Run.
   Dit voegt alleen twee nullable kolommen toe. Het verandert geen bestaande
   records of toegangsregels. Voer het bestand één keer uit. Een tweede poging
   geeft een naamconflict en rolt terug, zonder bestaande kolommen te overschrijven.
2. Open supabase/deploy/agent.ts op GitHub en kies Copy raw file.
3. Ga naar Supabase > Edge Functions > agent > Code, vervang de volledige inhoud
   van index.ts door die code en kies Deploy updates. Dit gegenereerde bestand
   bevat alle helpers; losse schema.ts/validation.ts/discovery.ts zijn dan niet
   nodig voor de dashboarddeployment. Bestaande losse bestanden mogen blijven staan.
4. Laat JWT verification zoals eerder uit: de functie verifieert zelf sessies.
   Alle bestaande secrets blijven staan. Er zijn geen nieuwe secrets nodig.
5. Vercel bouwt de frontend na de GitHub-push. Vernieuw de app zodra die deployment
   gereed is. Onder Ontdekken staan nu de schakelbare filters.

Filters worden per account in deze browser onthouden, niet tussen apparaten
uitgewisseld. Standaard staan ze uit om niet onverwacht alle posts te verbergen.
Wanneer categorie-filter uitstaat worden de categorieën uit Instellingen gebruikt,
of de geselecteerde categorie-tab. Eigen hashtags worden met hun resultaten aan
de eerste geselecteerde categorie gekoppeld; dit wordt in de app vermeld.

Datum, captionwoorden, media en engagement worden al bij het ophalen toegepast.
AI-relevantie/taal en eerder behandeld worden op opgeslagen resultaten toegepast.
Er starten geen extra betaalde analyses door een schakelaar aan te zetten.
Zet AI-filters tijdelijk uit om nieuwe posts te analyseren. Captiontaal wordt bij
volgende analyses vastgelegd. Oudere analyses hebben onbekende taal totdat opnieuw
geanalyseerd. Verborgen aantallen en onbekende publicatiedatums voldoen niet aan
filters die deze waarden vereisen. Aantallen worden ververst bij opnieuw ophalen.
De Instagram API bepaalt welke recente media beschikbaar zijn; een 168-uurfilter
kan geen oudere resultaten afdwingen als Meta die niet levert. Er wordt niet verder
gepagineerd dan de eerste 25 resultaten per hashtag in deze versie.

De app doet één categorie/hashtag per serveraanvraag. Voortgang en losse fouten
zijn zichtbaar; de volgende aanvraag gaat verder na een fout. Nieuwe resultaten
worden na iedere stap opnieuw geladen. Eerdere resultaten worden niet verwijderd.
Een unieke postlink voorkomt dubbele posts, ook bij opnieuw ophalen.

Voor de optionele browserpilot: docs/BROWSERPILOT.md. 'Kopiëren en openen' blijft
beschikbaar voor de handmatige workflow. Geen van beide knoppen registreert
zelfstandig een succesvolle Instagram-publicatie.
