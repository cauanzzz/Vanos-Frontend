import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { deliverTaskLocations, DRIVER_LOCATION_TASK } from './locationBridge';

// Imported by root layout, defined at module scope before any screen mounts.
if (!TaskManager.isTaskDefined(DRIVER_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(DRIVER_LOCATION_TASK, async ({ data, error }) => {
    const positions = (data?.locations ?? []).map((value) => ({ latitude: value.coords.latitude, longitude: value.coords.longitude,
      accuracy: value.coords.accuracy ?? Infinity, capturedAt: value.timestamp }));
    if (!deliverTaskLocations(positions, Boolean(error))) {
      // Never restore credentials or send from a new JS runtime without an explicit local start.
      try {
        if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK) && !deliverTaskLocations([], false)) {
          await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
        }
      }
      catch { /* Retry on the next delivery or the foreground bootstrap. No data is sent or stored. */ }
    }
  });
}
