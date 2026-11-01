import { writeFile } from 'node:fs/promises';

interface TokenResponse {
  access_token?: string;
}

function statusText(response: Response): string {
  return response.statusText ? `${response.status} ${response.statusText}` : `HTTP status ${response.status}`;
}

export async function getToken(
  authority: string,
  audience: string,
  clientId: string,
  clientSecret: string,
  scope: string
): Promise<string> {
  const tokenUrl = `${authority.replace(/\/$/, '')}/oauth/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      audience,
      scope,
    }),
  });

  if (!response.ok) {
    throw new Error(`Dohvat tokena nije uspio: ${statusText(response)}`);
  }

  const data = (await response.json()) as TokenResponse;

  if (!data.access_token) {
    throw new Error(`Dohvat tokena nije uspio: odgovor ${response.status} ne sadrži access_token`);
  }

  return data.access_token;
}

export async function issuePass(
  url: string,
  token: string,
  name: string,
  document: string
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, document }),
  });

  if (response.status !== 201) {
    throw new Error(`Izdavanje propusnice nije uspjelo: ${statusText(response)}`);
  }

  const location = response.headers.get('Location');
  if (!location) {
    throw new Error(`Izdavanje propusnice: odgovor ${response.status} nema zaglavlje Location`);
  }

  const id = new URL(location, url).pathname.split('/').filter(Boolean).pop();
  if (!id || !/^[A-Za-z0-9-]+$/.test(id)) {
    throw new Error(`Izdavanje propusnice: neispravan identifikator u zaglavlju Location (${location})`);
  }

  const image = Buffer.from(await response.arrayBuffer());
  await writeFile(`${id}.png`, image);
}
