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
