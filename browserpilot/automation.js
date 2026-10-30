// Self-contained: Chrome injects this function into the user's Instagram tab.
// No credentials, private API endpoints, anti-detection or automatic retries.
export async function runApprovedComment(job) {
  let submitted = false;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const fail = (message) => ({
    status: submitted ? "uncertain" : "blocked",
    message,
  });
  try {
    const url = new URL(job.permalink);
    if (
      location.hostname !== "www.instagram.com" ||
      location.pathname.replace(/\/$/, "") !== url.pathname.replace(/\/$/, "")
    )
      return fail(
        "De geopende post komt niet overeen met het goedgekeurde bericht.",
      );
    const expected = job.username.toLowerCase();
    const accountMatches = () =>
      Array.from(document.querySelectorAll("a[href]")).some((a) => {
        let u;
        try {
          u = new URL(a.getAttribute("href"), location.origin);
        } catch {
          return false;
        }
        const profileLabel =
          /^(profile|profiel)$/i.test(a.textContent.trim()) ||
          (!!a.closest('nav,aside,[role="navigation"]') &&
            !!a.querySelector('img[alt*="profile"],img[alt*="profiel"]'));
        return (
          profileLabel &&
          u.origin === location.origin &&
          u.pathname.toLowerCase() === `/${expected}/`
        );
      });
    let article, textarea;
    for (let n = 0; n < 40; n++) {
      if (
        document.querySelector(
          'input[type="password"],input[name="verificationCode"]',
        )
      )
        return fail(
          "Log zelf in of rond de Instagram-controle af. De pilot doet dit niet.",
        );
      const candidates = Array.from(
        document.querySelectorAll("article form textarea"),
      ).filter((el) =>
        /comment|reactie/i.test(
          (el.getAttribute("aria-label") || "") +
            " " +
            (el.getAttribute("placeholder") || ""),
        ),
      );
      textarea = candidates.length === 1 ? candidates[0] : null;
      article = textarea?.closest("article");
      if (article && textarea && accountMatches()) break;
      await sleep(500);
    }
    if (!accountMatches())
      return fail(
        `Ik kan het ingelogde account @${job.username} niet betrouwbaar controleren. Er is niets geplaatst.`,
      );
    if (!article || !textarea)
      return fail(
        "Het reactieveld is niet betrouwbaar gevonden. Er is niets geplaatst.",
      );
    const observed = () =>
      Array.from(article.querySelectorAll('li,[role="listitem"]')).some(
        (item) => {
          const author = item.querySelector("a[href]");
          if (!author) return false;
          let authorUrl;
          try {
            authorUrl = new URL(author.getAttribute("href"), location.origin);
          } catch {
            return false;
          }
          return (
            authorUrl.origin === location.origin &&
            authorUrl.pathname.toLowerCase().replace(/\/$/, "") ===
              `/${expected}` &&
            Array.from(item.querySelectorAll("span,p")).some(
              (el) => el.textContent.trim() === job.text.trim(),
            )
          );
        },
      );
    if (observed())
      return {
        status: "already_present",
        message:
          "Deze exacte reactie is al zichtbaar bij jouw account. Er is niet opnieuw geplaatst.",
      };
    if (textarea.value.trim())
      return fail(
        "Er staat al tekst in het reactieveld. De pilot overschrijft die niet.",
      );
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    ).set;
    setter.call(textarea, job.text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(800);
    const form = textarea.closest("form");
    const button = Array.from(
      form.querySelectorAll('button[type="submit"]'),
    ).find((el) => /^(post|plaatsen|publiceren)$/i.test(el.textContent.trim()));
    if (
      !button ||
      button.disabled ||
      button.getAttribute("aria-disabled") === "true" ||
      !accountMatches() ||
      textarea.value !== job.text ||
      !textarea.isConnected ||
      !article.isConnected ||
      location.pathname.replace(/\/$/, "") !== url.pathname.replace(/\/$/, "")
    )
      return fail(
        "De plaatsknop of accountcontrole is niet betrouwbaar. Controleer het veld handmatig.",
      );
    submitted = true;
    button.click();
    for (let n = 0; n < 30; n++) {
      await sleep(500);
      if (observed() && textarea.value === "")
        return {
          status: "observed",
          message:
            "De nieuwe reactie is in de browser waargenomen bij jouw account. Controleer de post en markeer hem daarna in CREATEE als geplaatst.",
        };
    }
    return fail(
      "Er is één keer op plaatsen geklikt, maar het resultaat kon niet worden bevestigd. Controleer Instagram zelf; probeer niet automatisch opnieuw.",
    );
  } catch {
    return fail(
      "De Instagram-interface reageert anders dan verwacht. Controleer de post handmatig.",
    );
  }
}
