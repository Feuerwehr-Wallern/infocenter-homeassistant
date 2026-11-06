"""Register the Infocenter Lovelace card."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

CARD_URL = "/feuerwehr-infocenter/feuerwehr-infocenter-card.js"
CARD_FILE = Path(__file__).parent / "frontend" / "feuerwehr-infocenter-card.js"
CARD_VERSION = "1.4.0"


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the card and register it in Lovelace storage mode."""
    if not CARD_FILE.is_file():
        _LOGGER.error("Infocenter Lovelace card file is missing: %s", CARD_FILE)
        return

    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(CARD_URL, str(CARD_FILE), True)]
        )
    except (RuntimeError, ValueError) as err:
        # A duplicate static URL can occur if the integration is reloaded.
        _LOGGER.debug("Static card path may already be registered: %s", err)

    # Lovelace resources are only writable in storage mode. YAML mode is
    # intentionally left untouched because its resource list is user-managed.
    try:
        from homeassistant.components.lovelace.const import LOVELACE_DATA

        lovelace_data = hass.data.get(LOVELACE_DATA)
        resources = getattr(lovelace_data, "resources", None)
        resource_mode = getattr(lovelace_data, "resource_mode", None)
        if resources is None:
            _LOGGER.debug("Lovelace resource collection is not available yet")
            return
        if resource_mode == "yaml":
            _LOGGER.warning(
                "Lovelace resources use YAML mode. Add %s as a module resource "
                "to your Lovelace YAML resources list.",
                f"{CARD_URL}?v={CARD_VERSION}",
            )
            return

        # Some HA versions lazy-load this collection. Load it before reading
        # or writing to avoid replacing an existing resource list.
        if hasattr(resources, "loaded") and not resources.loaded:
            await resources.async_load()
            resources.loaded = True

        target_url = f"{CARD_URL}?v={CARD_VERSION}"
        for item in resources.async_items():
            if item.get("url", "").split("?", 1)[0] == CARD_URL:
                if item.get("url") != target_url or item.get("res_type") != "module":
                    await resources.async_update_item(
                        item["id"], {"url": target_url, "res_type": "module"}
                    )
                return

        await resources.async_create_item({"res_type": "module", "url": target_url})
        _LOGGER.info("Registered Feuerwehr Infocenter Lovelace card")
    except (ImportError, AttributeError, KeyError, RuntimeError, ValueError) as err:
        _LOGGER.warning(
            "Could not automatically register the Infocenter Lovelace resource: %s. "
            "Add %s as a module resource manually if needed.",
            err,
            f"{CARD_URL}?v={CARD_VERSION}",
        )
