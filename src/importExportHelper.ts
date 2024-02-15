import {
  defaultDynamicModuleId,
  exportFlightAsGeoJson,
  exportFlightPathAsGeoJson,
  FlightInstance,
  parseFlightOptionsFromGeoJson,
} from '@vcmap/core';
import { downloadText, VcsUiApp } from '@vcmap/ui';

export function exportFlights(selection: FlightInstance[], path = false): void {
  const exportFunction = (
    i: FlightInstance,
  ):
    | ReturnType<typeof exportFlightAsGeoJson>
    | ReturnType<typeof exportFlightAsGeoJson> =>
    path ? exportFlightPathAsGeoJson(i) : exportFlightAsGeoJson(i);

  selection.forEach((flightInstance) => {
    const text = JSON.stringify(exportFunction(flightInstance), null, 2);
    downloadText(
      text,
      `${(flightInstance.properties.title as string | undefined) ?? flightInstance.name}${
        path ? '-path' : ''
      }.json`,
    );
  });
}

export async function importFlights(
  app: VcsUiApp,
  files: File[],
): Promise<void> {
  const flightOptions = await Promise.all(
    files.map(async (file) => {
      const text = await file.text();
      return parseFlightOptionsFromGeoJson(JSON.parse(text));
    }),
  );

  await app.flights.parseItems(flightOptions, defaultDynamicModuleId);
}
