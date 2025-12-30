/**
 * 新闻服务 - 使用多个CORS代理备选
 */

import { config } from '../../config.js';
import { truncateText, formatDate } from '../utils/helpers.js';

/**
 * 从URL提取来源标识
 */
function getSourceName(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        const sourceMap = {
            'france24.com': 'F24',
            'lemonde.fr': 'Le Monde',
            'franceinfo.fr': 'franceinfo',
            '20minutes.fr': '20 Minutes',
            'rfi.fr': 'RFI'
        };
        
        for (const [domain, name] of Object.entries(sourceMap)) {
            if (hostname.includes(domain)) {
                return name;
            }
        }
        
        return hostname.replace('www.', '').split('.')[0].toUpperCase();
    } catch (e) {
        return 'Unknown';
    }
}

/**
 * 解析RSS XML
 */
function parseRSSXML(xmlText, sourceName) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            // 尝试作为HTML解析（有些RSS返回的是HTML包装的XML）
            return [];
        }
        
        const items = xmlDoc.querySelectorAll('item');
        const news = [];
        
        items.forEach(item => {
            const title = item.querySelector('title')?.textContent || '';
            const link = item.querySelector('link')?.textContent || '';
            const description = item.querySelector('description')?.textContent || '';
            const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();
            
            if (title && link) {
                // 清理HTML标签
                const cleanDesc = description.replace(/<[^>]*>/g, '').trim();
                news.push({
                    title: title.trim(),
                    link: link.trim(),
                    description: truncateText(cleanDesc, 200),
                    pubDate: pubDate,
                    formattedDate: formatDate(pubDate),
                    source: sourceName
                });
            }
        });
        
        return news;
    } catch (error) {
        console.warn('RSS解析失败:', error.message);
        return [];
    }
}

/**
 * 使用后端RSS代理API获取RSS（优先）
 */
async function fetchRSS(rssUrl, sourceName) {
    // 优先使用后端RSS代理API
    try {
        const proxyUrl = `/api/news/rss_proxy?url=${encodeURIComponent(rssUrl)}`;
        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.content) {
                const news = parseRSSXML(data.content, sourceName);
                if (news.length > 0) {
                    return news;
                }
            }
        }
    } catch (error) {
        console.warn('后端RSS代理失败，尝试其他方法:', error);
    }
    
    // 备用：多个CORS代理备选
    const proxies = [
        (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        (url) => `https://cors-anywhere.herokuapp.com/${url}`
    ];
    
    for (const proxyFn of proxies) {
        try {
            const proxyUrl = proxyFn(rssUrl);
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
                }
            });

            if (!response.ok) {
                continue;
            }

            const text = await response.text();
            
            // 检查是否是有效的XML
            if (!text.includes('<item') && !text.includes('<entry')) {
                continue;
            }
            
            const news = parseRSSXML(text, sourceName);
            if (news.length > 0) {
                return news;
            }
        } catch (error) {
            // 尝试下一个代理
            continue;
        }
    }
    
    throw new Error('所有代理都无法获取RSS');
}

/**
 * 从本地JSON文件获取新闻（服务器预更新）
 */
async function getNewsFromLocal() {
    try {
        const response = await fetch('/public/data/news.json');
        if (response.ok) {
            const data = await response.json();
            if (data.news && data.news.length > 0) {
                console.log(`从本地文件加载 ${data.news.length} 条新闻 (更新于: ${data.updated_at})`);
                return data.news;
            }
        }
    } catch (error) {
        // 静默失败，不显示错误
    }
    return null;
}

/**
 * 获取新闻（优先从本地文件，失败则从API获取）
 */
export async function getNews(limit = 10) {
    // 优先尝试从本地JSON文件读取（服务器预更新）
    const localNews = await getNewsFromLocal();
    if (localNews && localNews.length > 0) {
        return localNews.slice(0, limit);
    }

    // 如果本地文件不存在，尝试从API获取
    const sources = config.news_sources || [];
    
    if (sources.length === 0) {
        return getBackupNews();
    }

    const newsPerSource = Math.max(2, Math.floor(limit / sources.length));
    const allNews = [];

    // 串行获取（避免同时请求太多）
    for (const source of sources) {
        const sourceName = getSourceName(source);
        try {
            const news = await fetchRSS(source, sourceName);
            allNews.push(...news.slice(0, newsPerSource));
            
            // 如果已经有足够的新闻，停止获取
            if (allNews.length >= limit) {
                break;
            }
        } catch (error) {
            console.warn(`获取新闻源 [${sourceName}] 失败:`, error.message);
        }
        
        // 添加小延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (allNews.length === 0) {
        return getBackupNews();
    }

    // 按日期排序
    allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    return allNews.slice(0, limit);
}

/**
 * 备用新闻数据（当所有源都失败时使用）
 */
function getBackupNews() {
    return [
        {
            title: "La France célèbre la Journée nationale du patrimoine avec des événements culturels dans tout le pays",
            link: "https://www.france24.com/fr/",
            description: "Des milliers de sites historiques ouvrent leurs portes au public ce week-end pour les Journées européennes du patrimoine, permettant aux visiteurs de découvrir des trésors culturels habituellement fermés.",
            pubDate: new Date().toISOString(),
            formattedDate: formatDate(new Date()),
            source: "F24"
        },
        {
            title: "Les transports en commun parisiens renforcent leur offre pour les Jeux Olympiques 2024",
            link: "https://www.lemonde.fr/",
            description: "La RATP annonce des mesures exceptionnelles pour assurer la mobilité des millions de visiteurs attendus pendant les Jeux Olympiques de Paris.",
            pubDate: new Date(Date.now() - 3600000).toISOString(),
            formattedDate: formatDate(new Date(Date.now() - 3600000)),
            source: "Le Monde"
        },
        {
            title: "L'économie française montre des signes de reprise au troisième trimestre selon l'INSEE",
            link: "https://www.rfi.fr/fr/",
            description: "L'Institut national de la statistique publie des chiffres encourageants sur la croissance économique française, avec une hausse du PIB supérieure aux attentes.",
            pubDate: new Date(Date.now() - 7200000).toISOString(),
            formattedDate: formatDate(new Date(Date.now() - 7200000)),
            source: "RFI"
        },
        {
            title: "Un nouveau programme d'échange universitaire franco-chinois lancé pour renforcer les liens académiques",
            link: "https://www.france24.com/fr/",
            description: "Les ministères de l'Éducation des deux pays signent un accord pour faciliter la mobilité étudiante et la coopération scientifique.",
            pubDate: new Date(Date.now() - 10800000).toISOString(),
            formattedDate: formatDate(new Date(Date.now() - 10800000)),
            source: "F24"
        }
    ];
}
