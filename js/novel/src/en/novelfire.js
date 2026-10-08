const mangayomiSources = [
  {
    name: "NovelFire",
    id: 923847119,
    baseUrl: "https://novelfire.net",
    lang: "en",
    typeSource: "single",
    iconUrl: "https://novelfire.net/favicon.ico",
    dateFormat: "",
    dateFormatLocale: "",
    isNsfw: false,
    hasCloudflare: true,
    sourceCodeUrl:
      "https://raw.githubusercontent.com/vzpyr/mangayomi/main/js/novel/src/en/novelfire.js",
    apiUrl: "",
    version: "1.0.1",
    isManga: false,
    itemType: 2,
    isFullData: false,
    appMinVerReq: "0.6.1",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes: "",
    pkgPath: "novel/src/en/novelfire.js",
  },
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.defaultBaseUrl = "https://novelfire.net";
  }

  getBaseUrl() {
    try {
      const pref = new SharedPreferences().get("novelfire_pref_domain");
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
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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
      .replace(/\s+/g, " ")
      .trim();
  }

  parseNovelsFromHtml(html) {
    const list = [];
    if (!html) return { list, hasNextPage: false };

    const itemRegex =
      /<li[^>]*class=["'][^"']*novel-item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    const base = this.getBaseUrl();

    while ((match = itemRegex.exec(html)) !== null) {
      const itemHtml = match[1];

      const titleMatch =
        itemHtml.match(
          /<h[2-4][^>]*class=["'][^"']*novel-title[^"']*["'][^>]*>([\s\S]*?)<\/h[2-4]>/i,
        ) || itemHtml.match(/<a[^>]+title=["']([^"']+)["']/i);
      const title = titleMatch ? this.cleanText(titleMatch[1]) : "";

      const linkMatch = itemHtml.match(/<a[^>]+href=["']([^"']+)["']/i);
      let link = linkMatch ? linkMatch[1] : "";
      if (link.startsWith("http")) {
        try {
          link = new URL(link).pathname;
        } catch (_) {}
      }

      const imgMatch =
        itemHtml.match(/<img[^>]+data-src=["']([^"']+)["']/i) ||
        itemHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
      let imageUrl = imgMatch ? imgMatch[1] : "";
      if (imageUrl && !imageUrl.startsWith("http")) {
        imageUrl = `${base}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
      }

      if (title && link) {
        list.push({ name: title, imageUrl, link });
      }
    }

    const hasNextPage =
      html.includes('rel="next"') ||
      html.includes('aria-label="Next"') ||
      html.includes('class="next"') ||
      list.length >= 18;

    return { list, hasNextPage };
  }

  async getPopular(page) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();
    const url = `${base}/genre-all/sort-popular/status-all/all-novel?page=${p}`;
    const res = await this.client.get(url, this.getHeaders(url));
    return this.parseNovelsFromHtml(res ? res.body : "");
  }

  async getLatestUpdates(page) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();
    const url = `${base}/latest-release-novels?page=${p}`;
    const res = await this.client.get(url, this.getHeaders(url));
    return this.parseNovelsFromHtml(res ? res.body : "");
  }

  async search(query, page, filters) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();

    if (query && typeof query === "string" && query.trim().length > 0) {
      const searchUrl = `${base}/search?keyword=${encodeURIComponent(query.trim())}&type=both&page=${p}`;
      const res = await this.client.get(searchUrl, this.getHeaders(searchUrl));
      return this.parseNovelsFromHtml(res ? res.body : "");
    }

    let genre = "all";
    let sort = "popular";
    let status = "all";

    if (Array.isArray(filters)) {
      for (const f of filters) {
        if (!f || !f.values || !f.values[f.state]) continue;
        if (f.name === "Sort") sort = f.values[f.state].value || sort;
        if (f.name === "Status") status = f.values[f.state].value || status;
        if (f.name === "Genre") genre = f.values[f.state].value || genre;
      }
    }

    const filterUrl = `${base}/genre-${genre}/sort-${sort}/status-${status}/all-novel?page=${p}`;
    const res = await this.client.get(filterUrl, this.getHeaders(filterUrl));
    return this.parseNovelsFromHtml(res ? res.body : "");
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
      html.match(
        /<h1[^>]*class=["'][^"']*novel-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i,
      ) ||
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
      html.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      );
    const name = titleMatch ? this.cleanText(titleMatch[1]) : "Novel";

    const imgMatch =
      html.match(
        /<figure[^>]*class=["'][^"']*cover[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<img[^>]+class=["'][^"']*novel-cover[^"']*["'][^>]+src=["']([^"']+)["']/i,
      );
    let imageUrl = imgMatch ? imgMatch[1] : "";
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = `${base}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
    }

    const descMatch =
      html.match(
        /<meta[^>]+itemprop=["']description["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<div[^>]+class=["'][^"']*summary[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      );
    const description = descMatch ? this.cleanText(descMatch[1]) : "";

    const authorMatch =
      html.match(
        /<span[^>]+itemprop=["']author["'][^>]*>([\s\S]*?)<\/span>/i,
      ) ||
      html.match(
        /<a[^>]+href=["'][^"']*\/author\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
      ) ||
      html.match(/author[:\s]*<span[^>]*>([\s\S]*?)<\/span>/i);
    const author = authorMatch ? this.cleanText(authorMatch[1]) : "";

    const genres = [];
    const kwMatch = html.match(
      /<meta[^>]+itemprop=["']keywords["'][^>]+content=["']([^"']+)["']/i,
    );
    if (kwMatch && kwMatch[1]) {
      for (const g of kwMatch[1].split(",")) {
        const trimmed = g.trim();
        if (
          trimmed &&
          trimmed.toLowerCase() !== "novel" &&
          trimmed.toLowerCase() !== "webnovel" &&
          !genres.includes(trimmed)
        ) {
          genres.push(trimmed);
        }
      }
    }

    const status =
      html.includes("Completed") || html.includes("completed") ? 1 : 0;

    const chapters = [];
    const chaptersBaseUrl = `${detailUrl.replace(/\/+$/, "")}/chapters`;
    const firstPageRes = await this.client.get(
      `${chaptersBaseUrl}?page=1`,
      this.getHeaders(chaptersBaseUrl),
    );

    if (firstPageRes && firstPageRes.body) {
      const firstHtml = firstPageRes.body;
      const parseChaptersFromHtml = (pageHtml) => {
        const chRegex =
          /<a[^>]+href=["']([^"']*\/chapter-[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let chMatch;
        while ((chMatch = chRegex.exec(pageHtml)) !== null) {
          let chUrl = chMatch[1];
          const chTitle = this.cleanText(chMatch[2]);
          if (chUrl.startsWith("http")) {
            try {
              chUrl = new URL(chUrl).pathname;
            } catch (_) {}
          }
          if (chTitle && chUrl) {
            chapters.push({
              name: chTitle,
              url: chUrl,
              dateUpload: null,
              scanlator: "",
            });
          }
        }
      };

      parseChaptersFromHtml(firstHtml);

      const pageNums = [...firstHtml.matchAll(/page=(\d+)/g)].map((m) =>
        parseInt(m[1]),
      );
      const lastPage = pageNums.length
        ? Math.min(Math.max(...pageNums), 40)
        : 1;

      if (lastPage > 1) {
        const remainingPages = [];
        for (let p = 2; p <= lastPage; p++) {
          remainingPages.push(p);
        }

        const batchSize = 5;
        for (let i = 0; i < remainingPages.length; i += batchSize) {
          const batch = remainingPages.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map((p) =>
              this.client
                .get(
                  `${chaptersBaseUrl}?page=${p}`,
                  this.getHeaders(chaptersBaseUrl),
                )
                .catch(() => null),
            ),
          );
          for (const res of results) {
            if (res && res.body) {
              parseChaptersFromHtml(res.body);
            }
          }
        }
      }
    }

    if (chapters.length === 0) {
      chapters.push({
        name: "Chapter 1",
        url: `${path.replace(/\/+$/, "")}/chapter-1`,
        dateUpload: null,
        scanlator: "",
      });
    }

    return {
      name,
      imageUrl,
      link: detailUrl,
      description,
      author,
      artist: "",
      genre: genres,
      status,
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
      html.match(/<div[^>]+id=["']content["'][^>]*>([\s\S]*?)<\/div>/i) ||
      html.match(
        /<div[^>]+class=["'][^"']*chapter-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      ) ||
      html.match(
        /<div[^>]+class=["'][^"']*entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      );

    return contentMatch
      ? contentMatch[0]
      : "<div class='chapter-content'><p>Content could not be parsed.</p></div>";
  }

  async cleanHtmlContent(html) {
    if (!html) return "";
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(
        /<div[^>]*class=["'][^"']*(?:ads|advertisement|banner)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
        "",
      )
      .replace(
        /<p[^>]*>[\s\S]*?(?:Translator:|Editor:|Read at novel|novelfire)[\s\S]*?<\/p>/gi,
        "",
      )
      .trim();
  }

  getFilterList() {
    return [
      {
        type_name: "SelectFilter",
        name: "Sort",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "Popular", value: "popular" },
          { type_name: "SelectOption", name: "Latest", value: "latest" },
          { type_name: "SelectOption", name: "Rating", value: "rating" },
          { type_name: "SelectOption", name: "Completed", value: "completed" },
          { type_name: "SelectOption", name: "Total Views", value: "views" },
        ],
      },
      {
        type_name: "SelectFilter",
        name: "Status",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "All Status", value: "all" },
          { type_name: "SelectOption", name: "Ongoing", value: "ongoing" },
          { type_name: "SelectOption", name: "Completed", value: "completed" },
        ],
      },
      {
        type_name: "SelectFilter",
        name: "Genre",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "All Genres", value: "all" },
          { type_name: "SelectOption", name: "Action", value: "action" },
          { type_name: "SelectOption", name: "Adventure", value: "adventure" },
          { type_name: "Fantasy", name: "Fantasy", value: "fantasy" },
          { type_name: "SelectOption", name: "Isekai", value: "isekai" },
          { type_name: "SelectOption", name: "Romance", value: "romance" },
          { type_name: "SelectOption", name: "Sci-fi", value: "sci-fi" },
          { type_name: "SelectOption", name: "Shounen", value: "shounen" },
          {
            type_name: "SelectOption",
            name: "Supernatural",
            value: "supernatural",
          },
          { type_name: "SelectOption", name: "Mystery", value: "mystery" },
          { type_name: "SelectOption", name: "Urban", value: "urban" },
          { type_name: "SelectOption", name: "Mature", value: "mature" },
        ],
      },
    ];
  }

  getSourcePreferences() {
    return [
      {
        key: "novelfire_pref_domain",
        listPreference: {
          title: "Override Base URL Domain",
          summary: "Select mirror domain in case of network restrictions",
          valueIndex: 0,
          entries: ["novelfire.net (Default)"],
          entryValues: ["https://novelfire.net"],
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
