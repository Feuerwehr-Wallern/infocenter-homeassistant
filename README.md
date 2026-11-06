# Feuerwehr Infocenter – Home Assistant / HACS

Custom Integration für das Feuerwehr-Infocenter. Die Integration fragt die Operations- und Statistik-Endpunkte ab und stellt Sensoren für Home Assistant bereit.

## Installation über HACS
1. HACS → Integrationen → ⋮ → Benutzerdefinierte Repositories.
2. Repository-URL `https://github.com/Feuerwehr-Wallern/infocenter-homeassistant` eintragen, Kategorie **Integration** wählen.
3. Integration installieren und Home Assistant neu starten.
4. Einstellungen → Geräte & Dienste → Integration hinzufügen → **Feuerwehr Infocenter**.
5. Basis-URL und API-Token eintragen. Als Basis-URL nur die Domain verwenden, z. B. `https://dev-infocenter.feuerwehr-wallern.at`.

## Lovelace-Karte
Die JavaScript-Karte liegt direkt im Integrationspaket. Beim Einrichten wird sie unter `/feuerwehr-infocenter/feuerwehr-infocenter-card.js` bereitgestellt und – sofern Lovelace seine Ressourcen im Storage-Modus verwaltet – automatisch als JavaScript-Modul registriert. Nach der Installation ist daher normalerweise keine manuelle Ressourcenregistrierung erforderlich.

**Einschränkung:** Bei Lovelace-Ressourcen im YAML-Modus kann Home Assistant die Ressourcenliste nicht über die Integration verändern. In diesem Fall muss folgende Ressource in der Lovelace-YAML-Konfiguration eingetragen werden:

```yaml
lovelace:
  resources:
    - url: /feuerwehr-infocenter/feuerwehr-infocenter-card.js?v=1.2.0
      type: module
```

Beispiel für eine Karte:

```yaml
type: custom:feuerwehr-infocenter-card
title: Feuerwehr Wallern – Infocenter
active_entity: sensor.feuerwehr_infocenter_aktive_einsatzliste
entity: sensor.feuerwehr_infocenter_einsatzliste
stats_entity: sensor.feuerwehr_infocenter_statistik
```

Die tatsächlichen Entity-IDs bitte nach dem Einrichten unter Entwicklerwerkzeuge → Zustände prüfen.

## Hinweise
- Der API-Token wird als Config-Entry gespeichert und nicht in Logs ausgegeben.
- Standard-Abfrageintervall: 60 Sekunden.
- Einsätze werden anhand der veröffentlichten API-Daten gefiltert; ein Einsatz ohne `time_finished` und mit aktivem Status gilt als laufend.

## Entwicklung
```text
custom_components/feuerwehr_infocenter/
  __init__.py
  api.py
  config_flow.py
  const.py
  frontend.py
  frontend/feuerwehr-infocenter-card.js
  manifest.json
  sensor.py
```


### Einsatzstatistik und Einsatzliste (Version 1.3.0)

Die Lovelace-Karte stellt die Monatsstatistik als gestapeltes Balkendiagramm mit den Kategorienfarben dar. Die Einsatzliste wird bereits beim API-Abruf mit `limit=5` begrenzt und zeigt höchstens fünf veröffentlichte Einsätze.


## Nächste Termine (WordPress-Widget-Ansicht)

Ab Version 1.5.0 enthält die Lovelace-Karte zusätzlich den Tab **„Nächste Termine“**.
Die Darstellung orientiert sich am Widget „Feuerwehr – Nächste Termine“ aus
`ic-calendar.php`: Kalender-Farbpunkt und farbiger Rahmen, laufende Termine zuerst
(mit dezent blinkendem Punkt), Datum/Uhrzeit, Ort, Kontaktperson, Beschreibung
und Kalendername. Bereits beendete Termine werden ausgeblendet.

Die Standardanzeige umfasst fünf Termine. Optional kann die Karte angepasst werden:

```yaml
type: custom:feuerwehr-infocenter-card
title: Feuerwehr Wallern
active_entity: sensor.feuerwehr_infocenter_aktive_einsatzliste
entity: sensor.feuerwehr_infocenter_einsatzliste
stats_entity: sensor.feuerwehr_infocenter_statistik
events_entity: sensor.feuerwehr_infocenter_naechste_termine
events_limit: 5
# Optional: nur ausgewählte Kalender anzeigen
# events_calendars:
#   - Allgemein
#   - Bewerbsgruppe
```

Die Ereignisdaten werden über den `events`-Endpunkt geladen. Die Kalenderfilter
sind optional; ohne Filter werden alle Kalender berücksichtigt.


### Version 1.5.0
- Einsatzstatistik mit Umschaltung „Jahr“/„Alle“, Donutdiagramm und Monats-/Jahresbalken.
- Jahresstatistiken werden beim Aktualisieren der Integration abgerufen.
- Einsatzlisten-API bleibt auf `limit=5` begrenzt.
- Termine bleiben als WordPress-Widget-Ansicht mit Kalenderfarben und laufenden Terminen verfügbar.
