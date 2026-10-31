const mangayomiSources = [
  {
    name: "Atsumaru",
    id: 4930017816,
    lang: "en",
    baseUrl: "https://atsu.moe",
    itemType: 0,
    typeSource: "single",
    apiUrl: "",
    hasCloudflare: true,
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://atsu.moe",
    isManga: true,
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
    this.base = "https://atsu.moe";
    this.client = new Client();
    this.cdn = "https://cdn.atsu.moe";
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

  img(path) {
    if (!path) return "";
    if (typeof path === "object")
      path =
        path.mediumImage ||
        path.image ||
        path.smallImage ||
        path.largeImage ||
        "";
    if (/^https?:\/\//i.test(path))
      return path.replace(/^http:\/\//i, "https://");
    if (path.startsWith("//")) return "https:" + path;
    path = path.replace(/^\//, "").replace(/^static\//, "");
    return this.cdn + "/static/" + path;
  }

  manga(item) {
    return {
      name: item.title || item.englishTitle || "",
      link: item.id,
      imageUrl: this.img(
        item.posterMedium ||
          item.mediumImage ||
          item.posterSmall ||
          item.smallImage ||
          item.poster ||
          item.image,
      ),
    };
  }

  async requestJson(path) {
    const res = await this.client.get(this.fix(path), this.getHeaders());
    if (res.statusCode !== 200)
      throw new Error(this.fix(path) + " returned " + res.statusCode);
    return JSON.parse(res.body);
  }

  parseId(url) {
    url = this.fix(url).replace(this.base, "");
    const parts = url.split("/").filter((part) => part);
    if (parts[0] === "manga" && parts[1]) return parts[1];
    return parts.length ? parts[parts.length - 1] : url;
  }

  parseChapterUrl(url) {
    url = this.fix(url).replace(this.base, "");
    const parts = url.split("/").filter((part) => part);
    return {
      mangaId: parts.length > 1 ? parts[parts.length - 2] : "",
      chapterId: parts.length ? parts[parts.length - 1] : "",
    };
  }

  joinAuthors(authors, type) {
    if (!Array.isArray(authors)) return "";
    return authors
      .filter((author) => !type || author.type === type)
      .map((author) => author.name)
      .filter((name) => name)
      .join(", ");
  }

  status(value) {
    const map = { ongoing: 0, completed: 1, hiatus: 2, canceled: 3 };
    return (
      map[
        String(value || "")
          .toLowerCase()
          .trim()
      ] ?? 5
    );
  }

  async getPopular(page) {
    const offset = Math.max(parseInt(page, 10) - 1, 0) * 40;
    const body = await this.requestJson(
      "/api/home2/popular?offset=" +
        offset +
        "&limit=40&types=Manga,Manwha,Manhua,OEL&mediums=Comic",
    );
    const items = body.items || [];
    return {
      list: items.map((item) => this.manga(item)),
      hasNextPage: items.length > 0,
    };
  }

  async getLatestUpdates(page) {
    const offset = Math.max(parseInt(page, 10) - 1, 0) * 40;
    const body = await this.requestJson(
      "/api/home2/recentlyUpdated?offset=" +
        offset +
        "&limit=40&types=Manga,Manwha,Manhua,OEL&mediums=Comic",
    );
    const items = body.items || [];
    return {
      list: items.map((item) => this.manga(item)),
      hasNextPage: items.length > 0,
    };
  }

  async search(query, page, filters) {
    if (!query || !query.trim()) return { list: [], hasNextPage: false };
    const params = [
      "q=" + encodeURIComponent(query.trim()),
      "query_by=title,englishTitle,otherNames,authors",
      "filter_by=hidden:!=true && isAdult:=false",
      "page=" + parseInt(page, 10),
      "per_page=40",
    ];
    const body = await this.requestJson(
      "/collections/manga/documents/search?" + params.join("&"),
    );
    const hits = body.hits || [];
    const perPage = (body.request_params && body.request_params.per_page) || 40;
    const found = body.found || 0;
    const current = body.page || parseInt(page, 10);
    return {
      list: hits.map((hit) => this.manga(hit.document)),
      hasNextPage: current * perPage < found,
    };
  }

  async getDetail(url) {
    const id = this.parseId(url);
    const detailBody = await this.requestJson(
      "/api/manga/page?id=" + encodeURIComponent(id),
    );
    const item = detailBody.mangaPage || detailBody;
    const chaptersBody = await this.requestJson(
      "/api/manga/allChapters?mangaId=" + encodeURIComponent(id),
    );
    const scanlators = {};
    (item.scanlators || []).forEach((scanlator) => {
      scanlators[scanlator.id] = scanlator.name;
    });
    const chapters = (chaptersBody.chapters || [])
      .slice()
      .sort((a, b) => (b.number || 0) - (a.number || 0))
      .map((chapter) => ({
        name: chapter.title || "Chapter " + chapter.number,
        url: id + "/" + chapter.id,
        scanlator: scanlators[chapter.scanlationMangaId] || "",
      }));
    const genre = [];
    if (item.type) genre.push(item.type);
    (item.genres || []).forEach((entry) => {
      if (entry && entry.name && genre.indexOf(entry.name) === -1)
        genre.push(entry.name);
    });
    return {
      name: item.title || item.englishTitle || "",
      link: this.fix("/manga/" + id),
      imageUrl: this.img(item.poster || item.posterMedium || item.image),
      description: item.synopsis || "",
      author: this.joinAuthors(item.authors, "Author"),
      artist: this.joinAuthors(item.authors, "Artist"),
      genre: genre,
      status: this.status(item.status),
      chapters: chapters,
    };
  }

  async getPageList(url) {
    const ids = this.parseChapterUrl(url);
    const body = await this.requestJson(
      "/api/read/chapter?mangaId=" +
        encodeURIComponent(ids.mangaId) +
        "&chapterId=" +
        encodeURIComponent(ids.chapterId),
    );
    const pages = (body.readChapter && body.readChapter.pages) || [];
    return pages.map((page) => ({
      url: this.img(page.image),
      headers: this.getHeaders(),
    }));
  }

  async getVideoList(url) {
    return [];
  }

  getFilterList() {
    return [];
  }

  getSourcePreferences() {
    return [];
  }

  async getHtmlContent(name, url) {
    return "";
  }

  async cleanHtmlContent(html) {
    return html;
  }
}
