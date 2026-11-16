import data from './content/events.json';
import { validateEvents } from './lib/events-store.mjs';
export { eventFormatNames, eventScopeNames, registrationNames } from './lib/events-store.mjs';
export type InfraEvent = ReturnType<typeof validateEvents>[number];
export const events:InfraEvent[]=validateEvents(data);
