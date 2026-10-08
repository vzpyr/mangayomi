const mangayomiSources = [
  {
    name: "E-Hentai",
    id: 182940284,
    baseUrl: "https://e-hentai.org",
    lang: "all",
    typeSource: "single",
    iconUrl: "https://e-hentai.org/favicon.ico",
    dateFormat: "",
    dateFormatLocale: "",
    isNsfw: true,
    hasCloudflare: false,
    sourceCodeUrl:
      "https://raw.githubusercontent.com/vzpyr/mangayomi/main/js/manga/src/all/ehentai.js",
    apiUrl: "https://api.e-hentai.org/api.php",
    version: "1.0.1",
    isManga: true,
    itemType: 0,
    isFullData: false,
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes: "",
    pkgPath: "manga/src/all/ehentai.js",
  },
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.defaultBaseUrl = "https://e-hentai.org";
  }

  getBaseUrl() {
    try {
      const pref = new SharedPreferences().get("ehentai_pref_domain");
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
    let cookieStr = "nw=1";

    try {
      const customCookie = new SharedPreferences().get("ehentai_pref_cookie");
      if (
        customCookie &&
        typeof customCookie === "string" &&
        customCookie.trim().length > 0
      ) {
        cookieStr += `; ${customCookie.trim()}`;
      }
    } catch (_) {}

    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: `${base}/`,
      Cookie: cookieStr,
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
      .replace(/\s+/g, " ")
      .trim();
  }

  extractGidAndToken(input) {
    if (!input) return null;
    let str = "";
    if (typeof input === "string") {
      str = input;
    } else if (typeof input === "object" && input !== null) {
      str = input.link || input.url || input.path || "";
    }
    str = String(str).trim();

    const m = str.match(
      /(?:https?:\/\/[^\/]+)?\/(?:g|s|mpv)\/([a-zA-Z0-9]+)[\/-]([a-zA-Z0-9]+)/i,
    );
    if (m) {
      const p1 = m[1];
      const p2 = m[2];
      if (/^\d+$/.test(p1)) return [parseInt(p1), p2];
      if (/^\d+$/.test(p2)) return [parseInt(p2), p1];
    }

    const m2 = str.match(/(\d+)[\/_]([a-zA-Z0-9]{8,15})/i);
    if (m2) return [parseInt(m2[1]), m2[2]];

    return null;
  }

  parseGalleryList(html) {
    const list = [];
    if (!html) return list;

    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    const seen = new Set();

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowContent = rowMatch[1];
      const linkM = rowContent.match(
        /href=["'](https?:\/\/[^\/]+)?(\/g\/(\d+)\/([a-zA-Z0-9]+)\/?)["']/i,
      );
      const titleM = rowContent.match(/class=["']glink["']>([\s\S]*?)<\/div>/i);
      const imgM = rowContent.match(
        /<img[^>]+(?:data-src|src)=["']([^"']+)["']/i,
      );

      if (linkM && titleM) {
        const gid = linkM[3];
        if (!seen.has(gid)) {
          seen.add(gid);
          const link = linkM[2].endsWith("/") ? linkM[2] : `${linkM[2]}/`;
          list.push({
            name: this.cleanText(titleM[1]),
            imageUrl: imgM ? imgM[1] : "",
            link,
          });
        }
      }
    }

    if (list.length === 0) {
      const linkRegex =
        /<a[^>]+href=["'](https?:\/\/[^\/]+)?(\/g\/(\d+)\/([a-zA-Z0-9]+)\/?)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match;

      while ((match = linkRegex.exec(html)) !== null) {
        const path = match[2];
        const gId = match[3];
        const inner = match[5];

        if (seen.has(gId)) continue;

        const tMatch =
          inner.match(/class=["']glink["']>([\s\S]*?)<\/div>/i) ||
          inner.match(/alt=["']([^"']+)["']/i);

        if (tMatch) {
          seen.add(gId);
          const iMatch = inner.match(
            /<img[^>]+(?:data-src|src)=["']([^"']+)["']/i,
          );
          list.push({
            name: this.cleanText(tMatch[1]),
            imageUrl: iMatch ? iMatch[1] : "",
            link: path.endsWith("/") ? path : `${path}/`,
          });
        }
      }
    }

    return list;
  }

  async getPopular(page) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();
    const url = p === 1 ? `${base}/popular` : `${base}/?page=${p - 1}`;
    const res = await this.client.get(url, this.getHeaders(url));
    const list = this.parseGalleryList(res ? res.body : "");
    const hasNextPage = p < 50 && list.length >= 10;
    return { list, hasNextPage };
  }

  async getLatestUpdates(page) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();
    const url = `${base}/?page=${p - 1}`;
    const res = await this.client.get(url, this.getHeaders(url));
    const list = this.parseGalleryList(res ? res.body : "");
    const hasNextPage = list.length >= 10;
    return { list, hasNextPage };
  }

  async search(query, page, filters) {
    const p = parseInt(page) || 1;
    const base = this.getBaseUrl();
    const params = [`page=${p - 1}`];

    const qParts = [];
    if (query && typeof query === "string" && query.trim().length > 0) {
      qParts.push(query.trim());
    }

    const categoryBits = {
      Doujinshi: 2,
      Manga: 4,
      "Artist CG": 8,
      "Game CG": 16,
      Western: 512,
      "Non-H": 256,
      "Image Set": 32,
      Cosplay: 64,
      "Asian Porn": 128,
      Misc: 1,
    };

    let disabledCatsMask = 0;

    if (Array.isArray(filters)) {
      for (const f of filters) {
        if (!f) continue;
        if (f.name === "Language" && f.values && f.values[f.state]) {
          const langVal = f.values[f.state].value;
          if (langVal && langVal !== "all") {
            qParts.push(`language:${langVal}`);
          }
        } else if (
          f.name === "Minimum Rating" &&
          f.values &&
          f.values[f.state]
        ) {
          const minR = f.values[f.state].value;
          if (minR && minR !== "0") {
            params.push("f_sr=on");
            params.push(`f_srdd=${minR}`);
          }
        } else if (f.name === "Categories" && Array.isArray(f.state)) {
          for (const catItem of f.state) {
            if (catItem.state === false && categoryBits[catItem.name]) {
              disabledCatsMask += categoryBits[catItem.name];
            }
          }
        }
      }
    }

    if (disabledCatsMask > 0) {
      params.push(`f_cats=${disabledCatsMask}`);
    }

    if (qParts.length > 0) {
      params.push(`f_search=${encodeURIComponent(qParts.join(" "))}`);
    }

    const searchUrl = `${base}/?${params.join("&")}`;
    const res = await this.client.get(searchUrl, this.getHeaders(searchUrl));
    const list = this.parseGalleryList(res ? res.body : "");
    const hasNextPage = list.length >= 10;
    return { list, hasNextPage };
  }

  async getDetail(url) {
    const extracted = this.extractGidAndToken(url);
    if (!extracted) {
      return {
        name: "Gallery",
        imageUrl: "",
        link: this.getBaseUrl(),
        description: "",
        author: "",
        artist: "",
        genre: [],
        status: 1,
        chapters: [],
      };
    }

    const [gid, token] = extracted;
    const base = this.getBaseUrl();
    const detailUrl = `${base}/g/${gid}/${token}/`;

    const res = await this.client.get(detailUrl, this.getHeaders(detailUrl));
    const html = res ? res.body : "";

    let title = "";
    let imageUrl = "";
    let author = "";
    let artist = "";
    const genres = [];
    const descriptionParts = [];
    let postedDate = null;
    let uploader = "";

    if (html) {
      const hMatch =
        html.match(/<h1[^>]+id=["']gn["'][^>]*>([\s\S]*?)<\/h1>/i) ||
        html.match(/<h1[^>]+id=["']gj["'][^>]*>([\s\S]*?)<\/h1>/i) ||
        html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (hMatch) title = this.cleanText(hMatch[1]);

      const imgM =
        html.match(
          /<div[^>]+id=["']gd1["'][^>]*>[\s\S]*?<div[^>]+style=["'][^"']*url\(([^)]+)\)[^"']*["']/i,
        ) ||
        html.match(
          /<div[^>]+id=["']gd1["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
        );
      if (imgM) imageUrl = imgM[1].replace(/['"]/g, "");

      const tagRegex = /<a[^>]+id=["']ta_([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let tMatch;
      while ((tMatch = tagRegex.exec(html)) !== null) {
        const rawTag = tMatch[1].replace(/_/g, " ");
        const tagName = this.cleanText(tMatch[2]);
        const fullTag = rawTag.includes(":") ? rawTag : tagName || rawTag;

        if (fullTag.startsWith("artist:")) {
          artist = fullTag.replace(/^artist:/, "").trim();
          if (!author) author = artist;
        } else if (fullTag.startsWith("group:") && !author) {
          author = fullTag.replace(/^group:/, "").trim();
        }

        if (!genres.includes(fullTag)) {
          genres.push(fullTag);
        }
      }

      const uploaderMatch = html.match(
        /<div[^>]+id=["']gdn["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
      );
      if (uploaderMatch) {
        uploader = this.cleanText(uploaderMatch[1]);
        if (!author) author = uploader;
      }

      const catMatch = html.match(
        /<div[^>]+id=["']gdc["'][^>]*>[\s\S]*?<div[^>]+class=["'][^"']*cs[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      );
      if (catMatch) {
        const catName = this.cleanText(catMatch[1]);
        if (catName && !genres.includes(catName)) {
          genres.unshift(catName);
        }
      }

      const dateMatch = html.match(
        /<td[^>]+class=["']gdt1["'][^>]*>Posted:<\/td>\s*<td[^>]+class=["']gdt2["'][^>]*>([\s\S]*?)<\/td>/i,
      );
      if (dateMatch) {
        const dateStr = this.cleanText(dateMatch[1]);
        if (dateStr) {
          postedDate = String(new Date(`${dateStr} UTC`).getTime());
        }
      }

      const lengthMatch = html.match(
        /<td[^>]+class=["']gdt1["'][^>]*>Length:<\/td>\s*<td[^>]+class=["']gdt2["'][^>]*>([\s\S]*?)<\/td>/i,
      );
      if (lengthMatch) {
        descriptionParts.push(`Pages: ${this.cleanText(lengthMatch[1])}`);
      }

      const ratingMatch = html.match(
        /<td[^>]+id=["']rating_label["'][^>]*>([\s\S]*?)<\/td>/i,
      );
      if (ratingMatch) {
        descriptionParts.push(`Rating: ${this.cleanText(ratingMatch[1])}`);
      }
    }

    const chapters = [
      {
        name: "Chapter 1",
        url: `/g/${gid}/${token}/`,
        dateUpload: postedDate || String(Date.now()),
        scanlator: uploader || author || "",
      },
    ];

    return {
      name: title || `Gallery ${gid}`,
      imageUrl,
      link: detailUrl,
      description: descriptionParts.join("\n"),
      author,
      artist,
      genre: genres,
      status: 1,
      chapters,
    };
  }

  async getPageList(url) {
    const extracted = this.extractGidAndToken(url);
    if (!extracted) return [];

    const [gid, token] = extracted;
    const base = this.getBaseUrl();
    const readerPageUrls = [];
    let page = 0;
    const maxThumbPages = 10;

    while (page < maxThumbPages) {
      const thumbPageUrl = `${base}/g/${gid}/${token}/?p=${page}`;
      const res = await this.client.get(
        thumbPageUrl,
        this.getHeaders(thumbPageUrl),
      );
      if (!res || !res.body) break;

      const html = res.body;
      const readerRegex =
        /(?:https?:\/\/[^\/]+)?\/s\/([a-zA-Z0-9]+)\/(\d+)-(\d+)/g;
      let rMatch;
      let pageFoundCount = 0;

      while ((rMatch = readerRegex.exec(html)) !== null) {
        const readerLink = `${base}/s/${rMatch[1]}/${rMatch[2]}-${rMatch[3]}`;
        if (!readerPageUrls.includes(readerLink)) {
          readerPageUrls.push(readerLink);
          pageFoundCount++;
        }
      }

      if (
        pageFoundCount === 0 ||
        (!html.includes(`onclick="return false">${page + 2}</a>`) &&
          !html.includes(`?p=${page + 1}`))
      ) {
        break;
      }

      page++;
    }

    const images = [];
    const batchSize = 10;

    for (let b = 0; b < readerPageUrls.length; b += batchSize) {
      const batch = readerPageUrls.slice(b, b + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (rUrl) => {
          try {
            const rRes = await this.client.get(rUrl, this.getHeaders(rUrl));
            if (rRes && rRes.body) {
              const imgM = rRes.body.match(
                /<img[^>]+id=["']img["'][^>]+src=["']([^"']+)["']/i,
              );
              if (imgM) return imgM[1];
            }
          } catch (_) {}
          return null;
        }),
      );

      for (const res of batchResults) {
        if (res) images.push(res);
      }
    }

    return images;
  }

  getFilterList() {
    return [
      {
        type_name: "SelectFilter",
        name: "Language",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "All Languages", value: "all" },
          { type_name: "SelectOption", name: "English", value: "english" },
          { type_name: "SelectOption", name: "Japanese", value: "japanese" },
          { type_name: "SelectOption", name: "Chinese", value: "chinese" },
          { type_name: "SelectOption", name: "Spanish", value: "spanish" },
          { type_name: "SelectOption", name: "Korean", value: "korean" },
          { type_name: "SelectOption", name: "Russian", value: "russian" },
          { type_name: "SelectOption", name: "French", value: "french" },
          { type_name: "SelectOption", name: "German", value: "german" },
          {
            type_name: "SelectOption",
            name: "Portuguese",
            value: "portuguese",
          },
        ],
      },
      {
        type_name: "SelectFilter",
        name: "Minimum Rating",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "Any Rating", value: "0" },
          { type_name: "SelectOption", name: "2 Stars", value: "2" },
          { type_name: "SelectOption", name: "3 Stars", value: "3" },
          { type_name: "SelectOption", name: "4 Stars", value: "4" },
          { type_name: "SelectOption", name: "5 Stars", value: "5" },
        ],
      },
      {
        type_name: "GroupFilter",
        name: "Categories",
        state: [
          { type_name: "CheckBox", name: "Doujinshi", state: true },
          { type_name: "CheckBox", name: "Manga", state: true },
          { type_name: "CheckBox", name: "Artist CG", state: true },
          { type_name: "CheckBox", name: "Game CG", state: true },
          { type_name: "CheckBox", name: "Western", state: true },
          { type_name: "CheckBox", name: "Non-H", state: true },
          { type_name: "CheckBox", name: "Image Set", state: true },
          { type_name: "CheckBox", name: "Cosplay", state: true },
          { type_name: "CheckBox", name: "Asian Porn", state: true },
          { type_name: "CheckBox", name: "Misc", state: true },
        ],
      },
    ];
  }

  getSourcePreferences() {
    return [
      {
        key: "ehentai_pref_domain",
        listPreference: {
          title: "Domain Mirror",
          summary: "Select E-Hentai domain mirror",
          valueIndex: 0,
          entries: ["e-hentai.org (Default)", "exhentai.org (Requires Cookie)"],
          entryValues: ["https://e-hentai.org", "https://exhentai.org"],
        },
      },
      {
        key: "ehentai_pref_cookie",
        editTextPreference: {
          title: "Custom Cookie string",
          summary:
            "Paste custom member cookie (e.g. ipb_member_id=...; ipb_pass_hash=...)",
          value: "",
          dialogTitle: "Cookie string",
          dialogMessage: "Enter cookie key-value pairs separated by semicolons",
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
