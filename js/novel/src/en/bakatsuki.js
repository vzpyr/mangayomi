const mangayomiSources = [
  {
    name: "Baka-Tsuki",
    id: 617294021,
    baseUrl: "https://www.baka-tsuki.org",
    lang: "en",
    typeSource: "single",
    iconUrl: "https://www.baka-tsuki.org/favicon.ico",
    dateFormat: "",
    dateFormatLocale: "",
    isNsfw: false,
    hasCloudflare: false,
    sourceCodeUrl:
      "https://raw.githubusercontent.com/vzpyr/mangayomi/main/js/novel/src/en/bakatsuki.js",
    apiUrl: "https://www.baka-tsuki.org/project/api.php",
    version: "1.0.1",
    isManga: false,
    itemType: 2,
    isFullData: false,
    appMinVerReq: "0.6.1",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes: "Classic community light novel translations",
    pkgPath: "novel/src/en/bakatsuki.js",
  },
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.defaultBaseUrl = "https://www.baka-tsuki.org";
  }

  getBaseUrl() {
    try {
      const pref = new SharedPreferences().get("bakatsuki_pref_domain");
      if (pref && typeof pref === "string" && pref.trim().length > 0) {
        return pref.trim().replace(/\/+$/, "");
      }
    } catch (_) {}
    if (this.source && this.source.baseUrl) {
      return this.source.baseUrl.replace(/\/+$/, "");
    }
    return this.defaultBaseUrl;
  }

  getHeaders(url) {
    const base = this.getBaseUrl();
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: `${base}/`,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
    };
  }

  cleanText(str) {
    if (!str) return "";
    return str
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\[edit\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  formatImageUrl(src) {
    if (!src) return "";
    const base = this.getBaseUrl();
    const cleanSrc = src.replace(/&amp;/g, "&");
    if (cleanSrc.startsWith("http")) return cleanSrc;
    if (cleanSrc.startsWith("//")) return `https:${cleanSrc}`;
    return `${base}${cleanSrc.startsWith("/") ? "" : "/"}${cleanSrc}`;
  }

  async getPopular(page) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();
    const offset = (p - 1) * 30;
    let url = `${base}/project/api.php?action=query&list=categorymembers&cmtitle=Category:Light_novel_(English)&cmlimit=30&cmtype=page&format=json`;

    if (offset > 0) {
      url += `&cmoffset=${offset}`;
    }

    const res = await this.client.get(url, this.getHeaders(url));
    const list = [];
    let hasNextPage = false;

    if (res && res.statusCode === 200 && res.body) {
      try {
        const data = JSON.parse(res.body);
        const members = data.query?.categorymembers || [];

        for (const item of members) {
          const title = item.title || "";
          if (
            title.startsWith("Category:") ||
            title.startsWith("Template:") ||
            title.startsWith("User:")
          ) {
            continue;
          }

          const link = `/project/index.php?title=${encodeURIComponent(title.replace(/ /g, "_"))}`;
          list.push({ name: title, imageUrl: "", link });
        }
        hasNextPage = Boolean(data.continue || members.length >= 30);
      } catch (_) {}
    }

    return { list, hasNextPage };
  }

  async getLatestUpdates(page) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();
    const url = `${base}/project/api.php?action=query&list=recentchanges&rcnamespace=0&rctype=edit|new&rclimit=30&format=json`;

    const res = await this.client.get(url, this.getHeaders(url));
    const list = [];
    const seen = new Set();

    if (res && res.statusCode === 200 && res.body) {
      try {
        const data = JSON.parse(res.body);
        const rc = data.query?.recentchanges || [];

        for (const item of rc) {
          const rawTitle = item.title || "";
          const mainTitle = rawTitle.split(":")[0].trim();

          if (mainTitle && !seen.has(mainTitle)) {
            seen.add(mainTitle);
            const link = `/project/index.php?title=${encodeURIComponent(mainTitle.replace(/ /g, "_"))}`;
            list.push({ name: mainTitle, imageUrl: "", link });
          }
        }
      } catch (_) {}
    }

    return { list, hasNextPage: list.length >= 10 };
  }

  async search(query, page, filters) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();
    const list = [];
    let hasNextPage = false;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return await this.getPopular(p);
    }

    const q = query.trim();
    const offset = (p - 1) * 25;
    const url = `${base}/project/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srnamespace=0&srlimit=25&sroffset=${offset}&format=json`;

    const res = await this.client.get(url, this.getHeaders(url));

    if (res && res.statusCode === 200 && res.body) {
      try {
        const data = JSON.parse(res.body);
        const searchItems = data.query?.search || [];
        const seen = new Set();

        for (const item of searchItems) {
          const title = item.title || "";
          const mainTitle = title.split(":")[0].trim();

          if (mainTitle && !seen.has(mainTitle)) {
            seen.add(mainTitle);
            const link = `/project/index.php?title=${encodeURIComponent(mainTitle.replace(/ /g, "_"))}`;
            list.push({ name: mainTitle, imageUrl: "", link });
          }
        }
        hasNextPage = Boolean(data.continue || searchItems.length >= 25);
      } catch (_) {}
    }

    return { list, hasNextPage };
  }

  async getDetail(url) {
    let path =
      typeof url === "object" && url !== null ? url.url || url.link || "" : url;
    if (typeof path === "string") {
      path = path.replace(/https?:\/\/[^\/]+/, "").trim();
    }
    if (!path.startsWith("/")) path = `/${path}`;

    const base = this.getBaseUrl();
    const detailUrl = `${base}${path}`;
    const res = await this.client.get(detailUrl, this.getHeaders(detailUrl));
    if (!res || !res.body) {
      throw new Error(`Failed to load details for ${path}`);
    }

    const html = res.body;

    const titleMatch =
      html.match(/<h1[^>]*id=["']firstHeading["'][^>]*>([\s\S]*?)<\/h1>/i) ||
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const name = titleMatch ? this.cleanText(titleMatch[1]) : "Light Novel";

    const imgMatch =
      html.match(
        /<div[^>]*class=["'][^"']*thumbinner[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<img[^>]+src=["']([^"']*(?:thumb\.php|\/images\/)[^"']*)["']/i,
      ) ||
      html.match(/<img[^>]+src=["']([^"']+\.(?:jpg|png|jpeg|webp)[^"']*)["']/i);
    const imageUrl = imgMatch ? this.formatImageUrl(imgMatch[1]) : "";

    const descMatch =
      html.match(
        /<h2[^>]*>[\s\S]*?Story\s*Synopsis[\s\S]*?<\/h2>([\s\S]*?)(?:<h2|<div\s+id=["']toc["'])/i,
      ) ||
      html.match(
        /<h2[^>]*>[\s\S]*?Synopsis[\s\S]*?<\/h2>([\s\S]*?)(?:<h2|<div\s+id=["']toc["'])/i,
      ) ||
      html.match(/<p>([\s\S]*?)<\/p>/i);
    const description = descMatch ? this.cleanText(descMatch[1]) : "";

    let author = "";
    const authorMatch =
      html.match(/(?:Author|Writer)[:\s]*<b>([\s\S]*?)<\/b>/i) ||
      html.match(/(?:Author|Writer)[:\s]*<a[^>]*>([\s\S]*?)<\/a>/i) ||
      html.match(/<li>(?:Author|Writer)[:\s]*([^\n<]+)<\/li>/i) ||
      html.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)'s personal blog/i) ||
      html.match(/Author[:\s]*([^\n<]+)/i);

    if (authorMatch) {
      author = this.cleanText(authorMatch[1] || authorMatch[0])
        .replace(/\s*\(Author.*\)$/i, "")
        .trim();
    }

    let artist = "";
    const artistMatch =
      html.match(/Illustrator[:\s]*<b>([\s\S]*?)<\/b>/i) ||
      html.match(/Illustrator[:\s]*<a[^>]*>([\s\S]*?)<\/a>/i) ||
      html.match(/Illustrator[:\s]*([^\n<]+)/i);
    if (artistMatch) {
      artist = this.cleanText(artistMatch[1]);
    }

    const genres = ["Light Novel", "Japanese"];
    const genreMatch = html.match(/Genre[:\s]*([^\n<]+)/i);
    if (genreMatch) {
      for (const g of genreMatch[1].split(/[,/]/)) {
        const cleanG = this.cleanText(g);
        if (cleanG && !genres.includes(cleanG)) {
          genres.push(cleanG);
        }
      }
    }

    const chapters = [];
    const seenChapters = new Set();
    const rawNovelName = name.replace(/ /g, "_");
    const linkRegex =
      /<a[^>]+href=["']([^"']*\/project\/index\.php\?title=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let chMatch;

    while ((chMatch = linkRegex.exec(html)) !== null) {
      const chHref = chMatch[1];
      const chText = this.cleanText(chMatch[2]);

      const isChapterLink =
        chHref.includes(`${encodeURIComponent(rawNovelName)}:`) ||
        chHref.includes(`${rawNovelName}:`) ||
        chHref.includes("Volume_") ||
        chHref.includes("Chapter_") ||
        chHref.includes("Prologue") ||
        chHref.includes("Epilogue") ||
        chHref.includes("Afterword");

      const isExcluded =
        chHref.includes("action=edit") ||
        chHref.includes("action=history") ||
        chHref.includes("Special:") ||
        chHref.includes("User:") ||
        chHref.includes("Registration_Page") ||
        chHref.includes("Tasklist") ||
        chHref.includes("Guidelines") ||
        chHref.includes("&oldid=");

      if (
        isChapterLink &&
        !isExcluded &&
        !seenChapters.has(chHref) &&
        chText.length > 0
      ) {
        seenChapters.add(chHref);

        let cleanChHref = chHref;
        if (cleanChHref.startsWith("http")) {
          try {
            const urlObj = new URL(cleanChHref);
            cleanChHref = urlObj.pathname + urlObj.search;
          } catch (_) {}
        }

        chapters.push({
          name: chText,
          url: cleanChHref,
          dateUpload: null,
          scanlator: "Baka-Tsuki Community",
        });
      }
    }

    if (chapters.length === 0) {
      chapters.push({
        name: "Full Story",
        url: path,
        dateUpload: null,
        scanlator: "Baka-Tsuki",
      });
    }

    return {
      name,
      imageUrl,
      link: detailUrl,
      description,
      author,
      artist,
      genre: genres,
      status: 1,
      chapters,
    };
  }

  async getHtmlContent(name, url) {
    let path =
      typeof url === "object" && url !== null ? url.url || url.link || "" : url;
    if (typeof path === "string") {
      path = path.replace(/https?:\/\/[^\/]+/, "").trim();
    }
    if (!path.startsWith("/")) path = `/${path}`;

    const base = this.getBaseUrl();
    const fullUrl = `${base}${path}`;
    const res = await this.client.get(fullUrl, this.getHeaders(fullUrl));
    if (!res || !res.body) {
      throw new Error(`Failed to load chapter content for ${path}`);
    }

    const html = res.body;
    const contentMatch =
      html.match(
        /<div[^>]+class=["'][^"']*mw-parser-output[^"']*["'][^>]*>([\s\S]*?)<!--\s*\/mw-parser-output\s*-->/i,
      ) ||
      html.match(
        /<div[^>]+id=["']mw-content-text["'][^>]*>([\s\S]*?)<div[^>]+id=["']catlinks["']/i,
      ) ||
      html.match(/<div[^>]+id=["']mw-content-text["'][^>]*>([\s\S]*?)<\/div>/i);

    return contentMatch
      ? contentMatch[1] || contentMatch[0]
      : "<div class='chapter-content'><p>Content could not be parsed.</p></div>";
  }

  async cleanHtmlContent(html) {
    if (!html) return "";
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(
        /<div[^>]*class=["'][^"']*(?:toc|mw-editsection|navbox|infobox)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
        "",
      )
      .replace(
        /<span[^>]*class=["'][^"']*mw-editsection[^"']*["'][^>]*>[\s\S]*?<\/span>/gi,
        "",
      )
      .replace(/<div[^>]*id=["']catlinks["'][^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<table[\s\S]*?<\/table>/gi, "")
      .trim();
  }

  getFilterList() {
    return [
      {
        type_name: "SelectFilter",
        name: "Category",
        state: 0,
        values: [
          {
            type_name: "SelectOption",
            name: "Light Novel (English)",
            value: "Category:Light_novel_(English)",
          },
          {
            type_name: "SelectOption",
            name: "Teasers (English)",
            value: "Category:Teaser_(English)",
          },
          {
            type_name: "SelectOption",
            name: "Original Novels",
            value: "Category:Original_novel_(English)",
          },
        ],
      },
    ];
  }

  getSourcePreferences() {
    return [
      {
        key: "bakatsuki_pref_domain",
        listPreference: {
          title: "Override Base URL Domain",
          summary: "Set custom domain mirror for Baka-Tsuki",
          valueIndex: 0,
          entries: ["baka-tsuki.org (Default)"],
          entryValues: ["https://www.baka-tsuki.org"],
        },
      },
    ];
  }
}

if (typeof extention === "undefined") {
  var extention = new DefaultExtension();
}
if (typeof extension === "undefined") {
  var extension = extention;
}
