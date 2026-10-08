const mangayomiSources = [
  {
    name: "Anna's Archive",
    id: 819274810,
    baseUrl: "https://annas-archive.gl",
    lang: "all",
    typeSource: "single",
    iconUrl: "https://annas-archive.gl/favicon.ico",
    dateFormat: "",
    dateFormatLocale: "",
    isNsfw: false,
    hasCloudflare: true,
    sourceCodeUrl:
      "https://raw.githubusercontent.com/vzpyr/mangayomi/main/js/novel/src/all/annasarchive.js",
    apiUrl: "",
    version: "1.0.1",
    isManga: false,
    itemType: 2,
    isFullData: false,
    appMinVerReq: "0.6.1",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes: "",
    pkgPath: "novel/src/all/annasarchive.js",
  },
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.defaultBaseUrl = "https://annas-archive.gl";
  }

  getBaseUrl() {
    try {
      const pref = new SharedPreferences().get("annas_pref_domain");
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
      Priority: "u=0, i",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: `${base}/`,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
  }

  cleanText(str) {
    if (!str) return "";
    return str
      .replace(/<[^>]+>/g, "")
      .replace(/🔍/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  parseNovelListFromHtml(html) {
    const list = [];
    if (!html) return { list, hasNextPage: false };

    const map = new Map();
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const inner = match[2];

      if (href.includes("/books/") || href.includes("/md5/")) {
        let linkPath = href;
        if (linkPath.startsWith("http")) {
          try {
            const urlObj = new URL(linkPath);
            linkPath = `${urlObj.pathname}${urlObj.search}`;
          } catch (_) {}
        }

        if (!map.has(linkPath)) {
          map.set(linkPath, { name: "", imageUrl: "", link: linkPath });
        }

        const current = map.get(linkPath);
        const textContent = this.cleanText(inner);
        if (textContent && !current.name && textContent.length > 1) {
          current.name = textContent;
        }

        const imgMatch = inner.match(
          /<img[^>]+(?:data-src|src)=["']([^"']+)["']/i,
        );
        const altMatch = inner.match(/<img[^>]+alt=["']([^"']+)["']/i);

        if (imgMatch && imgMatch[1] && !current.imageUrl) {
          current.imageUrl = imgMatch[1];
        }
        if (altMatch && altMatch[1] && !current.name) {
          current.name = this.cleanText(altMatch[1]);
        }
      }
    }

    for (const item of map.values()) {
      if (item.name || item.imageUrl) {
        if (!item.name) {
          const slugParts = item.link.split("-");
          slugParts.shift();
          item.name = slugParts.join(" ").replace(/_/g, " ") || "Book";
        }
        list.push(item);
      }
    }

    const hasNextPage =
      html.includes('rel="next"') ||
      html.includes("page=") ||
      list.length >= 10;
    return { list, hasNextPage };
  }

  async getPopular(page) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();
    const lang =
      this.source && this.source.lang && this.source.lang !== "all"
        ? `&lang=${this.source.lang}`
        : "";
    const url = `${base}/search?index=&page=${p}&q=&display=&ext=epub&src=lgli&sort=${lang}`;
    const res = await this.client.get(url, this.getHeaders(url));
    return this.parseNovelListFromHtml(res ? res.body : "");
  }

  async getLatestUpdates(page) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();
    const lang =
      this.source && this.source.lang && this.source.lang !== "all"
        ? `&lang=${this.source.lang}`
        : "";
    const url = `${base}/search?index=&page=${p}&q=&display=&ext=epub&src=lgli&sort=newest${lang}`;
    const res = await this.client.get(url, this.getHeaders(url));
    return this.parseNovelListFromHtml(res ? res.body : "");
  }

  async search(query, page, filters) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();
    const q = query ? encodeURIComponent(query.trim()) : "";
    let ext = "epub";
    let sort = "";
    let src = "lgli";
    const lang =
      this.source && this.source.lang && this.source.lang !== "all"
        ? `&lang=${this.source.lang}`
        : "";

    if (Array.isArray(filters)) {
      for (const f of filters) {
        if (!f || !f.values || !f.values[f.state]) continue;
        if (f.name === "File Format") ext = f.values[f.state].value || ext;
        if (f.name === "Sort") sort = f.values[f.state].value || sort;
        if (f.name === "Source Catalog") src = f.values[f.state].value || src;
      }
    }

    const url = `${base}/search?index=&page=${p}&q=${q}&display=&ext=${ext}&src=${src}&sort=${sort}${lang}`;
    const res = await this.client.get(url, this.getHeaders(url));
    return this.parseNovelListFromHtml(res ? res.body : "");
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

    const titleTagMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    let name = "";
    if (titleTagMatch) {
      name = this.cleanText(titleTagMatch[1])
        .replace(/\s*\|\s*Anna'?s Archive.*$/i, "")
        .trim();
    }
    if (!name || name.toLowerCase() === "anna's archive") {
      const nameMatch =
        html.match(
          /<div[^>]+class=["'][^"']*text-(?:2xl|3xl|4xl)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
        ) ||
        html.match(
          /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        );
      if (nameMatch) {
        name = this.cleanText(nameMatch[1]);
      }
    }
    if (!name || name.toLowerCase() === "anna's archive") {
      name = "Novel";
    }

    const imgMatch =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<img[^>]+class=["'][^"']*cover[^"']*["'][^>]+src=["']([^"']+)["']/i,
      ) ||
      html.match(/<img[^>]+src=["']([^"']+)["']/i);
    let imageUrl = imgMatch ? imgMatch[1] : "";
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = `${base}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
    }

    const descMatch =
      html.match(
        /<div[^>]+class=["'][^"']*mb-1[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      ) ||
      html.match(
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      );
    const description = descMatch
      ? this.cleanText(descMatch[1])
          .replace(/^description/i, "")
          .trim()
      : "";

    const authorMatch =
      html.match(
        /<div[^>]+class=["'][^"']*italic[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      ) ||
      html.match(
        /<span[^>]+class=["'][^"']*author[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
      );
    const author = authorMatch ? this.cleanText(authorMatch[1]) : "";

    const genres = [];
    const extMatch = html.match(/file\s*format[:\s]*([a-zA-Z0-9]+)/i);
    if (extMatch) genres.push(extMatch[1].toUpperCase());
    const langMatch = html.match(/language[:\s]*([a-zA-Z]+)/i);
    if (langMatch) genres.push(langMatch[1]);

    let mirrorLink = "";
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let lMatch;

    while ((lMatch = linkRegex.exec(html)) !== null) {
      const lHref = lMatch[1];
      if (
        lHref.includes("libgen.is") ||
        lHref.includes("libgen.li") ||
        lHref.includes("libgen.rs") ||
        lHref.includes("books.ms") ||
        lHref.includes("ipfs") ||
        lHref.includes("/slow_download/") ||
        lHref.includes("/fast_download/")
      ) {
        mirrorLink = lHref;
        break;
      }
    }

    const chapters = [
      {
        name: "Full Book",
        url: mirrorLink || path,
        dateUpload: String(Date.now()),
        scanlator: null,
      },
    ];

    return {
      name,
      imageUrl,
      link: `${base}${path}`,
      description,
      author,
      artist: "",
      genre: genres,
      status: 1,
      chapters,
    };
  }

  async getHtmlContent(name, url) {
    const base = this.getBaseUrl();
    const fullUrl = url.startsWith("http")
      ? url
      : `${base}${url.startsWith("/") ? "" : "/"}${url}`;
    const res = await this.client.get(fullUrl, this.getHeaders(fullUrl));
    if (res && res.body) {
      return `<div class='novel-content'>${res.body}</div>`;
    }
    return "<div class='novel-content'><p>Content could not be loaded.</p></div>";
  }

  async cleanHtmlContent(html) {
    if (!html) return "";
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .trim();
  }

  getFilterList() {
    return [
      {
        type_name: "SelectFilter",
        name: "File Format",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "EPUB", value: "epub" },
          { type_name: "SelectOption", name: "PDF", value: "pdf" },
          { type_name: "SelectOption", name: "MOBI", value: "mobi" },
          { type_name: "SelectOption", name: "AZW3", value: "azw3" },
          { type_name: "SelectOption", name: "CBR", value: "cbr" },
          { type_name: "SelectOption", name: "CBZ", value: "cbz" },
        ],
      },
      {
        type_name: "SortFilter",
        name: "Sort",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "Most Relevant", value: "" },
          { type_name: "SelectOption", name: "Newest", value: "newest" },
          { type_name: "SelectOption", name: "Oldest", value: "oldest" },
          { type_name: "SelectOption", name: "Largest", value: "largest" },
          { type_name: "SelectOption", name: "Smallest", value: "smallest" },
        ],
      },
      {
        type_name: "SelectFilter",
        name: "Source Catalog",
        state: 0,
        values: [
          {
            type_name: "SelectOption",
            name: "Libgen.li (Recommended)",
            value: "lgli",
          },
          { type_name: "SelectOption", name: "Libgen.rs", value: "lgrs" },
          { type_name: "SelectOption", name: "Z-Library", value: "zlib" },
          { type_name: "SelectOption", name: "All Sources", value: "" },
        ],
      },
    ];
  }

  getSourcePreferences() {
    return [
      {
        key: "annas_pref_domain",
        listPreference: {
          title: "Override Base URL Mirror",
          summary: "Select mirror domain in case of ISP blocks or downtime",
          valueIndex: 0,
          entries: [
            "annas-archive.gl (Default)",
            "annas-archive.li",
            "annas-archive.se",
            "annas-archive.pk",
          ],
          entryValues: [
            "https://annas-archive.gl",
            "https://annas-archive.li",
            "https://annas-archive.se",
            "https://annas-archive.pk",
          ],
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
