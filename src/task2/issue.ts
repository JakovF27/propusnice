import { readdir } from 'node:fs/promises';
import { getToken, issuePass } from './automat.ts';

try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
}

const [name, document] = process.argv.slice(2);

if (!name || !document) {
  console.error('Upotreba: npm run issue -- "Ime Prezime" OZNAKA-DOKUMENTA');
  process.exit(1);
}

const env = process.env;
const url = env.AUTOMAT_URL || `${(env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/passes`;

try {
  const token = await getToken(
    env.AUTH0_ISSUER_BASE_URL ?? '',
    env.AUTH0_AUDIENCE ?? '',
    env.M2M_CLIENT_ID ?? '',
    env.M2M_CLIENT_SECRET ?? '',
    'create:passes'
  );

  const before = new Set(await readdir('.'));
  await issuePass(url, token, name, document);
  const created = (await readdir('.')).filter((file) => file.endsWith('.png') && !before.has(file));

  console.log(`Propusnica izdana (${url}).`);
  console.log(`QR kod spremljen: ${created[0] ?? '(datoteka s istim imenom već je postojala)'}`);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
