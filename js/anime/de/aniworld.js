const mangayomiSources = [
  {
    name: "AniWorld",
    id: 7255174968,
    lang: "de",
    baseUrl: "https://aniworld.to",
    itemType: 1,
    typeSource: "single",
    apiUrl: "",
    hasCloudflare: false,
    iconUrl: "https://aniworld.to/public/img/android-icon-192x192.png",
    isManga: false,
    isNsfw: false,
    version: "0.1.0",
    appMinVerReq: "",
    dateFormat: "",
    dateFormatLocale: "",
    pkgName: "",
    pkgPath: "",
    notes: "",
  },
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.base = "https://aniworld.to";
    this.client = new Client();
    this.coverCache = {};
    this.langs = { 1: "GerDub", 2: "EngSub", 3: "GerSub" };
  }

  get supportsLatest() {
    return true;
  }

  getHeaders(url) {
    return {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13; 22081212UG Build/TKQ1.220829.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.5735.131 Mobile Safari/537.36",
    };
  }

  fix(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    return this.base + (url.charAt(0) === "/" ? url : "/" + url);
  }

  txt(el) {
    if (!el) return "";
    return (el.text || "").replace(/\s+/g, " ").trim();
  }

  decode(value) {
    if (!value) return "";
    return this.txt(new Document("<div>" + value + "</div>"));
  }

  cover(doc) {
    const img = doc.selectFirst(".seriesCoverBox img");
    if (!img) return "";
    return this.fix(img.getDataSrc || img.getSrc);
  }

  async mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const index = next++;
        try {
          out[index] = await fn(items[index]);
        } catch (e) {
          out[index] = null;
        }
      }
    };
    const workers = [];
    for (let i = 0; i < Math.min(limit, items.length); i++)
      workers.push(worker());
    await Promise.all(workers);
    return out;
  }

  async loadCover(link) {
    if (this.coverCache[link] !== undefined) return this.coverCache[link];
    let cover = "";
    try {
      const res = await this.client.get(link, this.getHeaders());
      cover = this.cover(new Document(res.body));
    } catch (e) {}
    this.coverCache[link] = cover;
    return cover;
  }

  async withCovers(entries) {
    await this.mapLimit(entries, 10, async (entry) => {
      entry.imageUrl = await this.loadCover(entry.link);
    });
    return entries;
  }

  parseChapters(html) {
    const doc = new Document(html);
    const chapters = [];
    doc.select("table.seasonEpisodesList tbody tr").forEach((tr) => {
      const anchor = tr.selectFirst("td.seasonEpisodeTitle a");
      if (!anchor) return;
      const href = anchor.getHref;
      if (!href) return;
      let prefix = "";
      let order = 0;
      const episodeMatch = href.match(/\/staffel-(\d+)\/episode-(\d+)/);
      const filmMatch = href.match(/\/filme\/film-(\d+)/);
      if (episodeMatch) {
        const season = episodeMatch[1];
        const episode = episodeMatch[2];
        prefix =
          "S" +
          (season.length < 2 ? "0" + season : season) +
          "E" +
          (episode.length < 2 ? "0" + episode : episode);
        order = parseInt(season, 10) * 100000 + parseInt(episode, 10);
      } else if (filmMatch) {
        prefix = "Film " + filmMatch[1];
        order = 100000000 + parseInt(filmMatch[1], 10);
      } else {
        return;
      }
      const strong = anchor.selectFirst("strong");
      const strongText = strong ? this.txt(strong) : "";
      const title = strongText ? strongText : this.txt(anchor);
      chapters.push({
        name: prefix + " - " + (title || prefix),
        url: this.fix(href),
        order: order,
      });
    });
    return chapters;
  }

  async getPopular(page) {
    if (page > 1) return { list: [], hasNextPage: false };
    const res = await this.client.get(
      this.base + "/beliebte-animes",
      this.getHeaders(),
    );
    const doc = new Document(res.body);
    const list = [];
    doc.select(".seriesListContainer a").forEach((anchor) => {
      const href = anchor.getHref;
      if (!href || !/\/anime\/stream\/[^\/]+$/.test(href)) return;
      const img = anchor.selectFirst("img");
      const cover = img ? this.fix(img.getDataSrc || img.getSrc) : "";
      const link = this.fix(href);
      if (cover) this.coverCache[link] = cover;
      list.push({
        name: this.txt(anchor.selectFirst("h3")),
        link: link,
        imageUrl: cover,
      });
    });
    return { list: list, hasNextPage: false };
  }

  async getLatestUpdates(page) {
    if (page > 1) return { list: [], hasNextPage: false };
    const res = await this.client.get(
      this.base + "/neue-episoden",
      this.getHeaders(),
    );
    const doc = new Document(res.body);
    const list = [];
    const seen = {};
    doc.select(".newEpisodeList a").forEach((anchor) => {
      const href = anchor.getHref;
      const match = href.match(/^\/anime\/stream\/([^\/]+)/);
      if (!match || seen[match[1]]) return;
      seen[match[1]] = true;
      const strong = anchor.selectFirst("strong");
      list.push({
        name: strong ? this.txt(strong) : match[1],
        link: this.fix("/anime/stream/" + match[1]),
        imageUrl: "",
      });
    });
    await this.withCovers(list);
    return { list: list, hasNextPage: false };
  }

  async search(query, page, filters) {
    if (page > 1 || !query || !query.trim())
      return { list: [], hasNextPage: false };
    const headers = this.getHeaders();
    headers["Content-Type"] =
      "application/x-www-form-urlencoded; charset=UTF-8";
    const res = await this.client.post(
      this.base + "/ajax/search",
      headers,
      "keyword=" + encodeURIComponent(query.trim()),
    );
    let data = [];
    try {
      data = JSON.parse(res.body);
    } catch (e) {
      return { list: [], hasNextPage: false };
    }
    const list = [];
    const seen = {};
    (Array.isArray(data) ? data : []).forEach((item) => {
      const href = item.link || "";
      if (!/^\/anime\/stream\/[^\/]+$/.test(href) || seen[href]) return;
      seen[href] = true;
      list.push({
        name: this.decode(item.title || ""),
        link: this.fix(href),
        imageUrl: "",
      });
    });
    await this.withCovers(list);
    return { list: list, hasNextPage: false };
  }

  async getDetail(url) {
    const link = this.fix(url);
    const res = await this.client.get(link, this.getHeaders());
    const doc = new Document(res.body);
    const title = doc.selectFirst(".series-title h1");
    const descriptionEl = doc.selectFirst(".seri_des");
    const fullDescription = descriptionEl
      ? descriptionEl.attr("data-full-description")
      : "";
    const genres = [];
    const genreSeen = {};
    doc.select(".genres a").forEach((anchor) => {
      if (anchor.attr("itemprop") !== "genre") return;
      const genre = this.txt(anchor);
      const lower = genre.toLowerCase();
      if (
        !genre ||
        genreSeen[genre] ||
        lower === "ger" ||
        lower === "engsub" ||
        lower === "gersub" ||
        lower === "gerdub"
      )
        return;
      genreSeen[genre] = true;
      genres.push(genre);
    });
    const endMatch = res.body.match(
      /itemprop="endDate"[^>]*>[\s\S]*?>(\d{4})</,
    );
    const endYear = endMatch ? parseInt(endMatch[1], 10) : NaN;
    const status = endYear && endYear < new Date().getFullYear() ? 1 : 0;
    const chapters = this.parseChapters(res.body);
    const seasonLinks = [];
    doc.select(".hosterSiteDirectNav a").forEach((anchor) => {
      let href = anchor.getHref;
      if (!href) return;
      href = href.replace(/\/+$/, "");
      if (!/\/(staffel-\d+|filme)$/.test(href)) return;
      if ((anchor.className || "").split(/\s+/).indexOf("active") !== -1)
        return;
      seasonLinks.push(this.fix(href));
    });
    const bodies = await this.mapLimit(seasonLinks, 5, async (seasonLink) => {
      try {
        return (await this.client.get(seasonLink, this.getHeaders())).body;
      } catch (e) {
        return "";
      }
    });
    bodies.forEach((body) => {
      if (body) chapters.push(...this.parseChapters(body));
    });
    const merged = [];
    const chapterSeen = {};
    chapters.forEach((chapter) => {
      if (!chapter.url || chapterSeen[chapter.url]) return;
      chapterSeen[chapter.url] = true;
      merged.push(chapter);
    });
    merged.sort((a, b) => a.order - b.order);
    return {
      name: this.txt(title),
      imageUrl: this.cover(doc),
      description: fullDescription
        ? this.decode(fullDescription)
        : this.txt(descriptionEl),
      genre: genres,
      status: status,
      chapters: merged.map((chapter) => ({
        name: chapter.name,
        url: chapter.url,
      })),
    };
  }

  async getVideoList(url) {
    const res = await this.client.get(this.fix(url), this.getHeaders());
    const doc = new Document(res.body);
    const items = [];
    doc.select(".hosterSiteVideo li").forEach((li) => {
      const target = li.attr("data-link-target");
      if (!target) return;
      const host = this.txt(li.selectFirst("h4"));
      if (!host) return;
      items.push({
        target: this.fix(target),
        host: host,
        lang: this.langs[li.attr("data-lang-key")] || "",
      });
    });
    const groups = await this.mapLimit(items, 4, async (item) => {
      try {
        const page = await this.client.get(item.target, this.getHeaders());
        const finalUrl =
          page.request && page.request.url ? page.request.url : item.target;
        const host = item.host.toLowerCase();
        let videos = [];
        const langLabel =
          item.lang === "GerDub"
            ? "German Dub"
            : item.lang === "EngSub"
              ? "English Sub"
              : item.lang === "GerSub"
                ? "German Sub"
                : item.lang;
        if (host.indexOf("voe") !== -1) {
          const voeVideos = await voeExtractor(finalUrl, item.lang + " ");
          const fallbackResolutions = ["720p", "1080p"];
          videos = (Array.isArray(voeVideos) ? voeVideos : []).map(
            (video, index) => {
              const resolutionMatch = String(
                (video && video.quality) || "",
              ).match(/(\d+p)/);
              const resolution =
                resolutionMatch && resolutionMatch[1]
                  ? resolutionMatch[1]
                  : fallbackResolutions[index] || "";
              return Object.assign({}, video, {
                quality: langLabel + " (VOE " + resolution + ")",
              });
            },
          );
        } else if (host.indexOf("dood") !== -1) {
          const doodVideos = await doodExtractor(
            finalUrl,
            item.lang + " Doodstream",
          );
          videos = (Array.isArray(doodVideos) ? doodVideos : []).map((video) =>
            Object.assign({}, video, {
              quality: langLabel + " (DoodStream)",
            }),
          );
        } else if (host.indexOf("filemoon") !== -1) {
          const filemoonVideos = await filemoonExtractor(
            finalUrl,
            item.lang + " Filemoon",
            "",
          );
          videos = (Array.isArray(filemoonVideos) ? filemoonVideos : []).map(
            (video) =>
              Object.assign({}, video, {
                quality: langLabel + " (FileMoon)",
              }),
          );
        } else if (host.indexOf("vidmoly") !== -1) {
          const match = page.body.match(
            /sources\s*:\s*\[[^\]]*?file\s*:\s*['"]([^'"]+)['"]/,
          );
          if (match) {
            videos = [
              {
                url: match[1],
                quality: langLabel + " (VidMoly)",
                originalUrl: match[1],
                headers: { Referer: finalUrl },
              },
            ];
          }
        }
        return Array.isArray(videos) ? videos : [];
      } catch (e) {
        return [];
      }
    });
    const videos = [];
    groups.forEach((group) => {
      (group || []).forEach((video) => {
        if (video && video.url) videos.push(video);
      });
    });
    return videos;
  }

  getFilterList() {
    return [];
  }

  getSourcePreferences() {
    return [];
  }

  async getPageList(url) {
    return [];
  }

  async getHtmlContent(name, url) {
    return "";
  }

  async cleanHtmlContent(html) {
    return html;
  }
}
