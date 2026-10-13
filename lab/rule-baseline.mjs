import fs from 'node:fs';
import vm from 'node:vm';

// Existing rule code is evaluated in an isolated context, never in the live app.
const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const boundary = source.indexOf('els.startButton.addEventListener');
if (boundary < 0) throw new Error('App bootstrap boundary changed; review the lab adapter.');
const rules = new vm.Script(source.slice(0, boundary));
const scenarios = new vm.Script(fs.readFileSync(new URL('../scenario.js', import.meta.url), 'utf8'));
const analyse = new vm.Script('analyzeStaff(labInput)');

export function ruleBaseline(text) {
  const context = vm.createContext({ window: {}, document: { querySelector: () => ({}) } });
  scenarios.runInContext(context, { timeout: 1000 });
  rules.runInContext(context, { timeout: 1000 });
  context.labInput = text;
  const result = analyse.runInContext(context, { timeout: 1000 });
  return { service_request: result.asked_service_request, vehicle_concern: result.asked_vehicle_concern };
}
