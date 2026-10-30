import DiscoveryFilters from "./components/DiscoveryFilters";
import {
  defaultFilters,
  parseFilters,
  filterPosts,
  hashtagsFor,
  type FilterOptions,
} from "../supabase/functions/agent/discovery";
import { useEffect, useState, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Compass,
  MessageSquare,
  Settings2,
  Instagram,
  ArrowUpRight,
  Plus,
  Sparkles,
  Copy,
  Check,
  LogOut,
  Search,
  ArrowRight,
  Menu,
  RefreshCw,
  Flag,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { api, supabase } from "./lib/api";
import {
  categories,
  defaults,
  instagramUrl,
  stats,
  type Post,
  type Draft,
  type Settings,
} from "./lib/domain";
const nav = [
  { name: "Overzicht", icon: LayoutDashboard },
  { name: "Ontdekken", icon: Compass },
  { name: "Reactiestudio", icon: MessageSquare },
  { name: "Instellingen", icon: Settings2 },
];
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [authReady, setAuthReady] = useState(!supabase);
  const activeUser = useRef(session?.user.id);
  activeUser.current = session?.user.id;
  const [page, setPage] = useState("Overzicht"),
    [posts, setPosts] = useState<Post[]>([]),
    [selected, setSelected] = useState<Post | null>(null);
  const [settings, setSettings] = useState<Settings>(defaults),
    [enabled, setEnabled] = useState(categories),
    [category, setCategory] = useState("Alle categorieën");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterOptions>(
    structuredClone(defaultFilters),
  );
  const [filterOwner, setFilterOwner] = useState("");
  const [progress, setProgress] = useState("");
  useEffect(() => {
    const id = session?.user.id || "";
    setFilterOwner(id);
    try {
      setFilters(
        parseFilters(
          id
            ? JSON.parse(
                localStorage.getItem("createe-filters:" + id) || "null",
              )
            : null,
        ),
      );
    } catch {
      setFilters(structuredClone(defaultFilters));
    }
  }, [session?.user.id]);
  useEffect(() => {
    if (filterOwner && filterOwner === session?.user.id)
      try {
        localStorage.setItem(
          "createe-filters:" + filterOwner,
          JSON.stringify(filters),
        );
      } catch {}
  }, [filters, filterOwner, session?.user.id]);
  const [link, setLink] = useState(""),
    [caption, setCaption] = useState(""),
    [manualCategory, setManualCategory] = useState("Golf");
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false),
    [mobile, setMobile] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signup, setSignup] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  };
  async function load() {
    const owner = session?.user.id;
    const data = await api("list");
    if (owner !== activeUser.current) return;
    setPosts(data.posts);
    setConnected(data.connected);
    if (data.settings) {
      setSettings(data.settings.editor || defaults);
      setEnabled(data.settings.categories || categories);
    }
  }
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    setPosts([]);
    setSelected(null);
    setConnected(false);
    if (session) void run(load);
  }, [session?.user.id]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has("instagram")) {
      setNotice(
        params.get("instagram") === "connected"
          ? "Instagram gekoppeld. Je kunt nu posts ontdekken."
          : "Instagram-koppeling mislukt. Controleer je Meta-configuratie.",
      );
      history.replaceState({}, "", location.pathname);
    }
  }, []);
  const counts = stats(posts);
  const filtered = filterPosts(posts, filters).filter(
    (p) =>
      (category === "Alle categorieën" || p.category === category) &&
      (p.caption || "").toLowerCase().includes(query.toLowerCase()),
  );
  const targetCategories = filters.categories.on
    ? filters.categories.values
    : category !== "Alle categorieën"
      ? [category]
      : enabled;
  async function discover() {
    const owner = session?.user.id;
    const valid = parseFilters(filters);
    const tags = valid.hashtags.on ? hashtagsFor(valid, "") : null;
    if (tags && !tags.length)
      throw new Error(
        "Vul minstens één hashtag in of zet het hashtagfilter uit.",
      );
    const jobs = tags
      ? tags.map((tag) => ({ category: targetCategories[0], hashtag: tag }))
      : targetCategories.map((category) => ({ category, hashtag: undefined }));
    if (!jobs.length || !jobs[0].category)
      throw new Error("Selecteer minstens één categorie.");
    let imported = 0;
    const warnings: string[] = [];
    try {
      for (let i = 0; i < jobs.length; i++) {
        if (owner !== activeUser.current) break;
        const job = jobs[i];
        setProgress(
          `Ophalen ${i + 1}/${jobs.length}: ${job.hashtag || job.category}…`,
        );
        try {
          const data = await api("discover", {
            categories: [job.category],
            hashtag: job.hashtag,
            filters: valid,
          });
          imported += data.imported;
        } catch (e) {
          warnings.push(
            `${job.hashtag || job.category}: ${e instanceof Error ? e.message : "Aanvraag mislukt"}`,
          );
        }
        await load();
      }
    } finally {
      setProgress("");
    }
    setNotice(
      `${imported} nieuwe posts opgeslagen. ${warnings.length ? `${warnings.length} aanvraag/aanvragen mislukt: ${warnings.join(" | ")}. Eerder opgeslagen resultaten blijven bewaard.` : "Ophalen afgerond."}${valid.hashtags.on ? " Eigen hashtags worden onder de eerste geselecteerde categorie opgeslagen." : ""}`,
    );
  }
  async function copyAndOpen(d: Draft, permalink: string) {
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      await navigator.clipboard.writeText(d.text);
      if (popup) popup.location.href = permalink;
      setNotice(
        popup
          ? "Gekopieerd en Instagram geopend. Plak en plaats de reactie daar zelf."
          : "Gekopieerd. Je browser blokkeert het nieuwe venster; gebruik de Instagram-link.",
      );
    } catch {
      popup?.close();
      throw new Error(
        "Kopiëren geblokkeerd door de browser. Kopieer de tekst handmatig en gebruik de Instagram-link.",
      );
    }
  }
  function openStudio(p: Post) {
    setSelected(p);
    setPage("Reactiestudio");
  }
  async function generate(p: Post) {
    const data = await api("generate", { postId: p.id, settings });
    const next = { ...p, analysis: data.analysis, drafts: data.drafts };
    setSelected(next);
    await load();
  }
  async function saveDraft(d: Draft, status = d.status) {
    await api("saveDraft", { id: d.id, text: d.text, status });
    await load();
    setSelected((p) =>
      p
        ? {
            ...p,
            drafts: p.drafts?.map((x) =>
              x.id === d.id ? { ...d, status } : x,
            ),
          }
        : null,
    );
    setNotice(
      status === "published"
        ? "Handmatige publicatie geregistreerd."
        : "Reactie opgeslagen.",
    );
  }
  async function exportBrowserDraft(d: Draft) {
    const data = await api("browserDraft", { id: d.id });
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `createe-approved-${d.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      "Goedgekeurde reactie geëxporteerd voor de lokale Chrome-browserpilot. Dit plaatst nog niets. De pilot is geen officiële Meta-integratie en moet eerst in jouw browser worden getest.",
    );
  }
  const disabled = busy || !session;
  if (supabase && !authReady)
    return <div className="auth-screen">Sessie laden…</div>;
  if (supabase && !session)
    return (
      <div className="auth-screen">
        <form
          className="auth-card"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const { error } = signup
                ? await supabase!.auth.signUp({ email, password })
                : await supabase!.auth.signInWithPassword({ email, password });
              if (error) throw error;
              if (signup)
                setNotice("Controleer je e-mail om je account te bevestigen.");
            });
          }}
        >
          <div className="wordmark">
            CREATEE<span>®</span>
          </div>
          <div className="eyebrow">COMMENT AGENT</div>
          <h1>
            Een goede reactie
            <br />
            begint hier.
          </h1>
          <p>Jouw merk. Jouw humor. Meer verbinding.</p>
          <label>
            E-mailadres
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Wachtwoord
            <input
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <Button disabled={busy}>
            {signup ? "Account aanmaken" : "Inloggen"}
            <ArrowRight size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSignup(!signup)}
          >
            {signup ? "Ik heb al een account" : "Nieuw? Maak een account aan"}
          </Button>
          {notice && <p role="status">{notice}</p>}
        </form>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="wordmark">
            CREATEE<span>®</span>
          </div>
          <div className="eyebrow">COMMENT AGENT</div>
        </div>
        <div className="workspace">
          <span className="workspace-icon">C</span>
          <div>
            CREATEE Studio<small>Golf. Padel. Personality.</small>
          </div>
          <span className="pro">MVP</span>
        </div>
        <div className="nav-label">WERKPLEK</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.name}
              className={page === n.name ? "nav-item active" : "nav-item"}
              onClick={() => {
                setPage(n.name);
                setMobile(false);
              }}
            >
              <n.icon size={19} />
              {n.name}
              {n.name === "Reactiestudio" && (
                <span className="nav-count">{counts[2]}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="brand-note">
            <Sparkles size={20} />
            <strong>Goed spel. Betere reacties.</strong>
            <p>
              Val op in de feed.
              <br />
              Blijf trouw aan je merk.
            </p>
          </div>
          <div className="profile">
            <div className="avatar">C</div>
            <div>
              CREATEE
              <small>
                {session ? session.user.email : "Configuratiemodus"}
              </small>
            </div>
            {session && (
              <button
                aria-label="Uitloggen"
                onClick={() => supabase?.auth.signOut()}
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <main aria-busy={busy}>
        <header>
          <button
            className="mobile-menu"
            aria-label="Menu"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Werkplek <span>/</span> <b>{page}</b>
          </div>
          <div className="header-right">
            <span className="status-dot" />{" "}
            {connected ? "Instagram gekoppeld" : "Instagram niet gekoppeld"}
            <span className="header-avatar">C</span>
          </div>
        </header>
        <div className="content">
          {!supabase && (
            <div className="config-banner">
              <Settings2 size={18} />
              <div>
                <strong>Je werkplek staat klaar voor configuratie.</strong> Voeg
                de publieke Supabase-gegevens toe aan .env om in te loggen. De
                getoonde aantallen zijn leeg; er wordt geen demoactiviteit
                gesimuleerd.
              </div>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                aria-label="Melding sluiten"
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "Overzicht"
                  ? "JOUW MERK, IN HET GESPREK"
                  : "CREATEE COMMENT AGENT"}
              </div>
              <h1>{page === "Overzicht" ? "Goed spel begint hier." : page}</h1>
              <p>
                {page === "Overzicht"
                  ? "Ontdek de juiste posts. Vind je eigen stem. Maak de connectie."
                  : page === "Ontdekken"
                    ? "Vind het gesprek waar CREATEE bij hoort."
                    : page === "Reactiestudio"
                      ? "Een beetje scherpte. Een heleboel persoonlijkheid."
                      : "Alles voor een werkplek die bij je past."}
              </p>
            </div>
            <Button disabled={disabled} onClick={() => setShowAdd(!showAdd)}>
              <Plus size={17} /> Post toevoegen
            </Button>
          </div>
          {showAdd && (
            <form
              className="panel add-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const permalink = instagramUrl(link);
                  if (!permalink)
                    throw new Error(
                      "Gebruik een geldige https://www.instagram.com/p/…/ of /reel/…/ link.",
                    );
                  await api("addPost", {
                    permalink,
                    caption,
                    category: manualCategory,
                  });
                  await load();
                  setShowAdd(false);
                  setLink("");
                  setCaption("");
                  setNotice(
                    "Post toegevoegd. Voeg beschikbare media toe in de reactiestudio voor beeldanalyse.",
                  );
                });
              }}
            >
              <h3>Instagram-post toevoegen</h3>
              <label>
                Post- of Reel-link
                <input
                  type="url"
                  required
                  placeholder="https://www.instagram.com/p/…/"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
              </label>
              <label>
                Beschikbare caption
                <textarea
                  value={caption}
                  maxLength={10000}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Plak de caption; een link geeft niet automatisch toegang tot de media."
                />
              </label>
              <label>
                Categorie
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <Button disabled={disabled}>Post opslaan</Button>
            </form>
          )}
          {(page === "Overzicht" || page === "Ontdekken") && (
            <>
              {page === "Overzicht" && (
                <>
                  <section className="stats-grid">
                    {[
                      "Gevonden posts",
                      "Geanalyseerde posts",
                      "Gegenereerde reacties",
                      "Geplaatste reacties",
                    ].map((name, i) => (
                      <div className="stat-card" key={name}>
                        <div className="stat-top">
                          <span>{name}</span>
                          {i === 0 ? (
                            <Compass size={18} />
                          ) : i === 1 ? (
                            <Sparkles size={18} />
                          ) : i === 2 ? (
                            <MessageSquare size={18} />
                          ) : (
                            <Check size={18} />
                          )}
                        </div>
                        <strong>{counts[i]}</strong>
                        <small>
                          {i === 3
                            ? "Handmatig bevestigd op Instagram"
                            : "In jouw werkplek"}
                        </small>
                      </div>
                    ))}
                  </section>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="hero-tag">
                        <span /> MADE FOR THE CONVERSATION
                      </span>
                      <h2>
                        Een sterke reactie.
                        <br />
                        Een blijvende indruk.
                      </h2>
                      <p>
                        Van een gemiste putt tot de perfecte bandeja.
                        <br />
                        Geef elk sportmoment een vleugje CREATEE.
                      </p>
                      <Button onClick={() => setPage("Ontdekken")}>
                        Ontdek posts <ArrowRight size={16} />
                      </Button>
                    </div>
                    <div className="court-art" aria-hidden="true">
                      <div className="court-lines" />
                      <div className="ball" />
                      <span className="court-type">
                        PLAY WITH
                        <br />
                        <i>personality.</i>
                      </span>
                      <span className="court-caption">
                        ON COURT. OFF SCRIPT.
                      </span>
                    </div>
                  </section>
                </>
              )}
              <section className="section-title">
                <div>
                  <h2>
                    {page === "Overzicht"
                      ? "Jouw volgende gesprek"
                      : "Ontdek nieuwe posts"}
                    <span className="count-pill">{filtered.length}</span>
                  </h2>
                  <p>Geselecteerd voor jouw merk. Klaar voor jouw draai.</p>
                </div>
                <Button
                  variant="outline"
                  disabled={disabled || !connected || !targetCategories.length}
                  onClick={() => void run(discover)}
                >
                  <RefreshCw size={15} /> Posts ontdekken
                </Button>
              </section>
              <div className="filters">
                <div className="category-tabs">
                  {["Alle categorieën", ...categories].map((c) => (
                    <button
                      className={c === category ? "selected" : ""}
                      key={c}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="filter-controls">
                  <label className="search">
                    <Search size={16} />
                    <input
                      placeholder="Zoek in captions"
                      aria-label="Zoeken"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                </div>
              </div>
              <DiscoveryFilters
                value={filters}
                onChange={setFilters}
                disabled={busy}
              />
              {progress && (
                <p role="status" className="discovery-progress">
                  {progress}
                </p>
              )}
              {filtered.length ? (
                <div className="posts-grid">
                  {filtered.map((p) => (
                    <article className="post-card" key={p.id}>
                      <div className="post-image">
                        {p.thumbnail_url ||
                        (p.media_type !== "VIDEO" && p.media_url) ? (
                          <img
                            src={p.thumbnail_url || p.media_url}
                            alt="Beschikbare Instagram-media"
                          />
                        ) : (
                          <div className="media-empty">
                            <Instagram size={28} />
                            <span>
                              {p.media_type === "VIDEO"
                                ? "Reel · geen thumbnail beschikbaar"
                                : "Handmatig toegevoegde post"}
                            </span>
                          </div>
                        )}
                        <span className="image-category">{p.category}</span>
                      </div>
                      <div className="post-body">
                        <div className="post-meta">
                          <Instagram size={14} /> Instagram{" "}
                          <span>
                            {p.timestamp
                              ? new Date(p.timestamp).toLocaleDateString(
                                  "nl-NL",
                                )
                              : "Datum onbekend"}
                          </span>
                        </div>
                        <p>{p.caption || "Nog geen caption beschikbaar."}</p>
                        <div className="post-footer">
                          <span>
                            {p.analysis
                              ? "✧ Geanalyseerd"
                              : "Klaar voor jouw blik"}
                          </span>
                          <Button variant="ghost" onClick={() => openStudio(p)}>
                            Open studio <ArrowUpRight size={16} />
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Compass size={27} />
                  </div>
                  <h3>Hier begint je volgende gesprek.</h3>
                  <p>
                    {posts.length
                      ? "Geen posts binnen deze filters."
                      : "Koppel Instagram om posts te ontdekken, of voeg je eerste postlink toe."}
                  </p>
                  <Button
                    variant="outline"
                    disabled={disabled}
                    onClick={() => setShowAdd(true)}
                  >
                    <Plus size={16} /> Je eerste post toevoegen
                  </Button>
                </div>
              )}
              <div className="footnote">
                <Flag size={14} /> Een goede reactie voelt menselijk. Jij hebt
                altijd het laatste woord.
              </div>
            </>
          )}
          {page === "Reactiestudio" && (
            <div className="studio-layout">
              <div className="panel">
                <h2>De inspiratie</h2>
                <label>
                  Geselecteerde post
                  <select
                    value={selected?.id || ""}
                    onChange={(e) =>
                      setSelected(
                        posts.find((p) => p.id === e.target.value) || null,
                      )
                    }
                  >
                    <option value="">Kies een post</option>
                    {posts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.caption.slice(0, 65) || p.permalink}
                      </option>
                    ))}
                  </select>
                </label>
                {selected ? (
                  <>
                    <p className="caption">
                      {selected.caption || "Geen caption beschikbaar."}
                    </p>
                    <a
                      className="text-link"
                      href={selected.permalink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Instagram <ArrowUpRight size={15} />
                    </a>
                    <label>
                      Voeg een foto of videoframe toe
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={disabled}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          void run(async () => {
                            if (file.size > 5 * 1024 * 1024)
                              throw new Error("Maximaal 5 MB per afbeelding.");
                            const dataUrl = await new Promise<string>(
                              (resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () =>
                                  resolve(String(reader.result));
                                reader.onerror = reject;
                                reader.readAsDataURL(file);
                              },
                            );
                            const data = await api("analyze", {
                              postId: selected.id,
                              image: dataUrl,
                            });
                            setSelected({
                              ...selected,
                              analysis: data.analysis,
                            });
                            await load();
                            setNotice(
                              "Afbeelding geanalyseerd; de volledige video is niet bekeken.",
                            );
                          });
                        }}
                      />
                    </label>
                    <small>
                      Upload een beschikbaar frame waarvoor je gebruiksrechten
                      hebt. Video-URL’s worden niet als bekeken video behandeld.
                    </small>
                    {selected.analysis && (
                      <div className="analysis">
                        <Sparkles size={17} />
                        <h3>AI-inzichten</h3>
                        <p>{selected.analysis}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p>Kies een gevonden post of voeg een Instagram-link toe.</p>
                )}
              </div>
              <div className="panel">
                <h2>Geef er je draai aan</h2>
                <label>
                  Humorniveau <b>{settings.humor}%</b>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={settings.humor}
                    onChange={(e) =>
                      setSettings({ ...settings, humor: +e.target.value })
                    }
                  />
                </label>
                <div className="form-grid">
                  {(["style", "length", "language"] as const).map((k, i) => (
                    <label key={k}>
                      {["Type humor", "Reactielengte", "Taal"][i]}
                      <select
                        value={settings[k]}
                        onChange={(e) =>
                          setSettings({ ...settings, [k]: e.target.value })
                        }
                      >
                        {(k === "style"
                          ? ["Alle drie", "Speels", "Sarcastisch", "Woordgrap"]
                          : k === "length"
                            ? ["Kort", "Ultrakort", "Medium"]
                            : ["Nederlands", "Engels"]
                        ).map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <label>
                  Vrije instructies
                  <textarea
                    value={settings.instructions}
                    maxLength={2000}
                    onChange={(e) =>
                      setSettings({ ...settings, instructions: e.target.value })
                    }
                    placeholder="Bijvoorbeeld: droogkomisch, geen emoji’s…"
                  />
                </label>
                <Button
                  disabled={disabled || !selected}
                  onClick={() => selected && void run(() => generate(selected))}
                >
                  <Sparkles size={16} />
                  {selected?.drafts?.length
                    ? "Opnieuw genereren"
                    : "Genereer drie reacties"}
                </Button>
                <div className="drafts">
                  {selected?.drafts?.map((d, i) => (
                    <div className="draft" key={d.id}>
                      <div className="draft-heading">
                        <span>
                          0{i + 1} / {d.style}
                        </span>
                        <span>
                          {d.status === "approved"
                            ? "Goedgekeurd"
                            : d.status === "published"
                              ? "Handmatig geplaatst"
                              : "Concept"}
                        </span>
                      </div>
                      <textarea
                        aria-label={`${d.style} reactie`}
                        value={d.text}
                        maxLength={1000}
                        onChange={(e) =>
                          setSelected({
                            ...selected,
                            drafts: selected.drafts!.map((x) =>
                              x.id === d.id
                                ? {
                                    ...x,
                                    text: e.target.value,
                                    status: "draft",
                                  }
                                : x,
                            ),
                          })
                        }
                      />
                      <div className="draft-actions">
                        <Button
                          variant="ghost"
                          disabled={disabled || !d.text.trim()}
                          onClick={() =>
                            void run(() => saveDraft(d, "approved"))
                          }
                        >
                          <Check size={14} /> Goedkeuren
                        </Button>
                        {d.status === "approved" && (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void run(() => exportBrowserDraft(d))
                            }
                          >
                            Browserpilot exporteren
                          </Button>
                        )}
                        {d.status === "approved" && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              void run(() => copyAndOpen(d, selected.permalink))
                            }
                          >
                            Kopiëren en openen op Instagram{" "}
                            <ArrowUpRight size={14} />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          disabled={!d.text.trim()}
                          onClick={() =>
                            void run(async () => {
                              await navigator.clipboard.writeText(d.text);
                              setNotice(
                                "Reactie gekopieerd. Open Instagram om handmatig te plaatsen.",
                              );
                            })
                          }
                        >
                          <Copy size={14} /> Kopiëren
                        </Button>
                        <a
                          href={selected.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-link"
                        >
                          Instagram <ArrowUpRight size={14} />
                        </a>
                        {d.status === "approved" && (
                          <Button
                            variant="ghost"
                            disabled={disabled}
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Heb je deze reactie zelf op Instagram gepubliceerd?",
                                )
                              )
                                void run(() => saveDraft(d, "published"));
                            }}
                          >
                            Als geplaatst markeren
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {page === "Instellingen" && (
            <div className="settings-grid">
              <section className="panel">
                <div className="setting-icon">
                  <Instagram />
                </div>
                <h2>Instagram-koppeling</h2>
                <p>
                  Koppel je professionele account via Facebook Login for
                  Business. Je account moet verbonden zijn aan een
                  Facebook-pagina.
                </p>
                <span className="connection-label">
                  {connected ? "Gekoppeld" : "Nog niet gekoppeld"}
                </span>
                <Button
                  disabled={disabled}
                  onClick={() =>
                    void run(async () => {
                      const data = await api("oauthStart");
                      window.location.assign(data.url);
                    })
                  }
                >
                  <Instagram size={17} /> Instagram koppelen
                </Button>
                {connected && (
                  <Button
                    variant="outline"
                    disabled={disabled}
                    onClick={() =>
                      void run(async () => {
                        await api("disconnect");
                        await load();
                        setNotice(
                          "Lokale verbinding en opgeslagen token verwijderd. Trek desgewenst ook toegang in bij Meta.",
                        );
                      })
                    }
                  >
                    Ontkoppelen
                  </Button>
                )}
                <label>
                  Exacte Meta Redirect URI
                  <input
                    readOnly
                    value={
                      supabase
                        ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent?action=oauthCallback`
                        : "https://<PROJECT_REF>.supabase.co/functions/v1/agent?action=oauthCallback"
                    }
                  />
                </label>
                <small>
                  Voeg deze URI exact toe aan Valid OAuth Redirect URIs in je
                  Meta-app.
                </small>
              </section>
              <section className="panel">
                <h2>Jouw speelveld</h2>
                <p>Selecteer de categorieën die je wilt ontdekken.</p>
                {categories.map((c) => (
                  <label className="checkbox" key={c}>
                    <input
                      type="checkbox"
                      checked={enabled.includes(c)}
                      onChange={(e) =>
                        setEnabled(
                          e.target.checked
                            ? [...enabled, c]
                            : enabled.filter((x) => x !== c),
                        )
                      }
                    />
                    {c}
                  </label>
                ))}
                <Button
                  disabled={disabled}
                  onClick={() =>
                    void run(async () => {
                      await api("saveSettings", {
                        settings: { editor: settings, categories: enabled },
                      });
                      setNotice("Voorkeuren opgeslagen.");
                    })
                  }
                >
                  Instellingen opslaan
                </Button>
              </section>
              <section className="panel wide">
                <h2>Officieel, met een menselijke laatste stap.</h2>
                <p>
                  Hashtagdetectie is afhankelijk van Meta-permissies, app-review
                  en API-limieten. Een handmatige postlink geeft geen
                  automatische toegang tot privéposts of videobeelden.
                  Publiceren doe je zelf op Instagram; kopiëren telt nooit als
                  geplaatst.
                </p>
              </section>
            </div>
          )}
        </div>
        <footer>
          CREATEE COMMENT AGENT{" "}
          <span>Made for the game. Built for connection.</span>
        </footer>
      </main>
    </div>
  );
}
