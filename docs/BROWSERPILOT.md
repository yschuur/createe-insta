# Browserpilot — lokale proefversie voor goedgekeurde reacties

Dit is een concrete, beperkte implementatie van browserautomatisering, op verzoek
van de gebruiker. Het is **geen officiële Meta-integratie** en niet live getest
met het Instagram-account van CREATEE. Een werkende koppeling of geslaagde
fixturetest bewijst niet dat Instagram dit toestaat of dat de huidige interface
compatibel is. Instagram kan automatisering beperken; er bestaat geen garantie
tegen accountbeperkingen. Er worden geen controles, captcha's of loginmaatregelen
omzeild. Geen bulkreacties, scheduler of onbeheerde achtergrondpublicatie.

## Wat de pilot doet

Een ingelogde CREATEE-gebruiker exporteert één **opgeslagen en goedgekeurde**
reactie. De server leest de tekst opnieuw uit de database, controleert de eigenaar
van reactie/post en haalt de gebruikersnaam uit de bestaande Instagram-koppeling.
Het exportbestand bevat tekst, postlink en gebruikersnaam, geen wachtwoord/token.
Behandel het bestand als eigen lokale data; wijzig het niet buiten de tool.

De gebruiker importeert dit bestand in de lokale extensie, bekijkt account/tekst,
vinkt toestemming aan en start één poging. De extensie opent de exacte post en:

1. Controleert via zichtbare profielnavigatie welk account is ingelogd.
2. Zoekt een herkenbaar reactieformulier binnen de post.
3. Stopt bij login-/verificatievelden, verkeerde accountnaam, onbekende interface
   of een reeds ingevuld reactieveld.
4. Controleert of dezelfde tekst al zichtbaar is onder het verwachte account.
5. Vult de tekst in en klikt hoogstens één keer op de plaatsknop.
6. Noemt de uitkomst alleen waargenomen als nieuwe tekst met die auteur verschijnt
   en het reactieveld leeggemaakt is. Anders is de uitkomst onzeker.

Na een onzekere uitkomst wordt hetzelfde concept lokaal geblokkeerd tegen opnieuw
plaatsen. Ook na herstart van de extensie blijft die blokkade bestaan. Een poging
met status blocked (dus zonder klik) kan opnieuw. Als de serviceworker onverwacht
stopt, blijft de reservering staan; verwijder die niet blind om opnieuw te proberen.
Bij een blijvende 'lopende poging' moet eerst de echte Instagram-post worden
gecontroleerd. De pilot probeert niet zelf opnieuw bij een onzekere uitkomst.

Deze DOM-controle is conservatief: Instagram-talen, gewijzigde HTML, verborgen
comments of meerdere formulieren kunnen tot stoppen of onzeker resultaat leiden.
Het is geen serverbevestiging van Meta. Controleer na iedere poging de post zelf.
De CREATEE-status verandert niet automatisch: markeer alleen na controle als geplaatst.

## Installeren (Chrome op een computer)

1. Download `artifacts/createe-browserpilot.zip` via GitHub en pak het bestand uit.
2. Open `chrome://extensions` in Chrome.
3. Zet rechtsboven **Ontwikkelaarsmodus** aan.
4. Klik **Uitgepakte extensie laden** en selecteer de uitgepakte map met manifest.json.
5. Log zelf in op instagram.com met het account dat in CREATEE is gekoppeld.
6. Keur een opgeslagen reactie goed in de Reactiestudio en klik **Browserpilot exporteren**.
7. Open de extensie via Chrome's puzzelstukje, selecteer het JSON-exportbestand,
   controleer de accountnaam en reactie, vink toestemming aan en klik op plaatsen.
8. Controleer de post. Heropen het extensie-icoon voor het resultaat. Markeer pas
   daarna de reactie in CREATEE als geplaatst.

Dit vereist een lokale Chrome-installatie; het kan niet rechtstreeks binnen
Vercel of Supabase worden uitgevoerd. Er worden geen browsercookies of tokens
naar CREATEE gestuurd of uitgelezen. Alleen lokale pogingstatussen worden in
chrome.storage.local opgeslagen. De extensie werkt uitsluitend op
https://www.instagram.com en heeft geen externe analytics of berichteninterface.

## Onderzoek naar andere routes

De officiële comment-mogelijkheden zijn gericht op beheerde eigen media en
reacties daarop. Hashtagdetectie geeft geen algemene publicatierechten op de posts
van derden. Een third-party marketingtool verandert die onderliggende Meta-rechten
niet. Dit is daarom een afzonderlijke browserpilot, geen nieuw Meta-permissievlagje.
Officiële referentie:
https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/comment-moderation/

De officiële documentatie kon in deze cloudtaak niet opnieuw worden uitgelezen
(proxy 403). Er is geen actuele live API-proef met een token uitgevoerd. De plaatsingslogica is getest tegen expliciete synthetische HTML-fixtures. De popup
is getest met een gemockte Chrome-API. De installatietest is in deze cloudomgeving
overgeslagen omdat beheerd Chromium ExtensionInstallBlocklist=["*"] afdwingt. Dit
beleid is niet gewijzigd. Echte extensie-installatie en een proef met het ingelogde
account blijven dus vereist.
