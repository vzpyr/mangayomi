var mangayomiSources = [
  {
    "name": "FireAnime",
    "id": 1159020974,
    "baseUrl": "https://fireani.me",
    "lang": "de",
    "typeSource": "single",
    "iconUrl": "https://fireani.me/favicon.ico",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "https://raw.githubusercontent.com/vzpyr/mangayomi/main/js/anime/src/de/fireanime.js",
    "apiUrl": "https://fireani.me",
    "version": "1.0.0",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "anime/src/de/fireanime.js"
  }
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.baseUrl = "https://fireani.me";
    this.b64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  }

  getPreference(key) {
    try {
      return new SharedPreferences().get(key);
    } catch (e) {
      return null;
    }
  }

  getHeaders() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Content-Type": "application/json",
      Accept: "application/json",
      Referer: this.baseUrl + "/",
      Origin: this.baseUrl,
    };
  }

  base64Decode(input) {
    var str = String(input).replace(/=+$/, "");
    var output = "";
    if (str.length % 4 === 1) {
      return "";
    }
    for (
      var bc = 0, bs, buffer, idx = 0;
      (buffer = str.charAt(idx++));
      ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
        ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
        : 0
    ) {
      buffer = this.b64Chars.indexOf(buffer);
    }
    return output;
  }

  base64DecodeUtf8(input) {
    var bytes = this.base64Decode(input);
    var out = "";
    var i = 0;
    while (i < bytes.length) {
      var c = bytes.charCodeAt(i++);
      if (c <= 127) {
        out += String.fromCharCode(c);
      } else if (c > 191 && c < 224) {
        var c2 = bytes.charCodeAt(i++);
        out += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
      } else if (c > 223 && c < 240) {
        var c2 = bytes.charCodeAt(i++);
        var c3 = bytes.charCodeAt(i++);
        out += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
      }
    }
    return out;
  }

  rot13(str) {
    return str.replace(/[a-zA-Z]/g, function (c) {
      var base = c <= "Z" ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26 + base));
    });
  }

  decryptVoePayload(encodedStr) {
    try {
      var step1 = this.rot13(encodedStr);
      var patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
      for (var i = 0; i < patterns.length; i++) {
        step1 = step1.split(patterns[i]).join("");
      }
      var step2 = this.base64Decode(step1);
      var step3 = "";
      for (var j = 0; j < step2.length; j++) {
        step3 += String.fromCharCode(step2.charCodeAt(j) - 3);
      }
      var step4 = step3.split("").reverse().join("");
      var step5 = this.base64DecodeUtf8(step4);
      return JSON.parse(step5);
    } catch (e) {
      return null;
    }
  }

  async rpc(service, method, payload) {
    payload = payload || {};
    var url = this.baseUrl + "/" + service + "/" + method;
    var res = await this.client.post(url, this.getHeaders(), payload);
    if (!res || (res.statusCode && res.statusCode !== 200)) {
      throw new Error("RPC error " + service + "/" + method);
    }
    return JSON.parse(res.body);
  }

  formatAnimeItem(item) {
    var title = item.title || item.slug;
    var imageUrl = item.poster
      ? this.baseUrl + "/img/posters/" + item.poster
      : "";
    var link = item.slug;
    return { name: title, imageUrl: imageUrl, link: link };
  }

  async getPopular(page) {
    var self = this;
    page = parseInt(page) || 1;
    var limit = 24;
    var data = await this.rpc("api.v1.AnimeSearchService", "SearchAnimes", {
      page: page,
      limit: limit,
      order_by: "vote_count",
      order_dir: "desc",
    });

    var list = (data.data || []).map(function (item) {
      return self.formatAnimeItem(item);
    });
    var hasNextPage = (data.data || []).length >= limit;
    return { list: list, hasNextPage: hasNextPage };
  }

  async getLatestUpdates(page) {
    var self = this;
    page = parseInt(page) || 1;
    var limit = 24;
    var data = await this.rpc("api.v1.AnimeSearchService", "SearchAnimes", {
      page: page,
      limit: limit,
      order_by: "created_at",
      order_dir: "desc",
    });

    var list = (data.data || []).map(function (item) {
      return self.formatAnimeItem(item);
    });
    var hasNextPage = (data.data || []).length >= limit;
    return { list: list, hasNextPage: hasNextPage };
  }

  async search(query, page, filters) {
    var self = this;
    page = parseInt(page) || 1;
    var limit = 24;
    var payload = {
      page: page,
      limit: limit,
    };

    if (query && typeof query === "string" && query.trim().length > 0) {
      payload.q = query.trim();
    }

    if (filters && Array.isArray(filters)) {
      for (var i = 0; i < filters.length; i++) {
        var f = filters[i];
        if (f.name === "Genre" && f.values && f.values[f.state]) {
          var genreVal = f.values[f.state].value;
          if (genreVal && genreVal !== "All") {
            payload.genres = [genreVal];
          }
        }
        if (f.name === "Sort" && f.values && f.values[f.state]) {
          payload.order_by = f.values[f.state].value;
        }
        if (f.name === "Order" && f.values && f.values[f.state]) {
          payload.order_dir = f.values[f.state].value;
        }
      }
    }

    var data = await this.rpc(
      "api.v1.AnimeSearchService",
      "SearchAnimes",
      payload
    );
    var list = (data.data || []).map(function (item) {
      return self.formatAnimeItem(item);
    });
    var hasNextPage = (data.data || []).length >= limit;
    return { list: list, hasNextPage: hasNextPage };
  }

  async getDetail(url) {
    var slug = url;
    if (typeof slug === "object" && slug !== null) {
      slug = slug.link || slug.url || slug.slug || "";
    }
    if (typeof slug === "string") {
      if (slug.includes("/anime/")) {
        slug = slug.split("/anime/")[1].split("?")[0].split("/")[0];
      }
    }

    var res = await this.rpc("api.v1.anime.AnimeService", "GetAnime", {
      slug: slug,
    });
    var data = res.data;
    if (!data) throw new Error("Anime not found");

    var episodes = [];
    var seasons = data.animeSeasons || [];
    for (var s = 0; s < seasons.length; s++) {
      var season = seasons[s];
      var seasonNr = season.season;
      var eps = season.animeEpisodes || [];
      for (var e = 0; e < eps.length; e++) {
        var ep = eps[e];
        var epNr = ep.episode;
        var epPayload = JSON.stringify({
          slug: data.slug,
          season: String(seasonNr),
          episode: String(epNr),
        });
        var epDate = ep.createdAt
          ? String(new Date(ep.createdAt).getTime())
          : null;

        var scanlator = [];
        if (ep.hasGerDub) scanlator.push("GerDub");
        if (ep.hasGerSub) scanlator.push("GerSub");
        if (ep.hasEngSub) scanlator.push("EngSub");

        episodes.push({
          name: "Staffel " + seasonNr + " Folge " + epNr,
          url: epPayload,
          dateUpload: epDate,
          scanlator: scanlator.join(", "),
        });
      }
    }

    var descParts = [];
    if (data.desc) {
      descParts.push(data.desc);
    }
    if (data.alternateTitles) {
      descParts.push("\n\nAlternative Titel: " + data.alternateTitles.replace("Animes Stream: ", ""));
    }
    if (data.voteAvg) {
      var ratingInfo = "\nBewertung: " + data.voteAvg;
      if (data.voteCount) ratingInfo += " (" + data.voteCount + " Stimmen)";
      descParts.push(ratingInfo);
    }
    if (data.start) {
      var yearInfo = "\nJahr: " + data.start + (data.end && data.end !== data.start ? " - " + data.end : "");
      descParts.push(yearInfo);
    }

    var currentYear = new Date().getFullYear();
    var status = 0;
    if (data.end && parseInt(data.end) > 0 && parseInt(data.end) <= currentYear) {
      status = 1;
    }

    return {
      name: data.title || data.slug,
      imageUrl: data.poster
        ? this.baseUrl + "/img/posters/" + data.poster
        : "",
      description: descParts.join(""),
      genre: data.generes || [],
      status: status,
      author: "FireAnime",
      artist: "",
      link: this.baseUrl + "/anime/" + data.slug,
      episodes: episodes,
    };
  }

  async extractVoe(rawUrl, langTag) {
    var videos = [];
    var headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Referer: this.baseUrl + "/",
    };

    var id = "";
    var mId = rawUrl.match(/\/e\/([a-zA-Z0-9]+)/);
    if (mId) {
      id = mId[1];
    }

    var domains = ["rebeccapracticeloss.com", "voe.sx", "tubesquid.com"];
    var urlsToTry = [];
    if (id) {
      for (var d = 0; d < domains.length; d++) {
        urlsToTry.push("https://" + domains[d] + "/e/" + id);
      }
    } else {
      urlsToTry.push(rawUrl);
    }

    var html = null;
    var successUrl = null;

    for (var u = 0; u < urlsToTry.length; u++) {
      var targetUrl = urlsToTry[u];
      try {
        var res = await this.client.get(targetUrl, headers);
        if (
          res &&
          res.statusCode === 200 &&
          res.body &&
          res.body.length > 500
        ) {
          html = res.body;
          successUrl = targetUrl;
          if (html.includes("window.location.href")) {
            var mRedirect = html.match(
              /window\.location\.href\s*=\s*['"]([^'"]+)['"]/
            );
            if (mRedirect) {
              var redirectRes = await this.client.get(
                mRedirect[1],
                headers
              );
              if (redirectRes && redirectRes.statusCode === 200) {
                html = redirectRes.body;
                successUrl = mRedirect[1];
              }
            }
          }
          if (html.match(/\["([^"]{100,})"\]/)) {
            break;
          }
        }
      } catch (e) {}
    }

    if (!html) return [];

    var payloadMatch = html.match(/\["([^"]{100,})"\]/);
    if (!payloadMatch) return [];

    var decrypted = this.decryptVoePayload(payloadMatch[1]);
    if (!decrypted) return [];

    var langLabel = langTag ? " (" + langTag + ")" : "";
    if (decrypted.source) {
      videos.push({
        url: decrypted.source,
        originalUrl: successUrl,
        quality: "VOE HLS" + langLabel,
        headers: { "User-Agent": headers["User-Agent"] },
      });
    }
    if (decrypted.direct_access_url) {
      videos.push({
        url: decrypted.direct_access_url,
        originalUrl: successUrl,
        quality: "VOE Direct MP4" + langLabel,
        headers: { "User-Agent": headers["User-Agent"] },
      });
    }

    return videos;
  }

  async getVideoList(url) {
    var slug = "";
    var season = "1";
    var episode = "1";

    if (typeof url === "object" && url !== null) {
      url = url.url || url.link || "";
    }

    if (typeof url === "string") {
      url = url.trim();
      if (url.startsWith("{")) {
        try {
          var parsed = JSON.parse(url);
          slug = parsed.slug || "";
          season = String(parsed.season || "1");
          episode = String(parsed.episode || "1");
        } catch (e) {}
      }
      if (!slug) {
        if (url.includes("/anime/")) {
          var parts = url.split("/anime/")[1].split("?")[0].split("/");
          slug = parts[0];
          for (var p = 0; p < parts.length; p++) {
            if (parts[p] === "watch" && parts[p + 1] && parts[p + 2]) {
              season = parts[p + 1];
              episode = parts[p + 2];
            } else if (parts[p] === "season" && parts[p + 1]) {
              season = parts[p + 1];
            } else if (parts[p] === "episode" && parts[p + 1]) {
              episode = parts[p + 1];
            }
          }
        } else if (url.includes("/")) {
          var parts = url.split("/");
          slug = parts[0];
          if (parts.length >= 3) {
            season = parts[1];
            episode = parts[2];
          } else if (parts.length === 2) {
            episode = parts[1];
          }
        } else {
          slug = url;
        }
      }
    }

    if (!slug) return [];

    var res = await this.rpc("api.v1.anime.AnimeService", "GetEpisode", {
      slug: slug,
      season: season,
      episode: episode,
    });

    var data = res.data;
    if (!data || !data.animeEpisodeLinks) return [];

    var videos = [];
    var links = data.animeEpisodeLinks;
    var prefLang = this.getPreference("fireanime_pref_lang") || "ger-dub";

    for (var i = 0; i < links.length; i++) {
      var linkItem = links[i];
      var rawLink = linkItem.link;
      var lang = linkItem.lang || "";
      var hoster = linkItem.name || "";

      if (
        rawLink.includes("voe.sx") ||
        rawLink.includes("/e/") ||
        hoster.toUpperCase() === "VOE"
      ) {
        var voeVideos = await this.extractVoe(rawLink, lang);
        for (var v = 0; v < voeVideos.length; v++) {
          videos.push(voeVideos[v]);
        }
      }
    }

    videos.sort(function (a, b) {
      var aMatch = a.quality.includes(prefLang) ? -1 : 1;
      var bMatch = b.quality.includes(prefLang) ? -1 : 1;
      return aMatch - bMatch;
    });

    return videos;
  }

  getFilterList() {
    var genres = [
      "All",
      "Action",
      "Actiondrama",
      "Abenteuer",
      "Alltagsleben",
      "Cyberpunk",
      "Dämonen",
      "Drama",
      "Ecchi",
      "EngSub",
      "Fantasy",
      "Fighting-Shounen",
      "Geistergeschichten",
      "Ger",
      "GerSub",
      "Gore",
      "Gourmet",
      "Harem",
      "Historisch",
      "Horror",
      "Isekai",
      "Josei",
      "Kids",
      "Komödie",
      "Krimi",
      "Magie",
      "Martial Arts",
      "Mecha",
      "Military",
      "Musik",
      "Mystery",
      "Parodie",
      "Postapokalyptisch",
      "Psychological",
      "Romanze",
      "School",
      "Sci-Fi",
      "Seinen",
      "Shoujo",
      "Slice of Life",
      "Space",
      "Splatter",
      "Sport",
      "Supernatural",
      "Superpower",
      "Thriller",
      "Übermäßige Gewaltdarstellung",
      "Vampire",
    ];

    return [
      {
        type_name: "SelectFilter",
        name: "Genre",
        state: 0,
        values: genres.map(function (g) {
          return {
            type_name: "SelectOption",
            name: g,
            value: g,
          };
        }),
      },
      {
        type_name: "SelectFilter",
        name: "Sort",
        state: 0,
        values: [
          ["Beliebtheit (Votes)", "vote_count"],
          ["Bewertung", "vote_avg"],
          ["Zuletzt Hinzugefügt", "created_at"],
          ["Zuletzt Aktualisiert", "updated_at"],
          ["Titel", "title"],
        ].map(function (x) {
          return {
            type_name: "SelectOption",
            name: x[0],
            value: x[1],
          };
        }),
      },
      {
        type_name: "SelectFilter",
        name: "Order",
        state: 0,
        values: [
          ["Absteigend (Z-A / High-Low)", "desc"],
          ["Aufsteigend (A-Z / Low-High)", "asc"],
        ].map(function (x) {
          return {
            type_name: "SelectOption",
            name: x[0],
            value: x[1],
          };
        }),
      },
    ];
  }

  getSourcePreferences() {
    return [
      {
        key: "fireanime_pref_lang",
        listPreference: {
          title: "Bevorzugte Sprache",
          summary: "Priorisierung von Audio / Untertiteln",
          valueIndex: 0,
          entries: [
            "German Dub (GerDub)",
            "German Sub (GerSub)",
            "English Sub (EngSub)",
          ],
          entryValues: ["ger-dub", "ger-sub", "eng-sub"],
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
