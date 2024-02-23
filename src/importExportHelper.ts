import {
  defaultDynamicModuleId,
  exportFlightAsGeoJson,
  exportFlightPathAsGeoJson,
  FlightInstance,
  type FlightInstanceOptions,
  moduleIdSymbol,
  parseFlightOptionsFromGeoJson,
} from '@vcmap/core';
import { downloadText, NotificationType, type VcsUiApp } from '@vcmap/ui';

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
): Promise<boolean> {
  const { vueI18n } = app;
  const results = await Promise.all(
    files.map(async (file) => {
      const text = await file.text();
      try {
        return parseFlightOptionsFromGeoJson(JSON.parse(text));
      } catch (e) {
        app.notifier.add({
          type: NotificationType.ERROR,
          message: vueI18n.t('components.import.failure', {
            fileName: file.name,
          }) as string,
        });
      }
      return undefined;
    }),
  );

  const flightsToImport = results
    .filter((f) => f)
    .flat() as FlightInstanceOptions[];

  const imported = flightsToImport
    .map((options) => {
      const instance = new FlightInstance(options);
      instance[moduleIdSymbol] = defaultDynamicModuleId;
      return app.flights.add(instance);
    })
    .filter((id) => id != null);
  const importedDelta = flightsToImport.length - imported.length;
  if (importedDelta > 0) {
    app.notifier.add({
      type: NotificationType.WARNING,
      message: vueI18n.t('components.import.addFailure', [
        importedDelta,
      ]) as string,
    });
    return false;
  }
  if (imported.length > 0) {
    app.notifier.add({
      type: NotificationType.SUCCESS,
      message: vueI18n.t('components.import.featuresAdded', [
        imported.length,
      ]) as string,
    });
  } else {
    app.notifier.add({
      type: NotificationType.ERROR,
      message: vueI18n.t('components.import.nothingAdded') as string,
    });
    return false;
  }
  return true;
}
