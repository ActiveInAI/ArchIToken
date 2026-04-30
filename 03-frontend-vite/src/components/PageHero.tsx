type PageHeroProps = {
  title: string;
  eyebrow: string;
  summary: string;
  tags?: readonly string[];
};

export function PageHero({ title, eyebrow, summary, tags = [] }: PageHeroProps) {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{summary}</p>
      </div>
      <div className="badge-row" aria-label="Runtime tags">
        {tags.map((tag) => (
          <span className="badge" key={tag}>
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
