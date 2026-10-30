import { categories } from "../lib/domain";
import {
  defaultFilters,
  type FilterOptions,
} from "../../supabase/functions/agent/discovery";
export default function DiscoveryFilters({
  value: f,
  onChange,
  disabled = false,
}: {
  value: FilterOptions;
  onChange: (f: FilterOptions) => void;
  disabled?: boolean;
}) {
  function toggle(key: Exclude<keyof FilterOptions, "sort">) {
    onChange({ ...f, [key]: { ...f[key], on: !f[key].on } });
  }
  const titles = {
    categories: "Categorieën",
    age: "Ouderdom",
    media: "Type bericht",
    hashtags: "Hashtags",
    keywords: "Trefwoorden",
    language: "Taal",
    relevance: "AI-relevantie",
    engagement: "Engagement",
    handled: "Eerder behandeld verbergen",
  };
  const field = (
    key: Exclude<keyof FilterOptions, "sort">,
    children: React.ReactNode,
  ) => (
    <section className="filter-card" key={key}>
      <label className="filter-switch">
        <span>{titles[key]}</span>
        <input
          type="checkbox"
          role="switch"
          aria-label={`${titles[key]} filter`}
          checked={f[key].on}
          disabled={disabled}
          onChange={() => toggle(key)}
        />
      </label>
      <fieldset disabled={disabled || !f[key].on}>{children}</fieldset>
    </section>
  );
  return (
    <details className="discovery-filters" open>
      <summary>
        Filters{" "}
        <span>
          {Object.values(f).filter((v) => typeof v === "object" && v.on).length}{" "}
          actief
        </span>
      </summary>
      <div className="filter-grid">
        {field(
          "categories",
          <div className="filter-checks">
            {categories.map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={f.categories.values.includes(c)}
                  onChange={(e) =>
                    onChange({
                      ...f,
                      categories: {
                        ...f.categories,
                        values: e.target.checked
                          ? [...f.categories.values, c]
                          : f.categories.values.filter((v) => v !== c),
                      },
                    })
                  }
                />
                {c}
              </label>
            ))}
          </div>,
        )}
        {field(
          "age",
          <label>
            Maximale leeftijd
            <select
              value={f.age.hours}
              onChange={(e) =>
                onChange({ ...f, age: { ...f.age, hours: +e.target.value } })
              }
            >
              {[6, 12, 24, 48, 168].map((n) => (
                <option key={n} value={n}>
                  {n} uur
                </option>
              ))}
            </select>
          </label>,
        )}
        {field(
          "media",
          <div className="filter-checks">
            {[
              ["IMAGE", "Foto"],
              ["VIDEO", "Reel / video"],
              ["CAROUSEL_ALBUM", "Carrousel"],
            ].map(([v, label]) => (
              <label key={v}>
                <input
                  type="checkbox"
                  checked={f.media.values.includes(v)}
                  onChange={(e) =>
                    onChange({
                      ...f,
                      media: {
                        ...f.media,
                        values: e.target.checked
                          ? [...f.media.values, v]
                          : f.media.values.filter((x) => x !== v),
                      },
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>,
        )}
        {field(
          "hashtags",
          <label>
            Zoek op hashtags
            <input
              value={f.hashtags.value}
              maxLength={1000}
              placeholder="golf, padel (maximaal 5)"
              onChange={(e) =>
                onChange({
                  ...f,
                  hashtags: { ...f.hashtags, value: e.target.value },
                })
              }
            />
            <small>
              Meta hanteert een limiet voor unieke hashtags. Dit doorzoekt
              alleen recent beschikbare media.
            </small>
          </label>,
        )}
        {field(
          "keywords",
          <>
            <label>
              Bevat minstens één woord
              <input
                value={f.keywords.include}
                maxLength={1000}
                placeholder="training, tournament"
                onChange={(e) =>
                  onChange({
                    ...f,
                    keywords: { ...f.keywords, include: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Sluit woorden uit
              <input
                value={f.keywords.exclude}
                maxLength={1000}
                placeholder="giveaway, winactie"
                onChange={(e) =>
                  onChange({
                    ...f,
                    keywords: { ...f.keywords, exclude: e.target.value },
                  })
                }
              />
            </label>
          </>,
        )}
        {field(
          "language",
          <label>
            AI-herkende captiontaal
            <select
              value={f.language.value}
              onChange={(e) =>
                onChange({
                  ...f,
                  language: { ...f.language, value: e.target.value },
                })
              }
            >
              <option value="nl">Nederlands</option>
              <option value="en">Engels</option>
            </select>
            <small>
              Alleen posts die al zijn geanalyseerd. Onbekende taal wordt niet
              geraden.
            </small>
          </label>,
        )}
        {field(
          "relevance",
          <label>
            Minimale score: {f.relevance.minimum}
            <input
              type="range"
              min="0"
              max="100"
              value={f.relevance.minimum}
              onChange={(e) =>
                onChange({
                  ...f,
                  relevance: { ...f.relevance, minimum: +e.target.value },
                })
              }
            />
            <small>
              Alleen geanalyseerde posts. Filters starten geen betaalde
              AI-aanvragen.
            </small>
          </label>,
        )}
        {field(
          "engagement",
          <>
            <label>
              Minimaal likes
              <input
                type="number"
                min="0"
                max="1000000000"
                value={f.engagement.minLikes}
                onChange={(e) =>
                  onChange({
                    ...f,
                    engagement: { ...f.engagement, minLikes: +e.target.value },
                  })
                }
              />
            </label>
            <label>
              Maximaal reacties
              <input
                type="number"
                min="0"
                max="1000000000"
                value={f.engagement.maxComments}
                onChange={(e) =>
                  onChange({
                    ...f,
                    engagement: {
                      ...f.engagement,
                      maxComments: +e.target.value,
                    },
                  })
                }
              />
            </label>
            <small>
              Posts zonder door Meta geleverde aantallen voldoen niet aan dit
              filter.
            </small>
          </>,
        )}
        {field(
          "handled",
          <p>
            Verberg posts zodra er een concept of geplaatste reactie bij hoort.
          </p>,
        )}
      </div>
      <div className="filter-bottom">
        <label>
          Sorteren
          <select
            value={f.sort}
            onChange={(e) =>
              onChange({ ...f, sort: e.target.value as FilterOptions["sort"] })
            }
          >
            <option value="newest">Nieuwste</option>
            <option value="relevance">Relevantste</option>
            <option value="engagement">Meeste interactie</option>
          </select>
        </label>
        <button
          type="button"
          className="btn btn-outline"
          disabled={disabled}
          onClick={() => onChange(structuredClone(defaultFilters))}
        >
          Filters resetten
        </button>
      </div>
      <p className="filter-help">
        Filters gelden voor opgehaalde posts. Datum en aantallen zijn niet
        altijd beschikbaar. AI-filters kunnen nieuwe, nog niet geanalyseerde
        posts verbergen.
      </p>
    </details>
  );
}
