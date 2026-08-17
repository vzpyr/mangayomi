const mangayomiSources = [
  {
    "name": "Comick",
    "langs": ["all", "en", "pt-br", "ru", "fr", "es-419", "pl", "tr", "it", "es", "id", "hu", "vi", "zh-hk", "ar", "de", "zh", "ca", "bg", "th", "fa", "uk", "mn", "ro", "he", "ms", "tl", "ja", "hi", "my", "ko", "cs", "pt", "nl", "sv", "bn", "no", "lt", "el", "sr", "da"],
    "ids": {
      "all": 370890607,
      "en": 955190069,
      "pt-br": 494197461,
      "ru": 1050814052,
      "fr": 380505196,
      "es-419": 296390197,
      "pl": 242913014,
      "tr": 507059585,
      "it": 851891714,
      "es": 115169439,
      "id": 719269008,
      "hu": 719759654,
      "vi": 301477894,
      "zh-hk": 113594984,
      "ar": 602472856,
      "de": 401493183,
      "zh": 752155292,
      "ca": 1069764002,
      "bg": 678531099,
      "th": 311480598,
      "fa": 141560456,
      "uk": 8261465,
      "mn": 565474938,
      "ro": 533803532,
      "he": 459976450,
      "ms": 375702775,
      "tl": 737984097,
      "ja": 796489006,
      "hi": 683471552,
      "my": 778623467,
      "ko": 1065236294,
      "cs": 422767524,
      "pt": 678647945,
      "nl": 698202010,
      "sv": 359879447,
      "bn": 532878423,
      "no": 481504622,
      "lt": 112887841,
      "el": 824905526,
      "sr": 373675453,
      "da": 574420905
    },
    "baseUrl": "https://comick.art",
    "apiUrl": "https://comick.art",
    "iconUrl": "https://comick.art/favicon.ico",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "https://raw.githubusercontent.com/vzpyr/mangayomi/main/js/manga/src/all/comick.js",
    "typeSource": "single",
    "itemType": 0,
    "isManga": true,
    "version": "1.0.0",
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "manga/src/all/comick.js"
  }
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.defaultBaseUrl = "https://comick.art";
  }

  getBaseUrl() {
    try {
      var pref = new SharedPreferences().get("comick_pref_domain");
      if (pref && typeof pref === "string" && pref.trim().length > 0) {
        return pref.trim().replace(/\/+$/, "");
      }
    } catch (e) {}
    if (this.source && this.source.baseUrl) {
      return this.source.baseUrl.replace(/\/+$/, "");
    }
    return this.defaultBaseUrl;
  }

  getHeaders() {
    var base = this.getBaseUrl();
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: base + "/",
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
    var title = item.title || item.slug || "";
    var imageUrl =
      item.default_thumbnail ||
      item.thumbnail ||
      item.cover_url ||
      (item.md_covers && item.md_covers[0] && item.md_covers[0].b2key
        ? "https://cdn1.comicknew.pictures/" + item.md_covers[0].b2key
        : "");
    var link = item.slug || item.hid || "";
    return {
      name: title,
      imageUrl: imageUrl,
      link: link,
    };
  }

  async getPopular(page) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();
    var list = [];
    var hasNextPage = false;

    if (page <= 3) {
      var days = page === 1 ? 7 : page === 2 ? 30 : 90;
      var topUrl = base + "/api/comics/top?days=" + days + "&type=follow";
      try {
        var res = await this.client.get(topUrl, this.getHeaders());
        if (res && res.statusCode === 200 && res.body) {
          var data = JSON.parse(res.body);
          var items = data.data || data || [];
          for (var i = 0; i < items.length; i++) {
            list.push(this.formatComicItem(items[i]));
          }
          hasNextPage = list.length > 0;
        }
      } catch (e) {}
    }

    if (list.length === 0 || page > 3) {
      var searchUrl =
        base +
        "/api/search?page=" +
        page +
        "&order_by=user_follow_count&order_direction=desc&type=comic";
      var sRes = await this.client.get(searchUrl, this.getHeaders());
      if (sRes && sRes.statusCode === 200 && sRes.body) {
        var sData = JSON.parse(sRes.body);
        var sItems = sData.data || sData || [];
        for (var j = 0; j < sItems.length; j++) {
          list.push(this.formatComicItem(sItems[j]));
        }
        hasNextPage = Boolean(sData.next_cursor || sItems.length >= 20);
      }
    }

    return { list: list, hasNextPage: hasNextPage };
  }

  async getLatestUpdates(page) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();
    var url = base + "/api/chapters/latest?order=new&page=" + page;
    var res = await this.client.get(url, this.getHeaders());
    var list = [];
    var hasNextPage = false;

    if (res && res.statusCode === 200 && res.body) {
      var data = JSON.parse(res.body);
      var items = data.data || data || [];
      for (var i = 0; i < items.length; i++) {
        list.push(this.formatComicItem(items[i]));
      }
      hasNextPage = items.length >= 20;
    }

    return { list: list, hasNextPage: hasNextPage };
  }

  async search(query, page, filters) {
    page = parseInt(page) || 1;
    var base = this.getBaseUrl();
    var params = ["page=" + page, "type=comic"];

    if (query && typeof query === "string" && query.trim().length > 0) {
      params.push("q=" + encodeURIComponent(query.trim()));
    }

    var orderBy = "user_follow_count";
    var orderDir = "desc";

    if (filters && Array.isArray(filters)) {
      for (var i = 0; i < filters.length; i++) {
        var f = filters[i];
        if (!f) continue;

        if (f.type_name === "SelectFilter" || f.type === "SortFilter") {
          if (f.name === "Sort" && f.values && f.values[f.state]) {
            orderBy = f.values[f.state].value || orderBy;
          } else if (f.name === "Order" && f.values && f.values[f.state]) {
            orderDir = f.values[f.state].value || orderDir;
          } else if (f.name === "Status" && f.values && f.values[f.state]) {
            var st = f.values[f.state].value;
            if (st && st !== "0" && st !== "all") params.push("status=" + st);
          } else if (f.name === "Created at" && f.values && f.values[f.state]) {
            var tm = f.values[f.state].value;
            if (tm) params.push("time=" + tm);
          } else if (f.name === "Content Rating" && f.values && f.values[f.state]) {
            var cr = f.values[f.state].value;
            if (cr && cr !== "all") params.push("content_rating=" + cr);
          }
        } else if (f.type_name === "GroupFilter" || f.type === "GenreFilter") {
          if (f.name === "Genre" && Array.isArray(f.state)) {
            for (var g = 0; g < f.state.length; g++) {
              var genreItem = f.state[g];
              if (genreItem.state === 1) {
                params.push("genres=" + (genreItem.value || genreItem.name));
              } else if (genreItem.state === 2) {
                params.push("excludes=" + (genreItem.value || genreItem.name));
              }
            }
          } else if (f.name === "Demographic" && Array.isArray(f.state)) {
            for (var d = 0; d < f.state.length; d++) {
              var demoItem = f.state[d];
              if (demoItem.state === 1 || demoItem.state === true) {
                params.push("demographic=" + (demoItem.value || demoItem.name));
              }
            }
          } else if (f.name === "Type" && Array.isArray(f.state)) {
            for (var t = 0; t < f.state.length; t++) {
              var typeItem = f.state[t];
              if (typeItem.state === 1 || typeItem.state === true) {
                params.push("country=" + (typeItem.value || typeItem.name));
              }
            }
          }
        } else if (f.type_name === "TextFilter") {
          if (f.name === "Minimum Chapters" && f.state) {
            params.push("minimum=" + encodeURIComponent(f.state));
          } else if (f.name === "Tags" && f.state) {
            params.push("tags=" + encodeURIComponent(f.state));
          }
        }
      }
    }

    params.push("order_by=" + orderBy);
    params.push("order_direction=" + orderDir);

    var searchUrl = base + "/api/search?" + params.join("&");
    var res = await this.client.get(searchUrl, this.getHeaders());
    var list = [];
    var hasNextPage = false;

    if (res && res.statusCode === 200 && res.body) {
      var data = JSON.parse(res.body);
      var items = data.data || data || [];
      for (var k = 0; k < items.length; k++) {
        list.push(this.formatComicItem(items[k]));
      }
      hasNextPage = Boolean(data.next_cursor || items.length >= 20);
    }

    return { list: list, hasNextPage: hasNextPage };
  }

  beautifyChapterName(vol, chap, title) {
    var result = "";
    if (vol && String(vol).trim() !== "" && String(vol).trim() !== "null") {
      result += "Vol. " + String(vol).trim() + " ";
    }
    if (chap && String(chap).trim() !== "" && String(chap).trim() !== "null") {
      result += "Ch. " + String(chap).trim();
    }
    if (title && String(title).trim() !== "" && String(title).trim() !== "null") {
      if (result.length > 0) {
        result += " : " + String(title).trim();
      } else {
        result += String(title).trim();
      }
    }
    return result.trim() || ("Chapter " + (chap || ""));
  }

  async getDetail(url) {
    var slug = url;
    if (typeof slug === "object" && slug !== null) {
      slug = slug.link || slug.url || slug.slug || "";
    }
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

    var base = this.getBaseUrl();
    var detailUrl = base + "/comic/" + slug;
    var res = await this.client.get(detailUrl, this.getHeaders());
    if (!res || res.statusCode !== 200 || !res.body) {
      throw new Error("Failed to load comic details for " + slug);
    }

    var html = res.body;
    var comicDataMatch = html.match(/<script[^>]*id=["']comic-data["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!comicDataMatch) {
      throw new Error("comic-data not found for " + slug);
    }

    var data = JSON.parse(comicDataMatch[1]);
    var canonicalSlug = data.slug || slug;
    var title = data.title || slug;
    var imageUrl = data.default_thumbnail || data.thumbnail || "";

    var descParts = [];
    if (data.desc) {
      descParts.push(this.cleanHtml(data.desc));
    }
    if (Array.isArray(data.md_titles) && data.md_titles.length > 0) {
      var altTitles = data.md_titles.map(function(t) { return t.title; }).filter(Boolean);
      if (altTitles.length > 0) {
        descParts.push("\n\nAlternative Titles:\n- " + altTitles.join("\n- "));
      }
    } else if (Array.isArray(data.titles) && data.titles.length > 0) {
      var altTitlesOld = data.titles.map(function(t) { return t.title; }).filter(Boolean);
      if (altTitlesOld.length > 0) {
        descParts.push("\n\nAlternative Titles:\n- " + altTitlesOld.join("\n- "));
      }
    }

    var genres = [];
    if (data.country === "jp" || data.country === "JP") genres.push("Manga");
    else if (data.country === "kr" || data.country === "KR") genres.push("Manhwa");
    else if (data.country === "cn" || data.country === "CN") genres.push("Manhua");

    if (data.demographic_name && typeof data.demographic_name === "string" && data.demographic_name.trim().length > 0) {
      genres.push(data.demographic_name.trim());
    }

    if (Array.isArray(data.md_comic_md_genres)) {
      for (var g = 0; g < data.md_comic_md_genres.length; g++) {
        var gItem = data.md_comic_md_genres[g];
        var gName = (gItem.md_genres && gItem.md_genres.name) ? gItem.md_genres.name : (gItem.name || "");
        if (gName && genres.indexOf(gName) === -1) {
          genres.push(gName);
        }
      }
    } else if (Array.isArray(data.genres)) {
      for (var og = 0; og < data.genres.length; og++) {
        var ogItem = data.genres[og];
        var ogName = ogItem.genres ? ogItem.genres.name : ogItem.name;
        if (ogName && genres.indexOf(ogName) === -1) {
          genres.push(ogName);
        }
      }
    }

    var status = 5;
    if (data.status === 1) status = 0;
    else if (data.status === 2) status = data.translation_completed ? 1 : 4;
    else if (data.status === 3) status = 3;
    else if (data.status === 4) status = 2;

    var author = (data.authors || []).map(function(a) { return a.name; }).join(", ");
    var artist = (data.artists || []).map(function(a) { return a.name; }).join(", ");

    var lang = (this.source && this.source.lang) ? this.source.lang : "en";
    var chapters = [];
    var page = 1;
    var lastPage = 1;
    var maxPages = 20;

    do {
      var chapUrl = base + "/api/comics/" + canonicalSlug + "/chapter-list?page=" + page;
      if (lang && lang !== "all") {
        chapUrl += "&lang=" + encodeURIComponent(lang);
      }
      var cRes = await this.client.get(chapUrl, this.getHeaders());
      if (cRes && cRes.statusCode === 200 && cRes.body) {
        var cData = JSON.parse(cRes.body);
        var chapItems = cData.data || [];
        for (var c = 0; c < chapItems.length; c++) {
          var ch = chapItems[c];
          var chapName = this.beautifyChapterName(ch.vol, ch.chap, ch.title);
          var scanlators = [];
          if (Array.isArray(ch.group_name)) {
            scanlators = ch.group_name.filter(Boolean);
          } else if (ch.group_name) {
            scanlators = [ch.group_name];
          }

          var chapUrlPath = "/comic/" + canonicalSlug + "/" + ch.hid + "-chapter-" + ch.chap + "-" + ch.lang;
          var dateUpload = null;
          if (ch.created_at) {
            dateUpload = String(new Date(ch.created_at).getTime());
          } else if (ch.publish_at) {
            dateUpload = String(new Date(ch.publish_at).getTime());
          }

          chapters.push({
            name: chapName,
            url: chapUrlPath,
            dateUpload: dateUpload,
            scanlator: scanlators.join(", "),
          });
        }
        if (cData.pagination && cData.pagination.last_page) {
          lastPage = cData.pagination.last_page;
        } else {
          lastPage = 1;
        }
      } else {
        break;
      }
      page++;
    } while (page <= lastPage && page <= maxPages);

    return {
      name: title,
      imageUrl: imageUrl,
      description: descParts.join(""),
      author: author,
      artist: artist,
      genre: genres,
      status: status,
      link: base + "/comic/" + canonicalSlug,
      chapters: chapters,
    };
  }

  async getPageList(url) {
    var path = url;
    if (typeof path === "object" && path !== null) {
      path = path.url || path.link || "";
    }
    var base = this.getBaseUrl();
    var targetUrl = path.startsWith("http")
      ? path
      : base + (path.startsWith("/") ? "" : "/") + path;

    var res = await this.client.get(targetUrl, this.getHeaders());
    if (!res || res.statusCode !== 200 || !res.body) {
      throw new Error("Failed to load chapter reader page for " + targetUrl);
    }

    var html = res.body;
    var svMatch = html.match(/<script[^>]*id=["']sv-data["'][^>]*>([\s\S]*?)<\/script>/i);
    var pages = [];

    if (svMatch) {
      var svData = JSON.parse(svMatch[1]);
      var images = (svData.chapter && svData.chapter.images) ? svData.chapter.images : [];
      for (var i = 0; i < images.length; i++) {
        var img = images[i];
        if (img && img.url) {
          pages.push({
            url: img.url,
            headers: {
              Referer: base + "/",
            },
          });
        }
      }
    }

    if (pages.length === 0) {
      var imgRegex = /https?:\/\/[^\s"'<>]+\.(?:webp|jpg|jpeg|png)/gi;
      var match;
      var seen = {};
      while ((match = imgRegex.exec(html)) !== null) {
        var u = match[0];
        if ((u.includes("pictures") || u.includes("meo") || u.includes("chapter")) && !u.includes("covers") && !u.includes("logo") && !seen[u]) {
          seen[u] = true;
          pages.push({
            url: u,
            headers: {
              Referer: base + "/",
            },
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
          { type_name: "SelectOption", name: "Most Popular / Follows", value: "user_follow_count" },
          { type_name: "SelectOption", name: "Last Updated", value: "uploaded" },
          { type_name: "SelectOption", name: "Newest", value: "created_at" },
          { type_name: "SelectOption", name: "Highest Rating", value: "rating" },
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
          { type_name: "CheckBox", name: "Manga (JP)", value: "jp", state: false },
          { type_name: "CheckBox", name: "Manhwa (KR)", value: "kr", state: false },
          { type_name: "CheckBox", name: "Manhua (CN)", value: "cn", state: false },
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
        ].map(function (x) {
          return { type_name: "TriState", name: x[0], value: x[1], state: 0 };
        }),
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
