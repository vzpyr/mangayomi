const mangayomiSources = [
  {
    name: "Comick",
    langs: [
      "all",
      "en",
      "pt-br",
      "ru",
      "fr",
      "es-419",
      "pl",
      "tr",
      "it",
      "es",
      "id",
      "hu",
      "vi",
      "zh-hk",
      "ar",
      "de",
      "zh",
      "ca",
      "bg",
      "th",
      "fa",
      "uk",
      "mn",
      "ro",
      "he",
      "ms",
      "tl",
      "ja",
      "hi",
      "my",
      "ko",
      "cs",
      "pt",
      "nl",
      "sv",
      "bn",
      "no",
      "lt",
      "el",
      "sr",
      "da",
    ],
    ids: {
      all: 370890607,
      en: 955190069,
      "pt-br": 494197461,
      ru: 1050814052,
      fr: 380505196,
      "es-419": 296390197,
      pl: 242913014,
      tr: 507059585,
      it: 851891714,
      es: 115169439,
      id: 719269008,
      hu: 719759654,
      vi: 301477894,
      "zh-hk": 113594984,
      ar: 602472856,
      de: 401493183,
      zh: 752155292,
      ca: 1069764002,
      bg: 678531099,
      th: 311480598,
      fa: 141560456,
      uk: 8261465,
      mn: 565474938,
      ro: 533803532,
      he: 459976450,
      ms: 375702775,
      tl: 737984097,
      ja: 796489006,
      hi: 683471552,
      my: 778623467,
      ko: 1065236294,
      cs: 422767524,
      pt: 678647945,
      nl: 698202010,
      sv: 359879447,
      bn: 532878423,
      no: 481504622,
      lt: 112887841,
      el: 824905526,
      sr: 373675453,
      da: 574420905,
    },
    baseUrl: "https://comick.art",
    apiUrl: "https://comick.art",
    iconUrl: "https://comick.art/favicon.ico",
    dateFormat: "",
    dateFormatLocale: "",
    isNsfw: false,
    hasCloudflare: false,
    sourceCodeUrl:
      "https://raw.githubusercontent.com/vzpyr/mangayomi/main/js/manga/src/all/comick.js",
    typeSource: "single",
    itemType: 0,
    isManga: true,
    version: "1.0.1",
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes: "",
    pkgPath: "manga/src/all/comick.js",
  },
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.defaultBaseUrl = "https://comick.art";
  }

  getBaseUrl() {
    try {
      const pref = new SharedPreferences().get("comick_pref_domain");
      if (pref && typeof pref === "string" && pref.trim().length > 0) {
        return pref.trim().replace(/\/+$/, "");
      }
    } catch (_) {}
    if (this.source && this.source.baseUrl) {
      return this.source.baseUrl.replace(/\/+$/, "");
    }
    return this.defaultBaseUrl;
  }

  getHeaders() {
    const base = this.getBaseUrl();
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: `${base}/`,
      Accept: "application/json, text/html, */*",
    };
  }

  cleanHtml(str) {
    if (!str) return "";
    return str
      .replace(/<br\s*[\/]?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  formatComicItem(item) {
    const title = item.title || item.slug || "";
    const imageUrl =
      item.default_thumbnail ||
      item.thumbnail ||
      item.cover_url ||
      (item.md_covers && item.md_covers[0] && item.md_covers[0].b2key
        ? `https://cdn1.comicknew.pictures/${item.md_covers[0].b2key}`
        : "");
    const link = item.slug || item.hid || "";
    return { name: title, imageUrl, link };
  }

  async getPopular(page) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();
    const url = `${base}/api/search?page=${p}&order_by=user_follow_count&order_direction=desc&type=comic`;
    const res = await this.client.get(url, this.getHeaders());
    const list = [];
    let hasNextPage = false;

    if (res && res.statusCode === 200 && res.body) {
      const data = JSON.parse(res.body);
      const items = data.data || data || [];
      for (const item of items) {
        list.push(this.formatComicItem(item));
      }
      hasNextPage = Boolean(data.next_cursor || items.length >= 20);
    }

    return { list, hasNextPage };
  }

  async getLatestUpdates(page) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();
    const url = `${base}/api/chapters/latest?order=new&page=${p}`;
    const res = await this.client.get(url, this.getHeaders());
    const list = [];
    let hasNextPage = false;

    if (res && res.statusCode === 200 && res.body) {
      const data = JSON.parse(res.body);
      const items = data.data || data || [];
      for (const item of items) {
        list.push(this.formatComicItem(item));
      }
      hasNextPage = items.length >= 20;
    }

    return { list, hasNextPage };
  }

  async search(query, page, filters) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();
    const params = [`page=${p}`, "type=comic"];

    if (query && typeof query === "string" && query.trim().length > 0) {
      params.push(`q=${encodeURIComponent(query.trim())}`);
    }

    let orderBy = "user_follow_count";
    let orderDir = "desc";

    if (Array.isArray(filters)) {
      for (const f of filters) {
        if (!f) continue;
        if (f.type_name === "SelectFilter" || f.type === "SortFilter") {
          if (f.name === "Sort" && f.values && f.values[f.state]) {
            orderBy = f.values[f.state].value || orderBy;
          } else if (f.name === "Order" && f.values && f.values[f.state]) {
            orderDir = f.values[f.state].value || orderDir;
          } else if (f.name === "Status" && f.values && f.values[f.state]) {
            const st = f.values[f.state].value;
            if (st && st !== "0" && st !== "all") params.push(`status=${st}`);
          } else if (f.name === "Created at" && f.values && f.values[f.state]) {
            const tm = f.values[f.state].value;
            if (tm) params.push(`time=${tm}`);
          } else if (
            f.name === "Content Rating" &&
            f.values &&
            f.values[f.state]
          ) {
            const cr = f.values[f.state].value;
            if (cr && cr !== "all") params.push(`content_rating=${cr}`);
          }
        } else if (f.type_name === "GroupFilter" || f.type === "GenreFilter") {
          if (f.name === "Genre" && Array.isArray(f.state)) {
            for (const g of f.state) {
              if (g.state === 1) {
                params.push(`genres=${g.value || g.name}`);
              } else if (g.state === 2) {
                params.push(`excludes=${g.value || g.name}`);
              }
            }
          } else if (f.name === "Demographic" && Array.isArray(f.state)) {
            for (const d of f.state) {
              if (d.state === 1 || d.state === true) {
                params.push(`demographic=${d.value || d.name}`);
              }
            }
          } else if (f.name === "Type" && Array.isArray(f.state)) {
            for (const t of f.state) {
              if (t.state === 1 || t.state === true) {
                params.push(`country=${t.value || t.name}`);
              }
            }
          }
        } else if (f.type_name === "TextFilter") {
          if (f.name === "Minimum Chapters" && f.state) {
            params.push(`minimum=${encodeURIComponent(f.state)}`);
          } else if (f.name === "Tags" && f.state) {
            params.push(`tags=${encodeURIComponent(f.state)}`);
          }
        }
      }
    }

    params.push(`order_by=${orderBy}`);
    params.push(`order_direction=${orderDir}`);

    const searchUrl = `${base}/api/search?${params.join("&")}`;
    const res = await this.client.get(searchUrl, this.getHeaders());
    const list = [];
    let hasNextPage = false;

    if (res && res.statusCode === 200 && res.body) {
      const data = JSON.parse(res.body);
      const items = data.data || data || [];
      for (const item of items) {
        list.push(this.formatComicItem(item));
      }
      hasNextPage = Boolean(data.next_cursor || items.length >= 20);
    }

    return { list, hasNextPage };
  }

  beautifyChapterName(vol, chap, title) {
    let result = "";
    if (vol && String(vol).trim() !== "" && String(vol).trim() !== "null") {
      result += `Vol. ${String(vol).trim()} `;
    }
    if (chap && String(chap).trim() !== "" && String(chap).trim() !== "null") {
      result += `Ch. ${String(chap).trim()}`;
    }
    if (
      title &&
      String(title).trim() !== "" &&
      String(title).trim() !== "null"
    ) {
      result +=
        result.length > 0 ? ` : ${String(title).trim()}` : String(title).trim();
    }
    return result.trim() || `Chapter ${chap || ""}`;
  }

  async getDetail(url) {
    let slug =
      typeof url === "object" && url !== null
        ? url.link || url.url || url.slug || ""
        : url;
    if (typeof slug === "string") {
      slug = slug
        .replace(/https?:\/\/[^\/]+/, "")
        .replace(/^\/comic\//, "")
        .replace(/\/.*$/, "")
        .replace(/#.*$/, "")
        .replace(/^\//, "")
        .trim();
    }
    if (!slug) throw new Error("Invalid comic slug");

    const base = this.getBaseUrl();
    const detailUrl = `${base}/comic/${slug}`;
    const res = await this.client.get(detailUrl, this.getHeaders());
    if (!res || res.statusCode !== 200 || !res.body) {
      throw new Error(`Failed to load comic details for ${slug}`);
    }

    const html = res.body;
    const comicDataMatch = html.match(
      /<script[^>]*id=["']comic-data["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    if (!comicDataMatch) {
      throw new Error(`comic-data not found for ${slug}`);
    }

    const data = JSON.parse(comicDataMatch[1]);
    const canonicalSlug = data.slug || slug;
    const title = data.title || slug;
    const imageUrl = data.default_thumbnail || data.thumbnail || "";

    const descParts = [];
    if (data.desc) {
      descParts.push(this.cleanHtml(data.desc));
    }
    if (Array.isArray(data.md_titles) && data.md_titles.length > 0) {
      const altTitles = data.md_titles.map((t) => t.title).filter(Boolean);
      if (altTitles.length > 0) {
        descParts.push(`\n\nAlternative Titles:\n- ${altTitles.join("\n- ")}`);
      }
    } else if (Array.isArray(data.titles) && data.titles.length > 0) {
      const altTitlesOld = data.titles.map((t) => t.title).filter(Boolean);
      if (altTitlesOld.length > 0) {
        descParts.push(
          `\n\nAlternative Titles:\n- ${altTitlesOld.join("\n- ")}`,
        );
      }
    }

    const genres = [];
    if (data.country === "jp" || data.country === "JP") genres.push("Manga");
    else if (data.country === "kr" || data.country === "KR")
      genres.push("Manhwa");
    else if (data.country === "cn" || data.country === "CN")
      genres.push("Manhua");

    if (
      data.demographic_name &&
      typeof data.demographic_name === "string" &&
      data.demographic_name.trim().length > 0
    ) {
      genres.push(data.demographic_name.trim());
    }

    if (Array.isArray(data.md_comic_md_genres)) {
      for (const gItem of data.md_comic_md_genres) {
        const gName =
          gItem.md_genres && gItem.md_genres.name
            ? gItem.md_genres.name
            : gItem.name || "";
        if (gName && !genres.includes(gName)) {
          genres.push(gName);
        }
      }
    } else if (Array.isArray(data.genres)) {
      for (const ogItem of data.genres) {
        const ogName = ogItem.genres ? ogItem.genres.name : ogItem.name;
        if (ogName && !genres.includes(ogName)) {
          genres.push(ogName);
        }
      }
    }

    let status = 5;
    if (data.status === 1) status = 0;
    else if (data.status === 2) status = data.translation_completed ? 1 : 4;
    else if (data.status === 3) status = 3;
    else if (data.status === 4) status = 2;

    const author = (data.authors || []).map((a) => a.name).join(", ");
    const artist = (data.artists || []).map((a) => a.name).join(", ");

    const lang = this.source && this.source.lang ? this.source.lang : "en";
    const chapters = [];
    let page = 1;
    let lastPage = 1;
    const maxPages = 20;

    do {
      let chapUrl = `${base}/api/comics/${canonicalSlug}/chapter-list?page=${page}`;
      if (lang && lang !== "all") {
        chapUrl += `&lang=${encodeURIComponent(lang)}`;
      }
      const cRes = await this.client.get(chapUrl, this.getHeaders());
      if (cRes && cRes.statusCode === 200 && cRes.body) {
        const cData = JSON.parse(cRes.body);
        const chapItems = cData.data || [];
        for (const ch of chapItems) {
          const chapName = this.beautifyChapterName(ch.vol, ch.chap, ch.title);
          const scanlators = Array.isArray(ch.group_name)
            ? ch.group_name.filter(Boolean)
            : ch.group_name
              ? [ch.group_name]
              : [];

          const chapUrlPath = `/comic/${canonicalSlug}/${ch.hid}-chapter-${ch.chap}-${ch.lang}`;
          let dateUpload = null;
          if (ch.created_at) {
            dateUpload = String(new Date(ch.created_at).getTime());
          } else if (ch.publish_at) {
            dateUpload = String(new Date(ch.publish_at).getTime());
          }

          chapters.push({
            name: chapName,
            url: chapUrlPath,
            dateUpload,
            scanlator: scanlators.join(", "),
          });
        }
        lastPage =
          cData.pagination && cData.pagination.last_page
            ? cData.pagination.last_page
            : 1;
      } else {
        break;
      }
      page++;
    } while (page <= lastPage && page <= maxPages);

    return {
      name: title,
      imageUrl,
      description: descParts.join(""),
      author,
      artist,
      genre: genres,
      status,
      link: `${base}/comic/${canonicalSlug}`,
      chapters,
    };
  }

  async getPageList(url) {
    const path =
      typeof url === "object" && url !== null ? url.url || url.link || "" : url;
    const base = this.getBaseUrl();
    const targetUrl = path.startsWith("http")
      ? path
      : `${base}${path.startsWith("/") ? "" : "/"}${path}`;

    const res = await this.client.get(targetUrl, this.getHeaders());
    if (!res || res.statusCode !== 200 || !res.body) {
      throw new Error(`Failed to load chapter reader page for ${targetUrl}`);
    }

    const html = res.body;
    const svMatch = html.match(
      /<script[^>]*id=["']sv-data["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    const pages = [];

    if (svMatch) {
      const svData = JSON.parse(svMatch[1]);
      const images =
        svData.chapter && svData.chapter.images ? svData.chapter.images : [];
      for (const img of images) {
        if (img && img.url) {
          pages.push({
            url: img.url,
            headers: { Referer: `${base}/` },
          });
        }
      }
    }

    if (pages.length === 0) {
      const imgRegex = /https?:\/\/[^\s"'<>]+\.(?:webp|jpg|jpeg|png)/gi;
      let match;
      const seen = new Set();
      while ((match = imgRegex.exec(html)) !== null) {
        const u = match[0];
        if (
          (u.includes("pictures") ||
            u.includes("meo") ||
            u.includes("chapter")) &&
          !u.includes("covers") &&
          !u.includes("logo") &&
          !seen.has(u)
        ) {
          seen.add(u);
          pages.push({
            url: u,
            headers: { Referer: `${base}/` },
          });
        }
      }
    }

    return pages;
  }

  getFilterList() {
    return [
      {
        type_name: "SelectFilter",
        name: "Sort",
        state: 0,
        values: [
          {
            type_name: "SelectOption",
            name: "Most Popular / Follows",
            value: "user_follow_count",
          },
          {
            type_name: "SelectOption",
            name: "Last Updated",
            value: "uploaded",
          },
          { type_name: "SelectOption", name: "Newest", value: "created_at" },
          {
            type_name: "SelectOption",
            name: "Highest Rating",
            value: "rating",
          },
        ],
      },
      {
        type_name: "SelectFilter",
        name: "Order",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "Descending", value: "desc" },
          { type_name: "SelectOption", name: "Ascending", value: "asc" },
        ],
      },
      {
        type_name: "SelectFilter",
        name: "Status",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "All", value: "0" },
          { type_name: "SelectOption", name: "Ongoing", value: "1" },
          { type_name: "SelectOption", name: "Completed", value: "2" },
          { type_name: "SelectOption", name: "Cancelled", value: "3" },
          { type_name: "SelectOption", name: "Hiatus", value: "4" },
        ],
      },
      {
        type_name: "GroupFilter",
        name: "Demographic",
        state: [
          { type_name: "CheckBox", name: "Shounen", value: "1", state: false },
          { type_name: "CheckBox", name: "Shoujo", value: "4", state: false },
          { type_name: "CheckBox", name: "Seinen", value: "3", state: false },
          { type_name: "CheckBox", name: "Josei", value: "2", state: false },
        ],
      },
      {
        type_name: "GroupFilter",
        name: "Type",
        state: [
          {
            type_name: "CheckBox",
            name: "Manga (JP)",
            value: "jp",
            state: false,
          },
          {
            type_name: "CheckBox",
            name: "Manhwa (KR)",
            value: "kr",
            state: false,
          },
          {
            type_name: "CheckBox",
            name: "Manhua (CN)",
            value: "cn",
            state: false,
          },
        ],
      },
      {
        type_name: "SelectFilter",
        name: "Created at",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "All Time", value: "" },
          { type_name: "SelectOption", name: "3 days ago", value: "3" },
          { type_name: "SelectOption", name: "7 days ago", value: "7" },
          { type_name: "SelectOption", name: "30 days ago", value: "30" },
          { type_name: "SelectOption", name: "3 months ago", value: "90" },
          { type_name: "SelectOption", name: "6 months ago", value: "180" },
          { type_name: "SelectOption", name: "1 year ago", value: "365" },
        ],
      },
      {
        type_name: "GroupFilter",
        name: "Genre",
        state: [
          ["Action", "action"],
          ["Adventure", "adventure"],
          ["Comedy", "comedy"],
          ["Drama", "drama"],
          ["Fantasy", "fantasy"],
          ["Horror", "horror"],
          ["Mystery", "mystery"],
          ["Psychological", "psychological"],
          ["Romance", "romance"],
          ["Sci-Fi", "sci-fi"],
          ["Slice of Life", "slice-of-life"],
          ["Sports", "sports"],
          ["Supernatural", "supernatural"],
          ["Thriller", "thriller"],
          ["Tragedy", "tragedy"],
          ["Isekai", "isekai"],
          ["Historical", "historical"],
          ["Martial Arts", "martial-arts"],
          ["Mecha", "mecha"],
          ["School Life", "school-life"],
          ["Magic", "magic"],
          ["Military", "military"],
          ["Harem", "harem"],
          ["Ecchi", "ecchi"],
          ["Mature", "mature"],
          ["Adult", "adult"],
          ["Doujinshi", "doujinshi"],
          ["Gender Bender", "gender-bender"],
          ["Gore", "gore"],
          ["Smut", "smut"],
          ["Yaoi", "yaoi"],
          ["Yuri", "yuri"],
          ["Shounen Ai", "shounen-ai"],
          ["Shoujo Ai", "shoujo-ai"],
          ["Web Comic", "web-comic"],
          ["Full Color", "full-color"],
          ["Long Strip", "long-strip"],
          ["4-Koma", "4-koma"],
          ["Award Winning", "award-winning"],
          ["Reincarnation", "reincarnation"],
          ["Time Travel", "time-travel"],
          ["Villainess", "villainess"],
          ["Virtual Reality", "virtual-reality"],
          ["Zombies", "zombies"],
          ["Vampires", "vampires"],
          ["Demons", "demons"],
          ["Aliens", "aliens"],
          ["Monsters", "monsters"],
        ].map((x) => ({
          type_name: "TriState",
          name: x[0],
          value: x[1],
          state: 0,
        })),
      },
      {
        type_name: "TextFilter",
        name: "Minimum Chapters",
        state: "",
      },
      {
        type_name: "TextFilter",
        name: "Tags",
        state: "",
      },
    ];
  }

  getSourcePreferences() {
    return [
      {
        key: "comick_pref_domain",
        listPreference: {
          title: "Override Base URL Mirror",
          summary: "Select domain mirror in case of blocks or downtime",
          valueIndex: 0,
          entries: ["comick.art (Default)", "comick.live"],
          entryValues: ["https://comick.art", "https://comick.live"],
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
