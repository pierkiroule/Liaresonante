import type { Session } from '../types';
export function sessionToMarkdown(session: Session): string {
  const byId = new Map(session.messages.filter((m) => m.role === 'user').map((m) => [m.id, m]));
  const lines = [
    `# ÉCHO •° — ${session.title}`,
    '',
    'Prototype expérimental. Export confidentiel en clair. Aucune validation clinique.',
    `Séance ${session.fictional ? 'fictive' : 'expérimentale'} du ${new Date(session.createdAt).toLocaleString('fr-FR')}.`,
    '',
    '## Dialogue',
    '',
  ];
  for (const message of session.messages)
    lines.push(
      `### ${message.role === 'user' ? 'Patient' : 'ÉCHO'} · ${message.id}`,
      '',
      message.content,
      '',
      `État : ${message.status}`,
      '',
    );
  if (session.summary) {
    lines.push(
      '## Synthèse descriptive générée',
      '',
      `Relecture humaine indiquée : ${session.summary.reviewed ? 'oui' : 'non'}.`,
      '',
    );
    for (const [title, items] of [
      ['Observations descriptives', session.summary.observations],
      ['Questions facultatives à explorer par le psychologue', session.summary.exploration],
    ] as const) {
      lines.push(`### ${title}`, '');
      for (const item of items) {
        lines.push(`- ${item.text}`);
        for (const id of item.sourceIds) {
          const source = byId.get(id);
          if (source) lines.push(`  Source patient (${id}) : ${source.content}`);
        }
        lines.push('');
      }
    }
  }
  return lines.join('\n');
}
export function downloadSession(session: Session, format: 'json' | 'md'): void {
  const content =
    format === 'json'
      ? JSON.stringify(
          { format: 'echo-session', version: 1, exportedAt: new Date().toISOString(), session },
          null,
          2,
        )
      : sessionToMarkdown(session);
  const blob = new Blob([content], {
    type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `echo-${session.createdAt.slice(0, 10)}-${session.id.slice(0, 8)}.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
