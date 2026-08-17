const mangayomiSources = [
  {
    "name": "Anna's Archive",
    "id": 819274810,
    "baseUrl": "https://annas-archive.org",
    "lang": "all",
    "typeSource": "single",
    "iconUrl": "https://annas-archive.org/favicon.ico",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": true,
    "sourceCodeUrl": "https://raw.githubusercontent.com/vzpyr/mangayomi/main/js/novel/src/all/annasarchive.js",
    "apiUrl": "",
    "version": "1.0.0",
    "isManga": false,
    "itemType": 2,
    "isFullData": false,
    "appMinVerReq": "0.6.1",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "EPUBs are automatically downloaded to view chapters!",
    "pkgPath": "novel/src/all/annasarchive.js"
  }
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.defaultBaseUrl = "https://annas-archive.org";
  }

  getBaseUrl() {
    try {
      var pref = new SharedPreferences().get("annas_pref_domain");
      if (pref && typeof pref === "string" && pref.trim().length > 0) {
        return pref.trim().replace(/\/+$/, "");
      }
    } catch (e) {}
    if (this.source && this.source.baseUrl) {
      return this.source.baseUrl.replace(/\/+$/, "");
    }
    return this.defaultBaseUrl;
  }

  getHeaders(url) {
    var base = this.getBaseUrl();
    return {
      Priority: "u=0, i",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: base + "/",
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
    var list = [];
    if (!html) return { list: list, hasNextPage: false };

    var map = {};
    var itemOrder = [];
    var linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    var match;

    while ((match = linkRegex.exec(html)) !== null) {
      var href = match[1];
      var inner = match[2];

      if (href.includes("/books/") || href.includes("/md5/")) {
        var linkPath = href;
        if (linkPath.startsWith("http")) {
          try {
            var urlObj = new URL(linkPath);
            linkPath = urlObj.pathname + urlObj.search;
          } catch (e) {}
        }

        if (!map[linkPath]) {
          map[linkPath] = { name: "", imageUrl: "", link: linkPath };
          itemOrder.push(linkPath);
        }

        var textContent = this.cleanText(inner);
        if (textContent && !map[linkPath].name && textContent.length > 1) {
          map[linkPath].name = textContent;
        }

        var imgMatch = inner.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i);
        var altMatch = inner.match(/<img[^>]+alt=["']([^"']+)["']/i);

        if (imgMatch && imgMatch[1] && !map[linkPath].imageUrl) {
          map[linkPath].imageUrl = imgMatch[1];
        }
        if (altMatch && altMatch[1] && !map[linkPath].name) {
          map[linkPath].name = this.cleanText(altMatch[1]);
        }
      }
    }

    for (var i = 0; i < itemOrder.length; i++) {
      var item = map[itemOrder[i]];
      if (item.name || item.imageUrl) {
        if (!item.name) {
          var slugParts = item.link.split("-");
          slugParts.shift();
          item.name = slugParts.join(" ").replace(/_/g, " ") || "Book";
        }
        list.push(item);
      }
    }

    var hasNextPage = html.includes('rel="next"') || html.includes("page=") || list.length >= 10;
    return { list: list, hasNextPage: hasNextPage };
  }

  async getPopular(page) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();
    var lang = (this.source && this.source.lang && this.source.lang !== "all") ? "&lang=" + this.source.lang : "";
    var url = base + "/search?index=&page=" + page + "&q=&display=&ext=epub&src=lgli&sort=" + lang;
    var res = await this.client.get(url, this.getHeaders(url));
    return this.parseNovelListFromHtml(res ? res.body : "");
  }

  async getLatestUpdates(page) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();
    var lang = (this.source && this.source.lang && this.source.lang !== "all") ? "&lang=" + this.source.lang : "";
    var url = base + "/search?index=&page=" + page + "&q=&display=&ext=epub&src=lgli&sort=newest" + lang;
    var res = await this.client.get(url, this.getHeaders(url));
    return this.parseNovelListFromHtml(res ? res.body : "");
  }

  async search(query, page, filters) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();
    var q = query ? encodeURIComponent(query.trim()) : "";
    var ext = "epub";
    var sort = "";
    var src = "lgli";
    var lang = (this.source && this.source.lang && this.source.lang !== "all") ? "&lang=" + this.source.lang : "";

    if (filters && Array.isArray(filters)) {
      for (var i = 0; i < filters.length; i++) {
        var f = filters[i];
        if (!f) continue;
        if (f.name === "File Format" && f.values && f.values[f.state]) {
          ext = f.values[f.state].value || ext;
        } else if (f.name === "Sort" && f.values && f.values[f.state]) {
          sort = f.values[f.state].value || sort;
        } else if (f.name === "Source Catalog" && f.values && f.values[f.state]) {
          src = f.values[f.state].value || src;
        }
      }
    }

    var url = base + "/search?index=&page=" + page + "&q=" + q + "&display=&ext=" + ext + "&src=" + src + "&sort=" + sort + lang;
    var res = await this.client.get(url, this.getHeaders(url));
    return this.parseNovelListFromHtml(res ? res.body : "");
  }

  async getDetail(url) {
    var path = url;
    if (typeof path === "object" && path !== null) {
      path = path.url || path.link || "";
    }
    if (typeof path === "string") {
      path = path.replace(/https?:\/\/[^\/]+/, "").trim();
    }
    if (!path.startsWith("/")) path = "/" + path;

    var base = this.getBaseUrl();
    var detailUrl = base + path;
    var res = await this.client.get(detailUrl, this.getHeaders(detailUrl));
    if (!res || !res.body) {
      throw new Error("Failed to load details for " + path);
    }

    var html = res.body;

    var titleTagMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    var name = "";
    if (titleTagMatch) {
      name = this.cleanText(titleTagMatch[1]).replace(/\s*\|\s*Anna'?s Archive.*$/i, "").trim();
    }
    if (!name || name.toLowerCase() === "anna's archive") {
      var nameMatch =
        html.match(/<div[^>]+class=["'][^"']*text-(?:2xl|3xl|4xl)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
      if (nameMatch) {
        name = this.cleanText(nameMatch[1]);
      }
    }
    if (!name || name.toLowerCase() === "anna's archive") {
      name = "Novel";
    }

    var imgMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<img[^>]+class=["'][^"']*cover[^"']*["'][^>]+src=["']([^"']+)["']/i) ||
      html.match(/<img[^>]+src=["']([^"']+)["']/i);
    var imageUrl = imgMatch ? imgMatch[1] : "";
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = base + (imageUrl.startsWith("/") ? "" : "/") + imageUrl;
    }

    var descMatch =
      html.match(/<div[^>]+class=["'][^"']*mb-1[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    var description = descMatch ? this.cleanText(descMatch[1]).replace(/^description/i, "").trim() : "";

    var authorMatch =
      html.match(/<div[^>]+class=["'][^"']*italic[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
      html.match(/<span[^>]+class=["'][^"']*author[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    var author = authorMatch ? this.cleanText(authorMatch[1]) : "";

    var genres = [];
    var extMatch = html.match(/file\s*format[:\s]*([a-zA-Z0-9]+)/i);
    if (extMatch) genres.push(extMatch[1].toUpperCase());
    var langMatch = html.match(/language[:\s]*([a-zA-Z]+)/i);
    if (langMatch) genres.push(langMatch[1]);

    var mirrorLink = "";
    var linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    var lMatch;

    while ((lMatch = linkRegex.exec(html)) !== null) {
      var lHref = lMatch[1];
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

    var chapters = [];
    if (mirrorLink) {
      var bookLink = await this._getMirrorLink(this.client, mirrorLink);
      if (bookLink) {
        try {
          if (typeof parseEpub === "function") {
            var book = await parseEpub(name, bookLink, {
              Connection: "Keep-Alive",
              ...this.getHeaders(bookLink),
            });
            if (book && Array.isArray(book.chapters)) {
              for (var c = 0; c < book.chapters.length; c++) {
                chapters.push({
                  name: book.chapters[c],
                  url: mirrorLink + ";;;" + book.chapters[c],
                  dateUpload: String(Date.now()),
                  scanlator: null,
                });
              }
            }
          }
        } catch (e) {}
      }
    }

    if (chapters.length === 0) {
      chapters.push({
        name: "Full Book / Chapter 1",
        url: (mirrorLink || path) + ";;;Full Book",
        dateUpload: String(Date.now()),
        scanlator: null,
      });
    }

    return {
      name: name,
      imageUrl: imageUrl,
      link: base + path,
      description: description,
      author: author,
      artist: "",
      genre: genres,
      status: 1,
      chapters: chapters,
    };
  }

  async _getMirrorLink(client, mirrorLink) {
    if (!mirrorLink) return null;
    if (mirrorLink.endsWith(".epub") || mirrorLink.endsWith(".pdf") || mirrorLink.endsWith(".mobi")) {
      return mirrorLink;
    }

    try {
      var base = this.getBaseUrl();
      var target = mirrorLink.startsWith("http") ? mirrorLink : base + (mirrorLink.startsWith("/") ? "" : "/") + mirrorLink;
      var res = await client.get(target, {
        Origin: base,
        ...this.getHeaders(target),
      });

      if (!res || !res.body) return null;
      var html = res.body;

      var downloadMatch =
        html.match(/<a[^>]+href=["']([^"']+\.epub[^"']*)["']/i) ||
        html.match(/<a[^>]+href=["']([^"']*download\.php[^"']*)["']/i) ||
        html.match(/<a[^>]+href=["'](https?:\/\/[^"']+\/get\.php[^"']*)["']/i) ||
        html.match(/<div[^>]*id=["']download["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["']/i);

      if (downloadMatch) {
        var directUrl = downloadMatch[1];
        if (directUrl.startsWith("/")) {
          var origin = target.match(/^https?:\/\/[^\/]+/)[0];
          return origin + directUrl;
        }
        return directUrl;
      }
    } catch (e) {}
    return mirrorLink;
  }

  async getHtmlContent(name, url) {
    var parts = (url || "").split(";;;");
    var mirror = parts[0] || "";
    var chapterName = parts[1] || "";

    var bookLink = await this._getMirrorLink(this.client, mirror);
    if (typeof parseEpubChapter === "function") {
      try {
        return await parseEpubChapter(name, bookLink || mirror, {
          Connection: "Keep-Alive",
          ...this.getHeaders(bookLink || mirror),
        }, chapterName);
      } catch (e) {}
    }

    return "<div class='novel-content'><p>Reading chapter: " + chapterName + "</p></div>";
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
          { type_name: "SelectOption", name: "Libgen.li (Recommended)", value: "lgli" },
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
            "annas-archive.org (Default)",
            "annas-archive.gs",
            "annas-archive.se",
            "annas-archive.li",
            "annas-archive.pm",
          ],
          entryValues: [
            "https://annas-archive.org",
            "https://annas-archive.gs",
            "https://annas-archive.se",
            "https://annas-archive.li",
            "https://annas-archive.pm",
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
