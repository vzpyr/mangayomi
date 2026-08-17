const mangayomiSources = [
  {
    "name": "E-Hentai",
    "id": 182940284,
    "baseUrl": "https://e-hentai.org",
    "lang": "all",
    "typeSource": "single",
    "iconUrl": "https://e-hentai.org/favicon.ico",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": true,
    "hasCloudflare": false,
    "sourceCodeUrl": "https://raw.githubusercontent.com/vzpyr/mangayomi/main/js/manga/src/all/ehentai.js",
    "apiUrl": "https://api.e-hentai.org/api.php",
    "version": "1.0.0",
    "isManga": true,
    "itemType": 0,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "manga/src/all/ehentai.js"
  }
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.defaultBaseUrl = "https://e-hentai.org";
  }

  getBaseUrl() {
    try {
      var pref = new SharedPreferences().get("ehentai_pref_domain");
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
    var cookieStr = "nw=1";

    try {
      var customCookie = new SharedPreferences().get("ehentai_pref_cookie");
      if (customCookie && typeof customCookie === "string" && customCookie.trim().length > 0) {
        cookieStr += "; " + customCookie.trim();
      }
    } catch (e) {}

    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: base + "/",
      Cookie: cookieStr,
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
      .replace(/\s+/g, " ")
      .trim();
  }

  extractGidAndToken(input) {
    if (!input) return null;
    var str = "";
    if (typeof input === "string") {
      str = input;
    } else if (typeof input === "object" && input !== null) {
      str = input.link || input.url || input.path || "";
    }
    str = String(str).trim();

    var m = str.match(/(?:https?:\/\/[^\/]+)?\/(?:g|s|mpv)\/([a-zA-Z0-9]+)[\/-]([a-zA-Z0-9]+)/i);
    if (m) {
      var p1 = m[1];
      var p2 = m[2];
      if (/^\d+$/.test(p1)) return [parseInt(p1), p2];
      if (/^\d+$/.test(p2)) return [parseInt(p2), p1];
    }

    var m2 = str.match(/(\d+)[\/_]([a-zA-Z0-9]{8,15})/i);
    if (m2) return [parseInt(m2[1]), m2[2]];

    return null;
  }

  parseGalleryList(html) {
    var list = [];
    if (!html) return list;

    var rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    var rowMatch;
    var seen = {};

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      var rowContent = rowMatch[1];
      var linkM = rowContent.match(/href=["'](https?:\/\/[^\/]+)?(\/g\/(\d+)\/([a-zA-Z0-9]+)\/?)["']/i);
      var titleM = rowContent.match(/class=["']glink["']>([\s\S]*?)<\/div>/i);
      var imgM = rowContent.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i);

      if (linkM && titleM) {
        var gid = linkM[3];
        if (!seen[gid]) {
          seen[gid] = true;
          var link = linkM[2].endsWith("/") ? linkM[2] : linkM[2] + "/";
          list.push({
            name: this.cleanText(titleM[1]),
            imageUrl: imgM ? imgM[1] : "",
            link: link,
          });
        }
      }
    }

    if (list.length === 0) {
      var linkRegex = /<a[^>]+href=["'](https?:\/\/[^\/]+)?(\/g\/(\d+)\/([a-zA-Z0-9]+)\/?)["'][^>]*>([\s\S]*?)<\/a>/gi;
      var match;

      while ((match = linkRegex.exec(html)) !== null) {
        var path = match[2];
        var gId = match[3];
        var inner = match[5];

        if (seen[gId]) continue;

        var tMatch =
          inner.match(/class=["']glink["']>([\s\S]*?)<\/div>/i) ||
          inner.match(/alt=["']([^"']+)["']/i);

        if (tMatch) {
          seen[gId] = true;
          var iMatch = inner.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i);
          list.push({
            name: this.cleanText(tMatch[1]),
            imageUrl: iMatch ? iMatch[1] : "",
            link: path.endsWith("/") ? path : path + "/",
          });
        }
      }
    }

    return list;
  }

  async getPopular(page) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();
    var url = page === 1 ? base + "/popular" : base + "/?page=" + (page - 1);
    var res = await this.client.get(url, this.getHeaders(url));
    var list = this.parseGalleryList(res ? res.body : "");
    var hasNextPage = page < 50 && list.length >= 10;
    return { list: list, hasNextPage: hasNextPage };
  }

  async getLatestUpdates(page) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();
    var url = base + "/?page=" + (page - 1);
    var res = await this.client.get(url, this.getHeaders(url));
    var list = this.parseGalleryList(res ? res.body : "");
    var hasNextPage = list.length >= 10;
    return { list: list, hasNextPage: hasNextPage };
  }

  async search(query, page, filters) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();
    var params = ["page=" + (page - 1)];

    var qParts = [];
    if (query && typeof query === "string" && query.trim().length > 0) {
      qParts.push(query.trim());
    }

    var categoryBits = {
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

    var disabledCatsMask = 0;

    if (filters && Array.isArray(filters)) {
      for (var i = 0; i < filters.length; i++) {
        var f = filters[i];
        if (!f) continue;

        if (f.name === "Language" && f.values && f.values[f.state]) {
          var langVal = f.values[f.state].value;
          if (langVal && langVal !== "all") {
            qParts.push("language:" + langVal);
          }
        } else if (f.name === "Minimum Rating" && f.values && f.values[f.state]) {
          var minR = f.values[f.state].value;
          if (minR && minR !== "0") {
            params.push("f_sr=on");
            params.push("f_srdd=" + minR);
          }
        } else if (f.name === "Categories" && Array.isArray(f.state)) {
          for (var c = 0; c < f.state.length; c++) {
            var catItem = f.state[c];
            if (catItem.state === false && categoryBits[catItem.name]) {
              disabledCatsMask += categoryBits[catItem.name];
            }
          }
        }
      }
    }

    if (disabledCatsMask > 0) {
      params.push("f_cats=" + disabledCatsMask);
    }

    if (qParts.length > 0) {
      params.push("f_search=" + encodeURIComponent(qParts.join(" ")));
    }

    var searchUrl = base + "/?" + params.join("&");
    var res = await this.client.get(searchUrl, this.getHeaders(searchUrl));
    var list = this.parseGalleryList(res ? res.body : "");
    var hasNextPage = list.length >= 10;
    return { list: list, hasNextPage: hasNextPage };
  }

  async getDetail(url) {
    var extracted = this.extractGidAndToken(url);
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

    var gid = extracted[0];
    var token = extracted[1];
    var base = this.getBaseUrl();
    var detailUrl = base + "/g/" + gid + "/" + token + "/";

    var res = await this.client.get(detailUrl, this.getHeaders(detailUrl));
    var html = res ? res.body : "";

    var title = "";
    var imageUrl = "";
    var author = "";
    var artist = "";
    var genres = [];
    var descriptionParts = [];
    var postedDate = null;
    var uploader = "";

    if (html) {
      var hMatch =
        html.match(/<h1[^>]+id=["']gn["'][^>]*>([\s\S]*?)<\/h1>/i) ||
        html.match(/<h1[^>]+id=["']gj["'][^>]*>([\s\S]*?)<\/h1>/i) ||
        html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (hMatch) title = this.cleanText(hMatch[1]);

      var imgM =
        html.match(/<div[^>]+id=["']gd1["'][^>]*>[\s\S]*?<div[^>]+style=["'][^"']*url\(([^)]+)\)[^"']*["']/i) ||
        html.match(/<div[^>]+id=["']gd1["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
      if (imgM) imageUrl = imgM[1].replace(/['"]/g, "");

      var tagRegex = /<a[^>]+id=["']ta_([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      var tMatch;
      while ((tMatch = tagRegex.exec(html)) !== null) {
        var rawTag = tMatch[1].replace(/_/g, " ");
        var tagName = this.cleanText(tMatch[2]);
        var fullTag = rawTag.includes(":") ? rawTag : (tagName || rawTag);

        if (fullTag.startsWith("artist:")) {
          artist = fullTag.replace(/^artist:/, "").trim();
          if (!author) author = artist;
        } else if (fullTag.startsWith("group:") && !author) {
          author = fullTag.replace(/^group:/, "").trim();
        }

        if (genres.indexOf(fullTag) === -1) {
          genres.push(fullTag);
        }
      }

      var uploaderMatch = html.match(/<div[^>]+id=["']gdn["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
      if (uploaderMatch) {
        uploader = this.cleanText(uploaderMatch[1]);
        if (!author) author = uploader;
      }

      var catMatch = html.match(/<div[^>]+id=["']gdc["'][^>]*>[\s\S]*?<div[^>]+class=["'][^"']*cs[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      if (catMatch) {
        var catName = this.cleanText(catMatch[1]);
        if (catName && genres.indexOf(catName) === -1) {
          genres.unshift(catName);
        }
      }

      var dateMatch = html.match(/<td[^>]+class=["']gdt1["'][^>]*>Posted:<\/td>\s*<td[^>]+class=["']gdt2["'][^>]*>([\s\S]*?)<\/td>/i);
      if (dateMatch) {
        var dateStr = this.cleanText(dateMatch[1]);
        if (dateStr) {
          postedDate = String(new Date(dateStr + " UTC").getTime());
        }
      }

      var lengthMatch = html.match(/<td[^>]+class=["']gdt1["'][^>]*>Length:<\/td>\s*<td[^>]+class=["']gdt2["'][^>]*>([\s\S]*?)<\/td>/i);
      if (lengthMatch) {
        descriptionParts.push("Pages: " + this.cleanText(lengthMatch[1]));
      }

      var ratingMatch = html.match(/<td[^>]+id=["']rating_label["'][^>]*>([\s\S]*?)<\/td>/i);
      if (ratingMatch) {
        descriptionParts.push("Rating: " + this.cleanText(ratingMatch[1]));
      }
    }

    var chapters = [
      {
        name: "Chapter 1",
        url: "/g/" + gid + "/" + token + "/",
        dateUpload: postedDate || String(Date.now()),
        scanlator: uploader || author || "",
      },
    ];

    return {
      name: title || "Gallery " + gid,
      imageUrl: imageUrl,
      link: detailUrl,
      description: descriptionParts.join("\n"),
      author: author,
      artist: artist,
      genre: genres,
      status: 1,
      chapters: chapters,
    };
  }

  async getPageList(url) {
    var extracted = this.extractGidAndToken(url);
    if (!extracted) {
      return [];
    }

    var gid = extracted[0];
    var token = extracted[1];
    var base = this.getBaseUrl();
    var readerPageUrls = [];
    var page = 0;
    var maxThumbPages = 10;

    while (page < maxThumbPages) {
      var thumbPageUrl = base + "/g/" + gid + "/" + token + "/?p=" + page;
      var res = await this.client.get(thumbPageUrl, this.getHeaders(thumbPageUrl));
      if (!res || !res.body) break;

      var html = res.body;
      var readerRegex = /(?:https?:\/\/[^\/]+)?\/s\/([a-zA-Z0-9]+)\/(\d+)-(\d+)/g;
      var rMatch;
      var pageFoundCount = 0;

      while ((rMatch = readerRegex.exec(html)) !== null) {
        var readerLink = base + "/s/" + rMatch[1] + "/" + rMatch[2] + "-" + rMatch[3];
        if (readerPageUrls.indexOf(readerLink) === -1) {
          readerPageUrls.push(readerLink);
          pageFoundCount++;
        }
      }

      if (pageFoundCount === 0 || (!html.includes("onclick=\"return false\">" + (page + 2) + "</a>") && !html.includes("?p=" + (page + 1)))) {
        break;
      }

      page++;
    }

    var images = [];
    var batchSize = 10;

    for (var b = 0; b < readerPageUrls.length; b += batchSize) {
      var batch = readerPageUrls.slice(b, b + batchSize);
      var batchPromises = batch.map(async (rUrl) => {
        try {
          var rRes = await this.client.get(rUrl, this.getHeaders(rUrl));
          if (rRes && rRes.body) {
            var imgM = rRes.body.match(/<img[^>]+id=["']img["'][^>]+src=["']([^"']+)["']/i);
            if (imgM) return imgM[1];
          }
        } catch (e) {}
        return null;
      });

      var batchResults = await Promise.all(batchPromises);
      for (var r = 0; r < batchResults.length; r++) {
        if (batchResults[r]) {
          images.push(batchResults[r]);
        }
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
          { type_name: "SelectOption", name: "Portuguese", value: "portuguese" },
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
          summary: "Paste custom member cookie (e.g. ipb_member_id=...; ipb_pass_hash=...)",
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
