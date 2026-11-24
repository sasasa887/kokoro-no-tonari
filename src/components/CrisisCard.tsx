import { CRISIS_RESOURCES } from "@/lib/crisis";

export function CrisisCard() {
  return (
    <section role="alert" className="rounded-2xl border border-danger/40 bg-danger-soft p-4 text-sm">
      <p className="font-semibold">{CRISIS_RESOURCES.intro}</p>
      <ul className="mt-2 space-y-1">
        {CRISIS_RESOURCES.links.map((l) => (
          <li key={l.url}>
            <a href={l.url} target="_blank" rel="noreferrer" className="font-medium text-danger underline">
              {l.name}
            </a>
            <span className="text-muted">：{l.description}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-muted">{CRISIS_RESOURCES.emergency}</p>
    </section>
  );
}
