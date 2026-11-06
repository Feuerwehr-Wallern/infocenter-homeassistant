"""Sensors exposing operations and statistics."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.const import EntityCategory
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN

async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([
        InfocenterSensor(coordinator, entry, "active_count"),
        InfocenterSensor(coordinator, entry, "active_operations"),
        InfocenterSensor(coordinator, entry, "operations"),
        InfocenterSensor(coordinator, entry, "statistics"),
    ])

class InfocenterSensor(CoordinatorEntity, SensorEntity):
    _attr_has_entity_name = True

    def __init__(self, coordinator, entry, kind):
        super().__init__(coordinator)
        self.kind = kind
        self._attr_unique_id = f"{entry.entry_id}_{kind}"
        names = {
            "active_count": "Aktive Einsätze",
            "active_operations": "Aktive Einsatzliste",
            "operations": "Einsatzliste",
            "statistics": "Statistik",
        }
        self._attr_name = names[kind]
        self._attr_icon = {
            "active_count": "mdi:fire-truck",
            "active_operations": "mdi:fire-alert",
            "operations": "mdi:clipboard-list",
            "statistics": "mdi:chart-bar",
        }[kind]

    @property
    def native_value(self):
        data = self.coordinator.data or {}
        if self.kind == "active_count":
            return len(data.get("active", []))
        if self.kind == "active_operations":
            return len(data.get("active", []))
        if self.kind == "operations":
            return len(data.get("operations", []))
        return data.get("statistics", {}).get("total", data.get("statistics", {}).get("count", "Daten"))

    @property
    def extra_state_attributes(self):
        data = self.coordinator.data or {}
        if self.kind == "active_count":
            return {"operations": data.get("active", []), "updated": data.get("updated")}
        if self.kind == "active_operations":
            return {"operations": data.get("active", []), "updated": data.get("updated")}
        if self.kind == "operations":
            return {"operations": data.get("operations", []), "updated": data.get("updated"),
                    "meta": data.get("operations_meta", {})}
        return {"statistics": data.get("statistics", {}), "updated": data.get("updated")}
