const mangayomiSources = [
  {
    name: "FireAnime",
    id: 1159020974,
    baseUrl: "https://fireani.me",
    lang: "de",
    typeSource: "single",
    iconUrl: "https://fireani.me/favicon.ico",
    dateFormat: "",
    dateFormatLocale: "",
    isNsfw: false,
    hasCloudflare: false,
    sourceCodeUrl:
      "https://raw.githubusercontent.com/vzpyr/mangayomi/main/js/anime/src/de/fireanime.js",
    apiUrl: "https://fireani.me",
    version: "1.0.1",
    isManga: false,
    itemType: 1,
    isFullData: false,
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes: "",
    pkgPath: "anime/src/de/fireanime.js",
  },
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.baseUrl = "https://fireani.me";
    this.b64Chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  }

  getPreference(key) {
    try {
      return new SharedPreferences().get(key);
    } catch (_) {
      return null;
    }
  }

  getHeaders() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Content-Type": "application/json",
      Accept: "application/json",
      Referer: `${this.baseUrl}/`,
      Origin: this.baseUrl,
    };
  }

  base64Decode(input) {
    const str = String(input).replace(/=+$/, "");
    let output = "";
    if (str.length % 4 === 1) return "";

    for (
      let bc = 0, bs, buffer, idx = 0;
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
    const bytes = this.base64Decode(input);
    let out = "";
    let i = 0;
    while (i < bytes.length) {
      const c = bytes.charCodeAt(i++);
      if (c <= 127) {
        out += String.fromCharCode(c);
      } else if (c > 191 && c < 224) {
        const c2 = bytes.charCodeAt(i++);
        out += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
      } else if (c > 223 && c < 240) {
        const c2 = bytes.charCodeAt(i++);
        const c3 = bytes.charCodeAt(i++);
        out += String.fromCharCode(
          ((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63),
        );
      }
    }
    return out;
  }

  rot13(str) {
    return str.replace(/[a-zA-Z]/g, (c) => {
      const base = c <= "Z" ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
    });
  }

  decryptVoePayload(encodedStr) {
    try {
      let step1 = this.rot13(encodedStr);
      const patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
      for (const pattern of patterns) {
        step1 = step1.split(pattern).join("");
      }
      const step2 = this.base64Decode(step1);
      let step3 = "";
      for (let j = 0; j < step2.length; j++) {
        step3 += String.fromCharCode(step2.charCodeAt(j) - 3);
      }
      const step4 = step3.split("").reverse().join("");
      const step5 = this.base64DecodeUtf8(step4);
      return JSON.parse(step5);
    } catch (_) {
      return null;
    }
  }

  async rpc(service, method, payload = {}) {
    const url = `${this.baseUrl}/${service}/${method}`;
    const res = await this.client.post(url, this.getHeaders(), payload);
    if (!res || (res.statusCode && res.statusCode !== 200)) {
      throw new Error(`RPC error ${service}/${method}`);
    }
    return JSON.parse(res.body);
  }

  formatAnimeItem(item) {
    const title = item.title || item.slug;
    const imageUrl = item.poster
      ? `${this.baseUrl}/img/posters/${item.poster}`
      : "";
    return { name: title, imageUrl, link: item.slug };
  }

  async getPopular(page) {
    const p = parseInt(page) || 1;
    const limit = 24;
    const data = await this.rpc("api.v1.AnimeSearchService", "SearchAnimes", {
      page: p,
      limit,
      order_by: "vote_count",
      order_dir: "desc",
    });

    const items = data.data || [];
    const list = items.map((item) => this.formatAnimeItem(item));
    return { list, hasNextPage: items.length >= limit };
  }

  async getLatestUpdates(page) {
    const p = parseInt(page) || 1;
    const limit = 24;
    const data = await this.rpc("api.v1.AnimeSearchService", "SearchAnimes", {
      page: p,
      limit,
      order_by: "created_at",
      order_dir: "desc",
    });

    const items = data.data || [];
    const list = items.map((item) => this.formatAnimeItem(item));
    return { list, hasNextPage: items.length >= limit };
  }

  async search(query, page, filters) {
    const p = parseInt(page) || 1;
    const limit = 24;
    const payload = { page: p, limit };

    if (query && typeof query === "string" && query.trim().length > 0) {
      payload.q = query.trim();
    }

    if (Array.isArray(filters)) {
      for (const f of filters) {
        if (!f) continue;
        if (f.name === "Genre" && f.values && f.values[f.state]) {
          const genreVal = f.values[f.state].value;
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

    const data = await this.rpc(
      "api.v1.AnimeSearchService",
      "SearchAnimes",
      payload,
    );
    const items = data.data || [];
    const list = items.map((item) => this.formatAnimeItem(item));
    return { list, hasNextPage: items.length >= limit };
  }

  async getDetail(url) {
    let slug =
      typeof url === "object" && url !== null
        ? url.link || url.url || url.slug || ""
        : url;
    if (typeof slug === "string" && slug.includes("/anime/")) {
      slug = slug.split("/anime/")[1].split("?")[0].split("/")[0];
    }

    const res = await this.rpc("api.v1.anime.AnimeService", "GetAnime", {
      slug,
    });
    const data = res.data;
    if (!data) throw new Error("Anime not found");

    const episodes = [];
    const seasons = data.animeSeasons || [];
    for (const season of seasons) {
      const seasonNr = season.season;
      const eps = season.animeEpisodes || [];
      for (const ep of eps) {
        const epNr = ep.episode;
        const epPayload = JSON.stringify({
          slug: data.slug,
          season: String(seasonNr),
          episode: String(epNr),
        });
        const epDate = ep.createdAt
          ? String(new Date(ep.createdAt).getTime())
          : null;

        const scanlator = [];
        if (ep.hasGerDub) scanlator.push("GerDub");
        if (ep.hasGerSub) scanlator.push("GerSub");
        if (ep.hasEngSub) scanlator.push("EngSub");

        episodes.push({
          name: `Staffel ${seasonNr} Folge ${epNr}`,
          url: epPayload,
          dateUpload: epDate,
          scanlator: scanlator.join(", "),
        });
      }
    }

    const descParts = [];
    if (data.desc) descParts.push(data.desc);
    if (data.alternateTitles) {
      descParts.push(
        `\n\nAlternative Titel: ${data.alternateTitles.replace("Animes Stream: ", "")}`,
      );
    }
    if (data.voteAvg) {
      let ratingInfo = `\nBewertung: ${data.voteAvg}`;
      if (data.voteCount) ratingInfo += ` (${data.voteCount} Stimmen)`;
      descParts.push(ratingInfo);
    }
    if (data.start) {
      descParts.push(
        `\nJahr: ${data.start}${data.end && data.end !== data.start ? ` - ${data.end}` : ""}`,
      );
    }

    const currentYear = new Date().getFullYear();
    const status =
      data.end && parseInt(data.end) > 0 && parseInt(data.end) <= currentYear
        ? 1
        : 0;

    return {
      name: data.title || data.slug,
      imageUrl: data.poster ? `${this.baseUrl}/img/posters/${data.poster}` : "",
      description: descParts.join(""),
      genre: data.generes || [],
      status,
      author: "FireAnime",
      artist: "",
      link: `${this.baseUrl}/anime/${data.slug}`,
      episodes,
    };
  }

  async extractVoe(rawUrl, langTag) {
    const videos = [];
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Referer: `${this.baseUrl}/`,
    };

    let id = "";
    const mId = rawUrl.match(/\/e\/([a-zA-Z0-9]+)/);
    if (mId) id = mId[1];

    const domains = ["rebeccapracticeloss.com", "voe.sx", "tubesquid.com"];
    const urlsToTry = id
      ? domains.map((d) => `https://${d}/e/${id}`)
      : [rawUrl];

    let html = null;
    let successUrl = null;

    for (const targetUrl of urlsToTry) {
      try {
        const res = await this.client.get(targetUrl, headers);
        if (
          res &&
          res.statusCode === 200 &&
          res.body &&
          res.body.length > 500
        ) {
          html = res.body;
          successUrl = targetUrl;
          if (html.includes("window.location.href")) {
            const mRedirect = html.match(
              /window\.location\.href\s*=\s*['"]([^'"]+)['"]/,
            );
            if (mRedirect) {
              const redirectRes = await this.client.get(mRedirect[1], headers);
              if (redirectRes && redirectRes.statusCode === 200) {
                html = redirectRes.body;
                successUrl = mRedirect[1];
              }
            }
          }
          if (html.match(/\["([^"]{100,})"\]/)) break;
        }
      } catch (_) {}
    }

    if (!html) return [];

    const payloadMatch = html.match(/\["([^"]{100,})"\]/);
    if (!payloadMatch) return [];

    const decrypted = this.decryptVoePayload(payloadMatch[1]);
    if (!decrypted) return [];

    const langLabel = langTag ? ` (${langTag})` : "";
    if (decrypted.source) {
      videos.push({
        url: decrypted.source,
        originalUrl: successUrl,
        quality: `VOE HLS${langLabel}`,
        headers: { "User-Agent": headers["User-Agent"] },
      });
    }
    if (decrypted.direct_access_url) {
      videos.push({
        url: decrypted.direct_access_url,
        originalUrl: successUrl,
        quality: `VOE Direct MP4${langLabel}`,
        headers: { "User-Agent": headers["User-Agent"] },
      });
    }

    return videos;
  }

  async getVideoList(url) {
    let slug = "";
    let season = "1";
    let episode = "1";

    let target =
      typeof url === "object" && url !== null ? url.url || url.link || "" : url;
    if (typeof target === "string") {
      target = target.trim();
      if (target.startsWith("{")) {
        try {
          const parsed = JSON.parse(target);
          slug = parsed.slug || "";
          season = String(parsed.season || "1");
          episode = String(parsed.episode || "1");
        } catch (_) {}
      }
      if (!slug) {
        if (target.includes("/anime/")) {
          const parts = target.split("/anime/")[1].split("?")[0].split("/");
          slug = parts[0];
          for (let p = 0; p < parts.length; p++) {
            if (parts[p] === "watch" && parts[p + 1] && parts[p + 2]) {
              season = parts[p + 1];
              episode = parts[p + 2];
            } else if (parts[p] === "season" && parts[p + 1]) {
              season = parts[p + 1];
            } else if (parts[p] === "episode" && parts[p + 1]) {
              episode = parts[p + 1];
            }
          }
        } else if (target.includes("/")) {
          const parts = target.split("/");
          slug = parts[0];
          if (parts.length >= 3) {
            season = parts[1];
            episode = parts[2];
          } else if (parts.length === 2) {
            episode = parts[1];
          }
        } else {
          slug = target;
        }
      }
    }

    if (!slug) return [];

    const res = await this.rpc("api.v1.anime.AnimeService", "GetEpisode", {
      slug,
      season,
      episode,
    });

    const data = res.data;
    if (!data || !data.animeEpisodeLinks) return [];

    const videos = [];
    const links = data.animeEpisodeLinks;
    const prefLang = this.getPreference("fireanime_pref_lang") || "ger-dub";

    for (const linkItem of links) {
      const rawLink = linkItem.link || "";
      const lang = linkItem.lang || "";
      const hoster = linkItem.name || "";

      if (
        rawLink.includes("voe.sx") ||
        rawLink.includes("/e/") ||
        hoster.toUpperCase() === "VOE"
      ) {
        const voeVideos = await this.extractVoe(rawLink, lang);
        for (const v of voeVideos) {
          videos.push(v);
        }
      }
    }

    videos.sort((a, b) => {
      const aMatch = a.quality.includes(prefLang) ? -1 : 1;
      const bMatch = b.quality.includes(prefLang) ? -1 : 1;
      return aMatch - bMatch;
    });

    return videos;
  }

  getFilterList() {
    const genres = [
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
        values: genres.map((g) => ({
          type_name: "SelectOption",
          name: g,
          value: g,
        })),
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
        ].map((x) => ({
          type_name: "SelectOption",
          name: x[0],
          value: x[1],
        })),
      },
      {
        type_name: "SelectFilter",
        name: "Order",
        state: 0,
        values: [
          ["Absteigend (Z-A / High-Low)", "desc"],
          ["Aufsteigend (A-Z / Low-High)", "asc"],
        ].map((x) => ({
          type_name: "SelectOption",
          name: x[0],
          value: x[1],
        })),
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
