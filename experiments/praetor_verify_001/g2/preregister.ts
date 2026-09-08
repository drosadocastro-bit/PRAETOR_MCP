import { snapshot } from './freeze.js';

process.stdout.write(`${JSON.stringify(snapshot(), null, 2)}\n`);