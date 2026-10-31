const mangayomiSources = [
  {
    name: "Baka-Tsuki",
    id: 8244567358,
    lang: "en",
    baseUrl: "https://www.baka-tsuki.org",
    itemType: 2,
    typeSource: "single",
    apiUrl: "",
    hasCloudflare: true,
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://www.baka-tsuki.org",
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
    this.client = new Client();
    this.base = "https://www.baka-tsuki.org";
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

  cleanText(value) {
    if (!value) return "";
    return String(value)
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

  formatImage(src) {
    if (!src) return "";
    const cleanSrc = src.replace(/&amp;/g, "&");
    if (cleanSrc.startsWith("http")) return cleanSrc;
    if (cleanSrc.startsWith("//")) return "https:" + cleanSrc;
    return this.base + (cleanSrc.startsWith("/") ? "" : "/") + cleanSrc;
  }

  async getPopular(page) {
    const p = parseInt(page, 10) || 1;
    const offset = (p - 1) * 30;
    let url =
      this.base +
      "/project/api.php?action=query&list=categorymembers&cmtitle=Category:Light_novel_(English)&cmlimit=30&cmtype=page&format=json";
    if (offset > 0) url += "&cmoffset=" + offset;
    const res = await this.client.get(url, this.getHeaders(url));
    const list = [];
    let hasNextPage = false;
    if (res && res.statusCode === 200 && res.body) {
      try {
        const data = JSON.parse(res.body);
        const members =
          data.query && data.query.categorymembers
            ? data.query.categorymembers
            : [];
        for (const item of members) {
          const title = item.title || "";
          if (
            title.startsWith("Category:") ||
            title.startsWith("Template:") ||
            title.startsWith("User:")
          )
            continue;
          const link =
            "/project/index.php?title=" +
            encodeURIComponent(title.replace(/ /g, "_"));
          list.push({ name: title, imageUrl: "", link: link });
        }
        hasNextPage = Boolean(data.continue || members.length >= 30);
      } catch (e) {}
    }
    return { list: list, hasNextPage: hasNextPage };
  }

  async getLatestUpdates(page) {
    const url =
      this.base +
      "/project/api.php?action=query&list=recentchanges&rcnamespace=0&rctype=edit|new&rclimit=30&format=json";
    const res = await this.client.get(url, this.getHeaders(url));
    const list = [];
    const seen = new Set();
    if (res && res.statusCode === 200 && res.body) {
      try {
        const data = JSON.parse(res.body);
        const rc =
          data.query && data.query.recentchanges
            ? data.query.recentchanges
            : [];
        for (const item of rc) {
          const rawTitle = item.title || "";
          const mainTitle = rawTitle.split(":")[0].trim();
          if (mainTitle && !seen.has(mainTitle)) {
            seen.add(mainTitle);
            const link =
              "/project/index.php?title=" +
              encodeURIComponent(mainTitle.replace(/ /g, "_"));
            list.push({ name: mainTitle, imageUrl: "", link: link });
          }
        }
      } catch (e) {}
    }
    return { list: list, hasNextPage: list.length >= 10 };
  }

  async search(query, page, filters) {
    const p = parseInt(page, 10) || 1;
    if (!query || !query.trim()) return this.getPopular(p);
    const q = query.trim();
    const offset = (p - 1) * 25;
    const url =
      this.base +
      "/project/api.php?action=query&list=search&srsearch=" +
      encodeURIComponent(q) +
      "&srnamespace=0&srlimit=25&sroffset=" +
      offset +
      "&format=json";
    const res = await this.client.get(url, this.getHeaders(url));
    const list = [];
    let hasNextPage = false;
    if (res && res.statusCode === 200 && res.body) {
      try {
        const data = JSON.parse(res.body);
        const items = data.query && data.query.search ? data.query.search : [];
        const seen = new Set();
        for (const item of items) {
          const title = item.title || "";
          const mainTitle = title.split(":")[0].trim();
          if (mainTitle && !seen.has(mainTitle)) {
            seen.add(mainTitle);
            const link =
              "/project/index.php?title=" +
              encodeURIComponent(mainTitle.replace(/ /g, "_"));
            list.push({ name: mainTitle, imageUrl: "", link: link });
          }
        }
        hasNextPage = Boolean(data.continue || items.length >= 25);
      } catch (e) {}
    }
    return { list: list, hasNextPage: hasNextPage };
  }

  async getDetail(url) {
    let path =
      typeof url === "object" && url !== null ? url.url || url.link || "" : url;
    if (typeof path === "string")
      path = path.replace(/https?:\/\/[^\/]+/, "").trim();
    if (!path.startsWith("/")) path = "/" + path;
    const detailUrl = this.base + path;
    const res = await this.client.get(detailUrl, this.getHeaders(detailUrl));
    if (!res || !res.body)
      throw new Error("Failed to load details for " + path);
    const html = res.body;
    const titleMatch =
      html.match(/<h1[^>]*id=["']firstHeading["'][^>]*>([\s\S]*?)<\/h1>/i) ||
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const name = titleMatch ? this.cleanText(titleMatch[1]) : "Light Novel";
    const imgMatch =
      html.match(
        /<div[^>]*class=["'][^"']*thumbinner[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<img[^>]+src=["']([^"']*(?:thumb\.php|\/images\/)[^"']*)["']/i,
      ) ||
      html.match(/<img[^>]+src=["']([^"']+\.(?:jpg|png|jpeg|webp)[^"']*)["']/i);
    const imageUrl = imgMatch ? this.formatImage(imgMatch[1]) : "";
    const descMatch =
      html.match(
        /<h2[^>]*>[\s\S]*?Story\s*Synopsis[\s\S]*?<\/h2>([\s\S]*?)(?:<h2|<div\s+id=["']toc["'])/i,
      ) ||
      html.match(
        /<h2[^>]*>[\s\S]*?Synopsis[\s\S]*?<\/h2>([\s\S]*?)(?:<h2|<div\s+id=["']toc["'])/i,
      ) ||
      html.match(/<p>([\s\S]*?)<\/p>/i);
    const description = descMatch ? this.cleanText(descMatch[1]) : "";
    const chapters = [];
    const seen = new Set();
    const rawName = name.replace(/ /g, "_");
    const linkRegex =
      /<a[^>]+href=["']([^"']*\/project\/index\.php\?title=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let chMatch;
    while ((chMatch = linkRegex.exec(html)) !== null) {
      const chHref = chMatch[1];
      const chText = this.cleanText(chMatch[2]);
      const isChapter =
        chHref.includes(encodeURIComponent(rawName) + ":") ||
        chHref.includes(rawName + ":") ||
        chHref.includes("Volume_") ||
        chHref.includes("Chapter_") ||
        chHref.includes("Prologue") ||
        chHref.includes("Epilogue") ||
        chHref.includes("Afterword");
      const isExcluded =
        chHref.includes("action=edit") ||
        chHref.includes("action=history") ||
        chHref.includes("Special:") ||
        chHref.includes("User:") ||
        chHref.includes("Registration_Page") ||
        chHref.includes("Tasklist") ||
        chHref.includes("Guidelines") ||
        chHref.includes("&oldid=");
      if (isChapter && !isExcluded && !seen.has(chHref) && chText.length > 0) {
        seen.add(chHref);
        let cleanHref = chHref;
        if (cleanHref.startsWith("http")) {
          try {
            const u = new URL(cleanHref);
            cleanHref = u.pathname + u.search;
          } catch (e) {}
        }
        chapters.push({ name: chText, url: cleanHref });
      }
    }
    if (chapters.length === 0) chapters.push({ name: "Full Story", url: path });
    return {
      name: name,
      imageUrl: imageUrl,
      link: detailUrl,
      description: description,
      author: "",
      artist: "",
      genre: ["Light Novel"],
      status: 1,
      chapters: chapters,
    };
  }

  async getHtmlContent(name, url) {
    let path =
      typeof url === "object" && url !== null ? url.url || url.link || "" : url;
    if (typeof path === "string")
      path = path.replace(/https?:\/\/[^\/]+/, "").trim();
    if (!path.startsWith("/")) path = "/" + path;
    const fullUrl = this.base + path;
    const res = await this.client.get(fullUrl, this.getHeaders(fullUrl));
    if (res && res.body)
      return "<div class='novel-content'>" + res.body + "</div>";
    return "<div class='novel-content'><p>Content could not be loaded.</p></div>";
  }

  async cleanHtmlContent(html) {
    if (!html) return "";
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .trim();
  }

  getFilterList() {
    return [];
  }

  getSourcePreferences() {
    return [];
  }
}
