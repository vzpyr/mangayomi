const mangayomiSources = [
  {
    "name": "Baka-Tsuki",
    "id": 617294021,
    "baseUrl": "https://www.baka-tsuki.org",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.baka-tsuki.org/favicon.ico",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "https://raw.githubusercontent.com/vzpyr/mangayomi/main/js/novel/src/en/bakatsuki.js",
    "apiUrl": "https://www.baka-tsuki.org/project/api.php",
    "version": "1.0.0",
    "isManga": false,
    "itemType": 2,
    "isFullData": false,
    "appMinVerReq": "0.6.1",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "Classic community light novel translations",
    "pkgPath": "novel/src/en/bakatsuki.js"
  }
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.defaultBaseUrl = "https://www.baka-tsuki.org";
  }

  getBaseUrl() {
    try {
      var pref = new SharedPreferences().get("bakatsuki_pref_domain");
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
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
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
    var base = this.getBaseUrl();
    var cleanSrc = src.replace(/&amp;/g, "&");
    if (cleanSrc.startsWith("http")) return cleanSrc;
    if (cleanSrc.startsWith("//")) return "https:" + cleanSrc;
    return base + (cleanSrc.startsWith("/") ? "" : "/") + cleanSrc;
  }

  async getPopular(page) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();
    var offset = (page - 1) * 30;
    var url =
      base +
      "/project/api.php?action=query&list=categorymembers&cmtitle=Category:Light_novel_(English)&cmlimit=30&cmtype=page&format=json";

    if (offset > 0) {
      url += "&cmoffset=" + offset;
    }

    var res = await this.client.get(url, this.getHeaders(url));
    var list = [];
    var hasNextPage = false;

    if (res && res.statusCode === 200 && res.body) {
      try {
        var data = JSON.parse(res.body);
        var members = (data.query && data.query.categorymembers) ? data.query.categorymembers : [];

        for (var i = 0; i < members.length; i++) {
          var item = members[i];
          var title = item.title || "";
          if (title.startsWith("Category:") || title.startsWith("Template:") || title.startsWith("User:")) {
            continue;
          }

          var link = "/project/index.php?title=" + encodeURIComponent(title.replace(/ /g, "_"));
          list.push({
            name: title,
            imageUrl: "",
            link: link,
          });
        }
        hasNextPage = Boolean(data.continue || members.length >= 30);
      } catch (e) {}
    }

    return { list: list, hasNextPage: hasNextPage };
  }

  async getLatestUpdates(page) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();
    var url =
      base +
      "/project/api.php?action=query&list=recentchanges&rcnamespace=0&rctype=edit|new&rclimit=30&format=json";

    var res = await this.client.get(url, this.getHeaders(url));
    var list = [];
    var seen = {};

    if (res && res.statusCode === 200 && res.body) {
      try {
        var data = JSON.parse(res.body);
        var rc = (data.query && data.query.recentchanges) ? data.query.recentchanges : [];

        for (var i = 0; i < rc.length; i++) {
          var rawTitle = rc[i].title || "";
          var mainTitle = rawTitle.split(":")[0].trim();

          if (mainTitle && !seen[mainTitle]) {
            seen[mainTitle] = true;
            var link = "/project/index.php?title=" + encodeURIComponent(mainTitle.replace(/ /g, "_"));
            list.push({
              name: mainTitle,
              imageUrl: "",
              link: link,
            });
          }
        }
      } catch (e) {}
    }

    return { list: list, hasNextPage: list.length >= 10 };
  }

  async search(query, page, filters) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();
    var list = [];
    var hasNextPage = false;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return await this.getPopular(page);
    }

    var q = query.trim();
    var offset = (page - 1) * 25;
    var url =
      base +
      "/project/api.php?action=query&list=search&srsearch=" +
      encodeURIComponent(q) +
      "&srnamespace=0&srlimit=25&sroffset=" +
      offset +
      "&format=json";

    var res = await this.client.get(url, this.getHeaders(url));

    if (res && res.statusCode === 200 && res.body) {
      try {
        var data = JSON.parse(res.body);
        var searchItems = (data.query && data.query.search) ? data.query.search : [];
        var seen = {};

        for (var i = 0; i < searchItems.length; i++) {
          var item = searchItems[i];
          var title = item.title || "";
          var mainTitle = title.split(":")[0].trim();

          if (mainTitle && !seen[mainTitle]) {
            seen[mainTitle] = true;
            var link = "/project/index.php?title=" + encodeURIComponent(mainTitle.replace(/ /g, "_"));
            list.push({
              name: mainTitle,
              imageUrl: "",
              link: link,
            });
          }
        }
        hasNextPage = Boolean(data.continue || searchItems.length >= 25);
      } catch (e) {}
    }

    return { list: list, hasNextPage: hasNextPage };
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
      html.match(/<h1[^>]*id=["']firstHeading["'][^>]*>([\s\S]*?)<\/h1>/i) ||
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    var name = titleMatch ? this.cleanText(titleMatch[1]) : "Light Novel";

    var imgMatch =
      html.match(/<div[^>]*class=["'][^"']*thumbinner[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i) ||
      html.match(/<img[^>]+src=["']([^"']*(?:thumb\.php|\/images\/)[^"']*)["']/i) ||
      html.match(/<img[^>]+src=["']([^"']+\.(?:jpg|png|jpeg|webp)[^"']*)["']/i);
    var imageUrl = imgMatch ? this.formatImageUrl(imgMatch[1]) : "";

    var descMatch =
      html.match(/<h2[^>]*>[\s\S]*?Story\s*Synopsis[\s\S]*?<\/h2>([\s\S]*?)(?:<h2|<div\s+id=["']toc["'])/i) ||
      html.match(/<h2[^>]*>[\s\S]*?Synopsis[\s\S]*?<\/h2>([\s\S]*?)(?:<h2|<div\s+id=["']toc["'])/i) ||
      html.match(/<p>([\s\S]*?)<\/p>/i);
    var description = descMatch ? this.cleanText(descMatch[1]) : "";

    var author = "";
    var authorMatch =
      html.match(/(?:Author|Writer)[:\s]*<b>([\s\S]*?)<\/b>/i) ||
      html.match(/(?:Author|Writer)[:\s]*<a[^>]*>([\s\S]*?)<\/a>/i) ||
      html.match(/<li>(?:Author|Writer)[:\s]*([^\n<]+)<\/li>/i) ||
      html.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)'s personal blog/i) ||
      html.match(/Author[:\s]*([^\n<]+)/i);

    if (authorMatch) {
      author = this.cleanText(authorMatch[1] || authorMatch[0]).replace(/\s*\(Author.*\)$/i, "").trim();
    }

    var artist = "";
    var artistMatch =
      html.match(/Illustrator[:\s]*<b>([\s\S]*?)<\/b>/i) ||
      html.match(/Illustrator[:\s]*<a[^>]*>([\s\S]*?)<\/a>/i) ||
      html.match(/Illustrator[:\s]*([^\n<]+)/i);
    if (artistMatch) {
      artist = this.cleanText(artistMatch[1]);
    }

    var genres = ["Light Novel", "Japanese"];
    var genreMatch = html.match(/Genre[:\s]*([^\n<]+)/i);
    if (genreMatch) {
      var splitG = genreMatch[1].split(/[,/]/);
      for (var g = 0; g < splitG.length; g++) {
        var cleanG = this.cleanText(splitG[g]);
        if (cleanG && genres.indexOf(cleanG) === -1) {
          genres.push(cleanG);
        }
      }
    }

    var chapters = [];
    var seenChapters = {};
    var rawNovelName = name.replace(/ /g, "_");
    var linkRegex = /<a[^>]+href=["']([^"']*\/project\/index\.php\?title=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    var chMatch;

    while ((chMatch = linkRegex.exec(html)) !== null) {
      var chHref = chMatch[1];
      var chText = this.cleanText(chMatch[2]);

      var isChapterLink =
        chHref.includes(encodeURIComponent(rawNovelName) + ":") ||
        chHref.includes(rawNovelName + ":") ||
        chHref.includes("Volume_") ||
        chHref.includes("Chapter_") ||
        chHref.includes("Prologue") ||
        chHref.includes("Epilogue") ||
        chHref.includes("Afterword");

      var isExcluded =
        chHref.includes("action=edit") ||
        chHref.includes("action=history") ||
        chHref.includes("Special:") ||
        chHref.includes("User:") ||
        chHref.includes("Registration_Page") ||
        chHref.includes("Tasklist") ||
        chHref.includes("Guidelines") ||
        chHref.includes("&oldid=");

      if (isChapterLink && !isExcluded && !seenChapters[chHref] && chText.length > 0) {
        seenChapters[chHref] = true;

        var cleanChHref = chHref;
        if (cleanChHref.startsWith("http")) {
          try {
            var urlObj = new URL(cleanChHref);
            cleanChHref = urlObj.pathname + urlObj.search;
          } catch (e) {}
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
      name: name,
      imageUrl: imageUrl,
      link: detailUrl,
      description: description,
      author: author,
      artist: artist,
      genre: genres,
      status: 1,
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
      html.match(/<div[^>]+class=["'][^"']*mw-parser-output[^"']*["'][^>]*>([\s\S]*?)<!--\s*\/mw-parser-output\s*-->/i) ||
      html.match(/<div[^>]+id=["']mw-content-text["'][^>]*>([\s\S]*?)<div[^>]+id=["']catlinks["']/i) ||
      html.match(/<div[^>]+id=["']mw-content-text["'][^>]*>([\s\S]*?)<\/div>/i);

    if (contentMatch) {
      return contentMatch[1] || contentMatch[0];
    }

    return "<div class='chapter-content'><p>Content could not be parsed.</p></div>";
  }

  async cleanHtmlContent(html) {
    if (!html) return "";
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<div[^>]*class=["'][^"']*(?:toc|mw-editsection|navbox|infobox)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<span[^>]*class=["'][^"']*mw-editsection[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, "")
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
          { type_name: "SelectOption", name: "Light Novel (English)", value: "Category:Light_novel_(English)" },
          { type_name: "SelectOption", name: "Teasers (English)", value: "Category:Teaser_(English)" },
          { type_name: "SelectOption", name: "Original Novels", value: "Category:Original_novel_(English)" },
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
