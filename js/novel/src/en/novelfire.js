const mangayomiSources = [
  {
    "name": "NovelFire",
    "id": 923847119,
    "baseUrl": "https://novelfire.net",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://novelfire.net/favicon.ico",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": true,
    "sourceCodeUrl": "https://raw.githubusercontent.com/vzpyr/mangayomi/main/js/novel/src/en/novelfire.js",
    "apiUrl": "",
    "version": "1.0.0",
    "isManga": false,
    "itemType": 2,
    "isFullData": false,
    "appMinVerReq": "0.6.1",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "novel/src/en/novelfire.js"
  }
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.defaultBaseUrl = "https://novelfire.net";
  }

  getBaseUrl() {
    try {
      var pref = new SharedPreferences().get("novelfire_pref_domain");
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
    var list = [];
    if (!html) return { list: list, hasNextPage: false };

    var itemRegex = /<li[^>]*class=["'][^"']*novel-item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    var match;
    var base = this.getBaseUrl();

    while ((match = itemRegex.exec(html)) !== null) {
      var itemHtml = match[1];

      var aMatch =
        itemHtml.match(/<h[2-4][^>]*class=["'][^"']*novel-title[^"']*["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i) ||
        itemHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*title=["']([^"']+)["']/i) ||
        itemHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);

      if (!aMatch) continue;

      var link = aMatch[1] || "";
      var title = this.cleanText(aMatch[2] || "");

      if (link.startsWith("http")) {
        try {
          var urlObj = new URL(link);
          link = urlObj.pathname;
        } catch (e) {}
      }

      var imgMatch =
        itemHtml.match(/<img[^>]+data-src=["']([^"']+)["']/i) ||
        itemHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
      var imageUrl = imgMatch ? imgMatch[1] : "";
      if (imageUrl && !imageUrl.startsWith("http")) {
        imageUrl = base + (imageUrl.startsWith("/") ? "" : "/") + imageUrl;
      }

      if (!title) {
        var altMatch = itemHtml.match(/<img[^>]+alt=["']([^"']+)["']/i);
        if (altMatch) title = this.cleanText(altMatch[1]);
      }

      if (title && link) {
        list.push({
          name: title,
          imageUrl: imageUrl,
          link: link,
        });
      }
    }

    var hasNextPage =
      html.includes('rel="next"') ||
      html.includes('aria-label="Next"') ||
      html.includes('class="next"') ||
      list.length >= 18;

    return { list: list, hasNextPage: hasNextPage };
  }

  async getPopular(page) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();
    var url = base + "/genre-all/sort-popular/status-all/all-novel?page=" + page;
    var res = await this.client.get(url, this.getHeaders(url));
    return this.parseNovelsFromHtml(res ? res.body : "");
  }

  async getLatestUpdates(page) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();
    var url = base + "/latest-release-novels?page=" + page;
    var res = await this.client.get(url, this.getHeaders(url));
    return this.parseNovelsFromHtml(res ? res.body : "");
  }

  async search(query, page, filters) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();

    if (query && typeof query === "string" && query.trim().length > 0) {
      var searchUrl =
        base +
        "/search?keyword=" +
        encodeURIComponent(query.trim()) +
        "&type=both&page=" +
        page;
      var res = await this.client.get(searchUrl, this.getHeaders(searchUrl));
      return this.parseNovelsFromHtml(res ? res.body : "");
    }

    var genre = "all";
    var sort = "popular";
    var status = "all";

    if (filters && Array.isArray(filters)) {
      for (var i = 0; i < filters.length; i++) {
        var f = filters[i];
        if (!f) continue;
        if (f.name === "Sort" && f.values && f.values[f.state]) {
          sort = f.values[f.state].value || sort;
        } else if (f.name === "Status" && f.values && f.values[f.state]) {
          status = f.values[f.state].value || status;
        } else if (f.name === "Genre" && f.values && f.values[f.state]) {
          genre = f.values[f.state].value || genre;
        }
      }
    }

    var filterUrl =
      base +
      "/genre-" +
      genre +
      "/sort-" +
      sort +
      "/status-" +
      status +
      "/all-novel?page=" +
      page;
    var fRes = await this.client.get(filterUrl, this.getHeaders(filterUrl));
    return this.parseNovelsFromHtml(fRes ? fRes.body : "");
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

    var titleMatch =
      html.match(/<h1[^>]*class=["'][^"']*novel-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    var name = titleMatch ? this.cleanText(titleMatch[1]) : "Novel";

    var imgMatch =
      html.match(/<figure[^>]*class=["'][^"']*cover[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<img[^>]+class=["'][^"']*novel-cover[^"']*["'][^>]+src=["']([^"']+)["']/i);
    var imageUrl = imgMatch ? imgMatch[1] : "";
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = base + (imageUrl.startsWith("/") ? "" : "/") + imageUrl;
    }

    var descMatch =
      html.match(/<meta[^>]+itemprop=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<div[^>]+class=["'][^"']*summary[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    var description = descMatch ? this.cleanText(descMatch[1]) : "";

    var authorMatch =
      html.match(/<span[^>]+itemprop=["']author["'][^>]*>([\s\S]*?)<\/span>/i) ||
      html.match(/<a[^>]+href=["'][^"']*\/author\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) ||
      html.match(/author[:\s]*<span[^>]*>([\s\S]*?)<\/span>/i);
    var author = authorMatch ? this.cleanText(authorMatch[1]) : "";

    var genres = [];
    var kwMatch = html.match(/<meta[^>]+itemprop=["']keywords["'][^>]+content=["']([^"']+)["']/i);
    if (kwMatch && kwMatch[1]) {
      var splitKw = kwMatch[1].split(",");
      for (var k = 0; k < splitKw.length; k++) {
        var g = splitKw[k].trim();
        if (g && g.toLowerCase() !== "novel" && g.toLowerCase() !== "webnovel" && genres.indexOf(g) === -1) {
          genres.push(g);
        }
      }
    }

    var status = 0;
    if (html.includes("Completed") || html.includes("completed")) {
      status = 1;
    }

    var chapters = [];
    var chaptersUrl = detailUrl.replace(/\/+$/, "") + "/chapters";
    var page = 1;
    var maxPages = 15;

    while (chaptersUrl && page <= maxPages) {
      var cRes = await this.client.get(chaptersUrl + (chaptersUrl.includes("?") ? "&" : "?") + "page=" + page, this.getHeaders(chaptersUrl));
      if (!cRes || !cRes.body) break;

      var cHtml = cRes.body;
      var chRegex = /<a[^>]+href=["']([^"']*\/chapter-[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
      var chMatch;
      var pageChaptersCount = 0;

      while ((chMatch = chRegex.exec(cHtml)) !== null) {
        var chUrl = chMatch[1];
        var chTitle = this.cleanText(chMatch[2]);

        if (chUrl.startsWith("http")) {
          try {
            var cUrlObj = new URL(chUrl);
            chUrl = cUrlObj.pathname;
          } catch (e) {}
        }

        if (chTitle && chUrl) {
          pageChaptersCount++;
          chapters.push({
            name: chTitle,
            url: chUrl,
            dateUpload: null,
            scanlator: "",
          });
        }
      }

      if (pageChaptersCount === 0 || !cHtml.includes('rel="next"') && !cHtml.includes('page=' + (page + 1))) {
        break;
      }

      page++;
    }

    if (chapters.length === 0) {
      chapters.push({
        name: "Chapter 1",
        url: path.replace(/\/+$/, "") + "/chapter-1",
        dateUpload: null,
        scanlator: "",
      });
    }

    return {
      name: name,
      imageUrl: imageUrl,
      link: detailUrl,
      description: description,
      author: author,
      artist: "",
      genre: genres,
      status: status,
      chapters: chapters,
    };
  }

  async getHtmlContent(name, url) {
    var path = url;
    if (typeof path === "object" && path !== null) {
      path = path.url || path.link || "";
    }
    if (typeof path === "string") {
      path = path.replace(/https?:\/\/[^\/]+/, "").trim();
    }
    if (!path.startsWith("/")) path = "/" + path;

    var base = this.getBaseUrl();
    var fullUrl = base + path;
    var res = await this.client.get(fullUrl, this.getHeaders(fullUrl));
    if (!res || !res.body) {
      throw new Error("Failed to load chapter content for " + path);
    }

    var html = res.body;
    var contentMatch =
      html.match(/<div[^>]+id=["']content["'][^>]*>([\s\S]*?)<\/div>/i) ||
      html.match(/<div[^>]+class=["'][^"']*chapter-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
      html.match(/<div[^>]+class=["'][^"']*entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

    if (contentMatch) {
      return contentMatch[0];
    }

    return "<div class='chapter-content'><p>Content could not be parsed.</p></div>";
  }

  async cleanHtmlContent(html) {
    if (!html) return "";
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<div[^>]*class=["'][^"']*(?:ads|advertisement|banner)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<p[^>]*>[\s\S]*?(?:Translator:|Editor:|Read at novel|novelfire)[\s\S]*?<\/p>/gi, "")
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
          { type_name: "SelectOption", name: "Fantasy", value: "fantasy" },
          { type_name: "SelectOption", name: "Isekai", value: "isekai" },
          { type_name: "SelectOption", name: "Romance", value: "romance" },
          { type_name: "SelectOption", name: "Sci-fi", value: "sci-fi" },
          { type_name: "SelectOption", name: "Shounen", value: "shounen" },
          { type_name: "SelectOption", name: "Supernatural", value: "supernatural" },
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
