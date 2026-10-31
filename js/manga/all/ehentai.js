const mangayomiSources = [
  {
    name: "E-Hentai",
    id: 6793553951,
    lang: "all",
    baseUrl: "https://e-hentai.org",
    itemType: 0,
    typeSource: "single",
    apiUrl: "",
    hasCloudflare: true,
    iconUrl: "https://e-hentai.org/favicon.ico",
    isManga: true,
    isNsfw: true,
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
    this.base = "https://e-hentai.org";
  }

  get supportsLatest() {
    return true;
  }

  getHeaders(url) {
    return {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13; 22081212UG Build/TKQ1.220829.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.5735.131 Mobile Safari/537.36",
      Cookie: "nw=1",
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
      .replace(/\s+/g, " ")
      .trim();
  }

  extractIds(input) {
    if (!input) return null;
    let str =
      typeof input === "string"
        ? input
        : input.link || input.url || input.path || "";
    str = String(str).trim();
    const match = str.match(
      /(?:https?:\/\/[^\/]+)?\/(?:g|s|mpv)\/([a-zA-Z0-9]+)[\/-]([a-zA-Z0-9]+)/i,
    );
    if (match) {
      const a = match[1];
      const b = match[2];
      if (/^\d+$/.test(a)) return [parseInt(a, 10), b];
      if (/^\d+$/.test(b)) return [parseInt(b, 10), a];
    }
    const match2 = str.match(/(\d+)[\/_]([a-zA-Z0-9]{8,15})/i);
    if (match2) return [parseInt(match2[1], 10), match2[2]];
    return null;
  }

  async loadGalleryPage(startUrl, pageNumber) {
    const p = Math.max(parseInt(pageNumber, 10) || 1, 1);
    let url = startUrl;
    let html = "";
    let hasNextPage = false;
    for (let i = 1; i <= p; i++) {
      const res = await this.client.get(url, this.getHeaders(url));
      html = res ? res.body : "";
      const nextMatch = html.match(/id="unext"\s+href="([^"]+)"/);
      hasNextPage = Boolean(nextMatch);
      if (i === p) break;
      if (!nextMatch) {
        hasNextPage = false;
        break;
      }
      url = nextMatch[1].replace(/&amp;/g, "&");
    }
    return { html: html, hasNextPage: hasNextPage };
  }

  parseGalleryList(html) {
    const list = [];
    if (!html) return list;
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    const seen = new Set();
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const row = rowMatch[1];
      const linkMatch = row.match(
        /<a[^>]+href=["']([^"']*\/g\/\d+\/[a-zA-Z0-9]+\/?)["']/i,
      );
      if (!linkMatch) continue;
      let link = linkMatch[1];
      if (link.startsWith("http")) {
        try {
          link = new URL(link).pathname;
        } catch (e) {}
      }
      if (seen.has(link)) continue;
      seen.add(link);
      const titleMatch =
        row.match(
          /<div[^>]+class=["'][^"']*glink[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
        ) || row.match(/<a[^>]+title=["']([^"']+)["']/i);
      const name = titleMatch ? this.cleanText(titleMatch[1]) : "";
      const imgMatch = row.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i);
      let imageUrl = imgMatch ? imgMatch[1] : "";
      if (imageUrl && !imageUrl.startsWith("http"))
        imageUrl = this.fix(imageUrl);
      if (name || imageUrl)
        list.push({ name: name || "Gallery", imageUrl: imageUrl, link: link });
    }
    return list;
  }

  async getPopular(page) {
    const p = parseInt(page, 10) || 1;
    const result = await this.loadGalleryPage(this.base + "/popular", p);
    const list = this.parseGalleryList(result.html);
    const hasNextPage = result.hasNextPage && list.length > 0;
    return { list: list, hasNextPage: hasNextPage };
  }

  async getLatestUpdates(page) {
    const p = parseInt(page, 10) || 1;
    const result = await this.loadGalleryPage(this.base + "/", p);
    const list = this.parseGalleryList(result.html);
    return { list: list, hasNextPage: result.hasNextPage && list.length > 0 };
  }

  async search(query, page, filters) {
    const p = parseInt(page, 10) || 1;
    const qParts = [];
    if (query && query.trim().length > 0) qParts.push(query.trim());
    const searchUrl =
      this.base + "/?f_search=" + encodeURIComponent(qParts.join(" "));
    const result = await this.loadGalleryPage(searchUrl, p);
    const list = this.parseGalleryList(result.html);
    return { list: list, hasNextPage: result.hasNextPage && list.length > 0 };
  }

  async getDetail(url) {
    const extracted = this.extractIds(url);
    if (!extracted) {
      return {
        name: "Gallery",
        imageUrl: "",
        link: this.base,
        description: "",
        author: "",
        artist: "",
        genre: [],
        status: 1,
        chapters: [],
      };
    }
    const gid = extracted[0];
    const token = extracted[1];
    const detailUrl = this.base + "/g/" + gid + "/" + token + "/";
    const res = await this.client.get(detailUrl, this.getHeaders(detailUrl));
    const html = res ? res.body : "";
    let title = "";
    let imageUrl = "";
    const genres = [];
    const descriptionParts = [];
    let postedDate = null;
    let uploader = "";
    let author = "";
    let artist = "";
    if (html) {
      const titleMatch =
        html.match(/<h1[^>]+id=["']gn["'][^>]*>([\s\S]*?)<\/h1>/i) ||
        html.match(/<h1[^>]+id=["']gj["'][^>]*>([\s\S]*?)<\/h1>/i) ||
        html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (titleMatch) title = this.cleanText(titleMatch[1]);
      const imgMatch =
        html.match(
          /<div[^>]+id=["']gd1["'][^>]*>[\s\S]*?<div[^>]+style=["'][^"']*url\(([^)]+)\)[^"']*["']/i,
        ) ||
        html.match(
          /<div[^>]+id=["']gd1["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
        );
      if (imgMatch) imageUrl = imgMatch[1].replace(/['"]/g, "");
      const tagRegex = /<a[^>]+id=["']ta_([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let tagMatch;
      while ((tagMatch = tagRegex.exec(html)) !== null) {
        const rawTag = tagMatch[1].replace(/_/g, " ");
        const tagName = this.cleanText(tagMatch[2]);
        const fullTag = rawTag.includes(":") ? rawTag : tagName || rawTag;
        if (fullTag.startsWith("artist:")) {
          artist = fullTag.replace(/^artist:/, "").trim();
          if (!author) author = artist;
        } else if (fullTag.startsWith("group:") && !author) {
          author = fullTag.replace(/^group:/, "").trim();
        }
        if (genres.indexOf(fullTag) === -1) genres.push(fullTag);
      }
      const uploaderMatch = html.match(
        /<div[^>]+id=["']gdn["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
      );
      if (uploaderMatch) {
        uploader = this.cleanText(uploaderMatch[1]);
        if (!author) author = uploader;
      }
      const catMatch = html.match(
        /<div[^>]+id=["']gdc["'][^>]*>[\s\S]*?<div[^>]+class=["'][^"']*cs[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      );
      let catName = "";
      if (catMatch) {
        catName = this.cleanText(catMatch[1]);
        if (catName && genres.indexOf(catName) === -1) genres.unshift(catName);
      }
      const dateMatch = html.match(
        /<td[^>]+class=["']gdt1["'][^>]*>Posted:<\/td>\s*<td[^>]+class=["']gdt2["'][^>]*>([\s\S]*?)<\/td>/i,
      );
      if (dateMatch) {
        const dateStr = this.cleanText(dateMatch[1]);
        if (dateStr) postedDate = String(new Date(dateStr + " UTC").getTime());
      }
      const metaRegex =
        /<td[^>]+class=["']gdt1["'][^>]*>([\s\S]*?)<\/td>\s*<td[^>]+class=["']gdt2["'][^>]*>([\s\S]*?)<\/td>/gi;
      let metaMatch;
      while ((metaMatch = metaRegex.exec(html)) !== null) {
        const label = this.cleanText(metaMatch[1]).replace(/:$/, "");
        const value = this.cleanText(metaMatch[2]);
        if (!label || !value) continue;
        if (label === "Length" || label === "Rating") continue;
        descriptionParts.push(label + ": " + value);
      }
      if (catName) descriptionParts.push("Category: " + catName);
      if (uploader) descriptionParts.push("Uploader: " + uploader);
      const ratingMatch = html.match(
        /<td[^>]+id=["']rating_label["'][^>]*>([\s\S]*?)<\/td>/i,
      );
      if (ratingMatch)
        descriptionParts.push("Rating: " + this.cleanText(ratingMatch[1]));
      const lengthMatch = html.match(
        /<td[^>]+class=["']gdt1["'][^>]*>Length:<\/td>\s*<td[^>]+class=["']gdt2["'][^>]*>([\s\S]*?)<\/td>/i,
      );
      if (lengthMatch)
        descriptionParts.push("Pages: " + this.cleanText(lengthMatch[1]));
      descriptionParts.sort();
    }
    return {
      name: title || "Gallery " + gid,
      imageUrl: imageUrl,
      link: detailUrl,
      description: descriptionParts.join("\n"),
      author: author,
      artist: artist,
      genre: genres,
      status: 1,
      chapters: [
        {
          name: "Chapter 1",
          url: "/g/" + gid + "/" + token + "/",
          dateUpload: postedDate || String(Date.now()),
        },
      ],
    };
  }

  async getPageList(url) {
    const extracted = this.extractIds(url);
    if (!extracted) return [];
    const gid = extracted[0];
    const token = extracted[1];
    const base = this.base;
    const readerPageUrls = [];
    let page = 0;
    while (page < 10) {
      const thumbPageUrl = base + "/g/" + gid + "/" + token + "/?p=" + page;
      const res = await this.client.get(
        thumbPageUrl,
        this.getHeaders(thumbPageUrl),
      );
      if (!res || !res.body) break;
      const html = res.body;
      const readerRegex =
        /(?:https?:\/\/[^\/]+)?\/s\/([a-zA-Z0-9]+)\/(\d+)-(\d+)/g;
      let rMatch;
      let pageFoundCount = 0;
      while ((rMatch = readerRegex.exec(html)) !== null) {
        const readerLink =
          base + "/s/" + rMatch[1] + "/" + rMatch[2] + "-" + rMatch[3];
        if (readerPageUrls.indexOf(readerLink) === -1) {
          readerPageUrls.push(readerLink);
          pageFoundCount++;
        }
      }
      if (pageFoundCount === 0) break;
      page++;
    }
    const images = [];
    const batchSize = 10;
    for (let b = 0; b < readerPageUrls.length; b += batchSize) {
      const batch = readerPageUrls.slice(b, b + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (rUrl) => {
          try {
            const rRes = await this.client.get(rUrl, this.getHeaders(rUrl));
            if (rRes && rRes.body) {
              const imgMatch = rRes.body.match(
                /<img[^>]+id=["']img["'][^>]+src=["']([^"']+)["']/i,
              );
              if (imgMatch) return imgMatch[1];
            }
          } catch (e) {}
          return null;
        }),
      );
      for (const res of batchResults) {
        if (res) images.push(res);
      }
    }
    return images;
  }

  getFilterList() {
    return [];
  }

  getSourcePreferences() {
    return [];
  }
}
