import { newSession, type Message, type Session } from './types';
/** Authored static material for tests and supervised demonstrations. Never used as generated replies. */
export function fictionalSession(): Session {
  const session = newSession(true);
  const lines: Array<[Message['role'], string]> = [
    ['user', 'En ce moment, j’ai l’impression d’être devant une porte bleue.'],
    ['assistant', 'Une porte bleue. Tu te tiens devant.'],
    ['user', 'Oui, une porte bleue assez lourde. Derrière, j’imagine un jardin.'],
    ['assistant', 'Tu ajoutes un jardin, de l’autre côté de cette porte.'],
    ['user', 'Le jardin me fait penser à celui de mon grand-père. Il y avait un petit chemin.'],
    ['assistant', 'De la porte au jardin, puis à ce petit chemin.'],
    ['user', 'Le chemin, je le vois mieux. Je ne sais pas encore si j’ai envie d’avancer.'],
  ];
  session.title = 'La porte bleue · séance fictive';
  session.messages = lines.map(([role, content], index) => ({
    id: `fiction-${session.id.slice(0, 8)}-${index + 1}`,
    role,
    content,
    createdAt: new Date(Date.now() + index * 1000).toISOString(),
    status: 'complete',
  }));
  return session;
}
