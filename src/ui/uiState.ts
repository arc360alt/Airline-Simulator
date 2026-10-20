/** UI-only state shared between panels (not saved). */
export const ui = {
  open: null as string | null,
  highlightPlane: null as string | null,
  selectedAirport: null as string | null,
  tabs: {} as Record<string, string>,
  routeFrom: '' as string,
  routeTo: '' as string,
  airportFilter: '' as string,
  tutorialActive: false,
};
