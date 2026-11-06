"""HTTP API client for Feuerwehr Infocenter."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import UpdateFailed


class InfocenterApi:
    def __init__(self, base_url: str, token: str, hass: HomeAssistant) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.session = async_get_clientsession(hass)

    async def _get(self, endpoint: str, **params):
        url = f"{self.base_url}/functions/v1/homepageplugin/{endpoint}"
        try:
            async with self.session.get(
                url,
                params={"token": self.token, **params},
                timeout=aiohttp.ClientTimeout(total=20),
            ) as response:
                if response.status != 200:
                    raise UpdateFailed(f"Infocenter API {endpoint}: HTTP {response.status}")
                return await response.json(content_type=None)
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as err:
            raise UpdateFailed(f"Infocenter API {endpoint}: {err}") from err

    @staticmethod
    def _is_active(operation: dict) -> bool:
        """The API has no is_active field; use operation_status and time_finished."""
        status = str(operation.get("operation_status") or "").lower()
        finished_at = operation.get("time_finished")
        # A finished status or an actual finish timestamp means it is no longer active.
        if status in {"finished", "closed", "completed", "done"}:
            return False
        if finished_at:
            return False
        # The provided API uses e.g. 'moved_out' for an ongoing operation.
        return True

    async def async_get_data(self):
        try:
            operations_response, statistics, events_response = await asyncio.gather(
                self._get("operations", limit=5),
                self._get("statistics"),
                self._get("events", limit=200),
            )
            # The overview endpoint supplies the available years and the all-years totals.
            statistics_by_year = {}
            year_rows = statistics.get("years", []) if isinstance(statistics, dict) else []
            years = [row.get("year") for row in year_rows if isinstance(row, dict) and row.get("year")]
            if years:
                year_results = await asyncio.gather(*(self._get("statistics", year=int(year)) for year in years))
                statistics_by_year = {str(year): result for year, result in zip(years, year_results) if isinstance(result, dict)}
            if not isinstance(operations_response, dict):
                raise UpdateFailed("Ungültige operations-Antwort")
            raw_list = operations_response.get("list", [])
            if not isinstance(raw_list, list):
                raise UpdateFailed("Ungültige Antwort: operations.list ist keine Liste")

            operations = [
                item for item in raw_list
                if isinstance(item, dict) and item.get("publish") is True
            ]
            operations.sort(key=lambda item: str(item.get("time_alert") or ""), reverse=True)
            active = [item for item in operations if self._is_active(item)]

            raw_events = (
                events_response.get("list", events_response.get("events", events_response.get("items", [])))
                if isinstance(events_response, dict) else []
            )
            if not isinstance(raw_events, list):
                raw_events = []
            now = datetime.now(timezone.utc)
            events = []
            for item in raw_events:
                if not isinstance(item, dict) or not item.get("title") or not item.get("start_date"):
                    continue
                end_value = item.get("end_date_effective")
                if end_value:
                    try:
                        end_dt = datetime.fromisoformat(str(end_value).replace("Z", "+00:00"))
                        if end_dt.tzinfo is None:
                            end_dt = end_dt.replace(tzinfo=timezone.utc)
                        if item.get("all_day_event") and str(item.get("start_date")) == str(end_value):
                            from datetime import timedelta
                            end_dt += timedelta(days=1)
                        if end_dt < now:
                            continue
                    except ValueError:
                        continue
                events.append(item)
            events.sort(key=lambda item: str(item.get("start_date") or ""))

            return {
                "count": operations_response.get("count", len(operations)),
                "operations": operations,
                "active": active,
                "events": events,
                "calendars": events_response.get("calendars", []) if isinstance(events_response, dict) else [],
                "statistics": statistics if isinstance(statistics, dict) else {"data": statistics},
                "statistics_by_year": statistics_by_year,
                "updated": datetime.now(timezone.utc).isoformat(),
                "operations_meta": {key: value for key, value in operations_response.items() if key != "list"},
            }
        except UpdateFailed:
            raise
        except Exception as err:
            raise UpdateFailed(f"Fehler beim Abrufen der Infocenter-Daten: {err}") from err
