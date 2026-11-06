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
            operations_response, statistics = await asyncio.gather(
                self._get("operations", limit=250),
                self._get("statistics"),
            )
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

            return {
                "count": operations_response.get("count", len(operations)),
                "operations": operations,
                "active": active,
                "statistics": statistics if isinstance(statistics, dict) else {"data": statistics},
                "updated": datetime.now(timezone.utc).isoformat(),
                "operations_meta": {key: value for key, value in operations_response.items() if key != "list"},
            }
        except UpdateFailed:
            raise
        except Exception as err:
            raise UpdateFailed(f"Fehler beim Abrufen der Infocenter-Daten: {err}") from err
