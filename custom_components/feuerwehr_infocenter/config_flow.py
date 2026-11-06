"""Config flow."""
from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_URL
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
import aiohttp

from .const import DOMAIN, CONF_TOKEN

STEP_USER_DATA_SCHEMA = vol.Schema({
    vol.Required(CONF_URL): str,
    vol.Required(CONF_TOKEN): str,
})

async def validate_input(hass: HomeAssistant, data: dict) -> None:
    base = data[CONF_URL].strip().rstrip("/")
    if not base.startswith(("http://", "https://")):
        raise InvalidUrl
    url = f"{base}/functions/v1/homepageplugin/operations"
    session = async_get_clientsession(hass)
    try:
        async with session.get(url, params={"token": data[CONF_TOKEN], "limit": 1},
                               timeout=aiohttp.ClientTimeout(total=20)) as response:
            if response.status in (401, 403):
                raise InvalidAuth
            if response.status != 200:
                raise CannotConnect
            payload = await response.json(content_type=None)
            if not isinstance(payload, dict) or not isinstance(payload.get("list"), list):
                raise InvalidResponse
    except (aiohttp.ClientError, TimeoutError):
        raise CannotConnect

class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            user_input = {**user_input, CONF_URL: user_input[CONF_URL].strip().rstrip("/"),
                          CONF_TOKEN: user_input[CONF_TOKEN].strip()}
            try:
                await validate_input(self.hass, user_input)
            except InvalidAuth:
                errors["base"] = "invalid_auth"
            except InvalidUrl:
                errors["base"] = "invalid_url"
            except InvalidResponse:
                errors["base"] = "invalid_response"
            except CannotConnect:
                errors["base"] = "cannot_connect"
            else:
                await self.async_set_unique_id(user_input[CONF_URL].lower())
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title="Feuerwehr Infocenter", data=user_input)
        return self.async_show_form(
            step_id="user", data_schema=STEP_USER_DATA_SCHEMA, errors=errors,
            description_placeholders={"hint": "Basis-URL, z. B. https://infocenter.example.at (ohne /functions/...)"}
        )

class CannotConnect(HomeAssistantError):
    pass
class InvalidAuth(HomeAssistantError):
    pass
class InvalidUrl(HomeAssistantError):
    pass
class InvalidResponse(HomeAssistantError):
    pass
