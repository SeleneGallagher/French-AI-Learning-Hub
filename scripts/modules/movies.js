/**
 * 热门影视推荐模块 - 电影+剧集，从TMDB API获取
 */

import { showError, hideLoading, showLoading } from '../utils/helpers.js';
import { translateText } from '../services/translationService.js';
import { APIService } from '../services/apiService.js';

const MIN_RATING = 7.0;  // 降低到7.0，与服务器缓存保持一致
const STORAGE_KEY = 'movie_watchlist';
const SHOWN_KEY = 'shown_movies_session';
const CACHE_KEY = 'movies_cache';
const CACHE_DURATION = 30 * 60 * 1000;

let allMovies = [];

// 想看列表管理
function getWatchlist() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveWatchlist(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function toggleWatchlist(item) {
    const list = getWatchlist();
    const index = list.findIndex(m => m.id === item.id && m.type === item.type);
    
    if (index > -1) {
        list.splice(index, 1);
    } else {
        list.push({ ...item, addedAt: new Date().toISOString() });
    }
    
    saveWatchlist(list);
    return index === -1;
}

function isInWatchlist(id, type) {
    return getWatchlist().some(m => m.id === id && m.type === type);
}

function getShownItems() {
    try { return JSON.parse(sessionStorage.getItem(SHOWN_KEY) || '[]'); } catch { return []; }
}

function saveShownItems(ids) {
    sessionStorage.setItem(SHOWN_KEY, JSON.stringify(ids));
}

function getCache() {
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        if (cache.timestamp && Date.now() - cache.timestamp < CACHE_DURATION) {
            return cache.data;
        }
    } catch {}
    return null;
}

function saveCache(data) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
}

// TMDB API调用 - 通过后端API
async function fetchFromTMDB(endpoint) {
    // 通过后端API代理TMDB调用
    try {
        const response = await fetch(`/api/movies/tmdb${endpoint}`);
        if (response.ok) {
            const data = await response.json();
            // Flask的adapt_handler会处理json_response，直接返回数据
            // 如果返回的是包装格式（Vercel格式），需要解析body
            if (data && typeof data === 'object' && 'body' in data) {
                try {
                    return JSON.parse(data.body);
                } catch {
                    return data.body;
                }
            }
            // 直接返回数据
            return data;
        } else {
            const errorText = await response.text();
            console.warn('TMDB API调用失败:', response.status, errorText.substring(0, 100));
        }
    } catch (error) {
        console.warn('TMDB API调用失败:', error);
    }
    return null;
}

// 检查是否为法语文本
function isFrenchText(text) {
    if (!text || text.length < 20) return false;
    const frenchChars = /[àâäéèêëïîôùûüçœæ]/i;
    const frenchWords = /\b(le|la|les|un|une|des|du|de|et|est|sont|dans|pour|avec|sur|par|qui|que|ce|cette|il|elle|nous|vous|ils|elles)\b/i;
    return frenchChars.test(text) || frenchWords.test(text);
}

// 获取电影列表
async function fetchMovies(isRecent, page = 1) {
    const currentYear = new Date().getFullYear();
    const endpoint = isRecent
        ? `/discover/movie?with_original_language=fr&sort_by=popularity.desc&vote_count.gte=30&vote_average.gte=${MIN_RATING}&primary_release_date.gte=${currentYear - 2}-01-01&page=${page}`
        : `/discover/movie?with_original_language=fr&sort_by=vote_average.desc&vote_count.gte=300&vote_average.gte=${MIN_RATING}&primary_release_date.lte=${currentYear - 5}-12-31&page=${page}`;
    
    const data = await fetchFromTMDB(endpoint);
    // fetchFromTMDB返回的是TMDB API的原始响应，直接取results
    return data?.results || [];
}

// 获取剧集列表
async function fetchTVShows(isRecent, page = 1) {
    const currentYear = new Date().getFullYear();
    const endpoint = isRecent
        ? `/discover/tv?with_original_language=fr&sort_by=popularity.desc&vote_count.gte=20&vote_average.gte=${MIN_RATING}&first_air_date.gte=${currentYear - 2}-01-01&page=${page}`
        : `/discover/tv?with_original_language=fr&sort_by=vote_average.desc&vote_count.gte=100&vote_average.gte=${MIN_RATING}&first_air_date.lte=${currentYear - 5}-12-31&page=${page}`;
    
    const data = await fetchFromTMDB(endpoint);
    // fetchFromTMDB返回的是TMDB API的原始响应，直接取results
    return data?.results || [];
}

// 获取其它电影
async function fetchOtherMovies(page = 1) {
    const data = await fetchFromTMDB(`/discover/movie?with_original_language=fr&sort_by=popularity.desc&vote_count.gte=50&vote_average.gte=${MIN_RATING}&page=${page}`);
    return data?.results || [];
}

// 获取其它剧集
async function fetchOtherTV(page = 1) {
    const data = await fetchFromTMDB(`/discover/tv?with_original_language=fr&sort_by=popularity.desc&vote_count.gte=30&vote_average.gte=${MIN_RATING}&page=${page}`);
    return data?.results || [];
}

// 获取详情
async function fetchMovieDetails(id) {
    return await fetchFromTMDB(`/movie/${id}?append_to_response=credits`);
}

async function fetchTVDetails(id) {
    return await fetchFromTMDB(`/tv/${id}?append_to_response=credits`);
}

// 类型映射
const genreMap = {
    28: '动作', 12: '冒险', 16: '动画', 35: '喜剧', 80: '犯罪',
    99: '纪录片', 18: '剧情', 10751: '家庭', 14: '奇幻', 36: '历史',
    27: '恐怖', 10402: '音乐', 9648: '悬疑', 10749: '爱情', 878: '科幻',
    10770: '电视电影', 53: '惊悚', 10752: '战争', 37: '西部',
    10759: '动作冒险', 10762: '儿童', 10763: '新闻', 10764: '真人秀',
    10765: '科幻奇幻', 10766: '肥皂剧', 10767: '脱口秀', 10768: '战争政治'
};

// 处理电影
async function processMovie(movie) {
    const details = await fetchMovieDetails(movie.id);
    const plot = details?.overview || movie.overview || '';
    
    // 必须有法语简介
    if (!isFrenchText(plot)) return null;
    
    let director = '';
    if (details?.credits?.crew) {
        const d = details.credits.crew.find(c => c.job === 'Director');
        if (d) director = d.name;
    }
    
    const genres = (movie.genre_ids || []).map(id => genreMap[id]).filter(Boolean).slice(0, 3);
    
    // 简介截断：约190字符（+1/3）
    const truncatedPlot = plot.length > 150 ? plot.substring(0, 150) + '...' : plot;
    // 评语截断：约60字符
    const tagline = details?.tagline || '';
    const truncatedTagline = tagline.length > 60 ? tagline.substring(0, 60) + '...' : tagline;
    
    return {
        type: 'movie',
        id: movie.id,
        title: movie.title,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : 0,
        director,
        genres: genres.length > 0 ? genres : ['法语电影'],
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
        plot: truncatedPlot,
        fullPlot: plot,
        rating: movie.vote_average || 0,
        tagline: truncatedTagline,
        runtime: details?.runtime || 0,
        mediaInfo: details?.runtime ? `${details.runtime}分钟` : '',
        translatedPlot: ''
    };
}

// 处理剧集
async function processTVShow(show) {
    const details = await fetchTVDetails(show.id);
    const plot = details?.overview || show.overview || '';
    
    // 必须有法语简介
    if (!isFrenchText(plot)) return null;
    
    let creator = '';
    if (details?.created_by?.length > 0) {
        creator = details.created_by[0].name;
    }
    
    const genres = (show.genre_ids || []).map(id => genreMap[id]).filter(Boolean).slice(0, 3);
    const seasons = details?.number_of_seasons || 0;
    const episodes = details?.number_of_episodes || 0;
    
    // 简介截断：约190字符（+1/3）
    const truncatedPlot = plot.length > 150 ? plot.substring(0, 150) + '...' : plot;
    // 评语截断：约60字符
    const tagline = details?.tagline || '';
    const truncatedTagline = tagline.length > 60 ? tagline.substring(0, 60) + '...' : tagline;
    
    return {
        type: 'tv',
        id: show.id,
        title: show.name,
        year: show.first_air_date ? new Date(show.first_air_date).getFullYear() : 0,
        director: creator,
        genres: genres.length > 0 ? genres : ['法语剧集'],
        poster: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : '',
        plot: truncatedPlot,
        fullPlot: plot,
        rating: show.vote_average || 0,
        tagline: truncatedTagline,
        runtime: 0,
        mediaInfo: seasons > 0 ? `${seasons}季${episodes > 0 ? ' · ' + episodes + '集' : ''}` : '',
        translatedPlot: ''
    };
}

// 初始化
// 从本地JSON文件获取电影数据（服务器预更新）
async function getMoviesFromLocal() {
    try {
        const response = await fetch('/public/data/movies.json');
        if (response.ok) {
            const data = await response.json();
            if (data.movies && data.movies.length > 0) {
                console.log(`从本地文件加载 ${data.movies.length} 部影视 (更新于: ${data.updated_at})`);
                // 转换为前端需要的格式，包含完整信息
                return data.movies.map(m => {
                    const year = m.release_date ? new Date(m.release_date).getFullYear() : '';
                    const currentYear = new Date().getFullYear();
                    return {
                    id: m.id,
                    title: m.title,
                        originalTitle: m.original_title || '',
                        year: year,
                        rating: m.vote_average || 0,
                    poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
                        plot: (m.overview || '').length > 150 ? (m.overview || '').substring(0, 150) + '...' : (m.overview || ''),
                    fullPlot: m.overview || '',
                        type: m.type || m.media_type || 'movie',
                        translatedPlot: '',
                        genres: m.genres || [],
                        director: m.director || '',
                        tagline: (m.tagline || '').length > 60 ? (m.tagline || '').substring(0, 60) + '...' : (m.tagline || ''),
                        runtime: m.runtime || 0,
                        mediaInfo: m.type === 'movie' && m.runtime ? `${m.runtime}分钟` : (m.type === 'tv' && m.number_of_seasons ? `${m.number_of_seasons}季${m.number_of_episodes ? ' · ' + m.number_of_episodes + '集' : ''}` : ''),
                        isRecent: year >= currentYear - 2,
                        isClassic: year < currentYear - 5
                    };
                });
            }
        }
    } catch (error) {
        // 静默失败，不显示错误
    }
    return null;
}

export async function initMovies() {
    const loadingEl = document.getElementById('movies-loading');
    const errorEl = document.getElementById('movies-error');
    const gridEl = document.getElementById('movies-grid');

    if (!loadingEl || !errorEl || !gridEl) return;

    addControlButtons();

    try {
        showLoading(loadingEl);
        errorEl.classList.add('hidden');

        // 优先尝试从本地JSON文件读取（服务器预更新）
        const localMovies = await getMoviesFromLocal();
        if (localMovies && localMovies.length > 0) {
            // 从缓存中随机选择30部，确保近两年和经典影视超过一半
            const currentYear = new Date().getFullYear();
            const recentAndClassic = localMovies.filter(m => m.isRecent || m.isClassic);
            const others = localMovies.filter(m => !m.isRecent && !m.isClassic);
            
            // 打乱顺序
            recentAndClassic.sort(() => Math.random() - 0.5);
            others.sort(() => Math.random() - 0.5);
            
            // 确保近两年和经典影视超过一半（至少16个）
            const targetCount = 30;
            const recentTarget = 16;
            let finalList = [];
            
            if (recentAndClassic.length >= recentTarget) {
                finalList = [...recentAndClassic.slice(0, recentTarget), ...others.slice(0, targetCount - recentTarget)];
            } else {
                finalList = [...recentAndClassic, ...others.slice(0, targetCount - recentAndClassic.length)];
            }
            
            // 最终打乱
            finalList.sort(() => Math.random() - 0.5);
            allMovies = finalList.slice(0, targetCount);
            
            renderItems(allMovies);
            hideLoading(loadingEl);
            translateAllPlots();
            return;
        }

        // 如果本地文件不存在，检查localStorage缓存
        const cached = getCache();
        if (cached && cached.length > 0) {
            allMovies = cached;
            renderItems(allMovies);
            hideLoading(loadingEl);
            translateAllPlots();
            return;
        }

        // 最后尝试从API获取
        await loadContent();
        hideLoading(loadingEl);
    } catch (error) {
        hideLoading(loadingEl);
        showError(errorEl, `影视数据加载失败：${error.message}`);
    }
}

// 处理单个影视项目
function processMovieItem(m) {
    const itemType = m.media_type || 'movie';
    
    // 必须有评语，否则跳过（按旧版要求）
    if (!m.tagline || m.tagline.trim() === '') {
        return null;
    }
    
    // 处理类型信息（优先使用genres数组，其次使用genre_ids）
    let genres = [];
    if (m.genres && Array.isArray(m.genres)) {
        genres = m.genres.map(g => g.name || g).slice(0, 3);
    } else if (m.genre_ids && Array.isArray(m.genre_ids)) {
        genres = m.genre_ids.map(id => genreMap[id]).filter(Boolean).slice(0, 3);
    }
    
    // 提取导演/创作者
    let director = '';
    if (itemType === 'movie') {
        director = m.director || '';
    } else if (itemType === 'tv') {
        if (m.created_by && Array.isArray(m.created_by) && m.created_by.length > 0) {
            director = m.created_by[0].name || '';
        } else if (m.creator) {
            director = m.creator;
        }
    }
    
    // 处理评语
    let tagline = m.tagline || '';
    if (tagline && tagline.length > 60) {
        tagline = tagline.substring(0, 60) + '...';
    }
    
    // 处理简介截断
    let plot = m.overview || '';
    if (plot.length > 150) {
        plot = plot.substring(0, 150) + '...';
    }
    
    // 处理时长信息
    let mediaInfo = '';
    if (itemType === 'movie' && m.runtime) {
        mediaInfo = `${m.runtime}分钟`;
    } else if (itemType === 'tv') {
        const seasons = m.number_of_seasons || 0;
        const episodes = m.number_of_episodes || 0;
        if (seasons > 0) {
            mediaInfo = `${seasons}季`;
            if (episodes > 0) {
                mediaInfo += ` · ${episodes}集`;
            }
        }
    }
    
    const currentYear = new Date().getFullYear();
    const year = m.release_date ? new Date(m.release_date).getFullYear() : (m.first_air_date ? new Date(m.first_air_date).getFullYear() : '');
    const isRecent = year >= currentYear - 2;
    const isClassic = year < currentYear - 5;
    
    return {
                id: m.id,
                title: m.title || m.name,
        originalTitle: m.original_title || m.original_name || '',
        year: year,
                rating: m.vote_average || 0,
                poster: m.poster_path || '',
        plot: plot,
                fullPlot: m.overview || '',
        type: itemType,
        translatedPlot: '',
        genres: genres.length > 0 ? genres : (itemType === 'movie' ? ['法语电影'] : ['法语剧集']),
        director: director,
        tagline: tagline,
        runtime: m.runtime || 0,
        mediaInfo: mediaInfo,
        isRecent: isRecent,
        isClassic: isClassic
    };
}

// 从缓存API加载内容（优先使用）
async function loadFromCache(forceRefresh = false) {
    const shownIds = getShownItems();
    const targetCount = 30;
    const recentTarget = 10;
    const classicTarget = 10;
    
    try {
        // 尝试从缓存API获取数据
        const [recentData, classicData, otherData] = await Promise.all([
            APIService.getCachedMovies(1, 50, 'recent', 'mixed', MIN_RATING),
            APIService.getCachedMovies(1, 50, 'classic', 'mixed', MIN_RATING),
            APIService.getCachedMovies(1, 50, 'all', 'mixed', MIN_RATING)
        ]);
        
        if (!recentData || !recentData.success || !recentData.data) {
            return null;
        }
        
        // 合并所有数据
        const allCached = [];
        if (recentData.data.movies) allCached.push(...recentData.data.movies);
        if (classicData && classicData.success && classicData.data && classicData.data.movies) {
            allCached.push(...classicData.data.movies);
        }
        if (otherData && otherData.success && otherData.data && otherData.data.movies) {
            allCached.push(...otherData.data.movies);
        }
        
        // 去重
        const seenIds = new Set();
        const uniqueCached = [];
        for (const item of allCached) {
            const itemId = `${item.type}_${item.id}`;
            if (!seenIds.has(itemId) && !shownIds.includes(itemId)) {
                seenIds.add(itemId);
                uniqueCached.push(item);
            }
        }
        
        // 即使数据不足，也返回已有数据（至少比没有好）
        if (uniqueCached.length === 0) {
            console.log('缓存中没有可用数据');
            return null;
        }
        
        if (uniqueCached.length < targetCount) {
            console.log(`缓存数据不足 (${uniqueCached.length} < ${targetCount})，但将使用已有缓存数据`);
        }
        
        // 筛选和排序
        const currentYear = new Date().getFullYear();
        const recent = uniqueCached.filter(m => m.isRecent || (m.year && m.year >= currentYear - 2));
        const classic = uniqueCached.filter(m => m.isClassic || (m.year && m.year < currentYear - 5));
        const other = uniqueCached.filter(m => {
            if (m.isRecent || m.isClassic) return false;
            if (!m.year) return true;
            return m.year >= currentYear - 5 && m.year < currentYear - 2;
        });
        
        // 确保有足够的近两年和经典
        const selected = [];
        const selectedIds = new Set();
        
        // 优先选择近两年
        for (const item of recent) {
            if (selected.length >= targetCount) break;
            if (!selectedIds.has(`${item.type}_${item.id}`)) {
                selected.push(item);
                selectedIds.add(`${item.type}_${item.id}`);
            }
        }
        
        // 补充经典
        for (const item of classic) {
            if (selected.length >= targetCount) break;
            if (!selectedIds.has(`${item.type}_${item.id}`)) {
                selected.push(item);
                selectedIds.add(`${item.type}_${item.id}`);
            }
        }
        
        // 补充其他
        for (const item of other) {
            if (selected.length >= targetCount) break;
            if (!selectedIds.has(`${item.type}_${item.id}`)) {
                selected.push(item);
                selectedIds.add(`${item.type}_${item.id}`);
            }
        }
        
        // 如果数量不足，从所有数据中随机补充
        if (selected.length < targetCount) {
            const remaining = uniqueCached.filter(m => !selectedIds.has(`${m.type}_${m.id}`));
            remaining.sort(() => Math.random() - 0.5);
            selected.push(...remaining.slice(0, targetCount - selected.length));
        }
        
        // 打乱顺序
        selected.sort(() => Math.random() - 0.5);
        const final = selected.slice(0, targetCount);
        
        console.log('从缓存加载成功:', {
            total: final.length,
            movies: final.filter(m => m.type === 'movie').length,
            tv: final.filter(m => m.type === 'tv').length,
            recent: final.filter(m => m.isRecent || (m.year && m.year >= currentYear - 2)).length,
            classic: final.filter(m => m.isClassic || (m.year && m.year < currentYear - 5)).length
        });
        
        return final;
        
    } catch (error) {
        console.error('从缓存API加载失败:', error);
        // 抛出错误，让调用者知道缓存API失败了
        throw error;
    }
}

// 加载内容 - 参考旧版经典写法，确保至少30部
async function loadContent(forceRefresh = false) {
    const shownIds = getShownItems();
    
    console.log('开始加载影视内容，已显示数量:', shownIds.length);
    
    // 优先尝试从缓存加载
    let useCacheOnly = false;
    if (!forceRefresh) {
        try {
            const cachedData = await loadFromCache(forceRefresh);
            if (cachedData && cachedData.length >= 30) {
                // 缓存数据充足，直接使用
                allMovies = cachedData;
                saveCache(allMovies);
                saveShownItems([...shownIds, ...allMovies.map(m => `${m.type}_${m.id}`)]);
            renderItems(allMovies);
            translateAllPlots();
            return;
            } else if (cachedData && cachedData.length > 0) {
                // 缓存数据不足，先显示已有数据，然后继续获取更多并上传到缓存
                allMovies = cachedData;
                saveCache(allMovies);
                saveShownItems([...shownIds, ...allMovies.map(m => `${m.type}_${m.id}`)]);
                renderItems(allMovies);
                translateAllPlots();
                
                console.log(`缓存数据不足30条（仅${cachedData.length}条），正在获取更多数据并上传到缓存...`);
                // 继续执行下面的代码，获取更多数据
            } else {
                // 缓存为空，继续获取数据
                console.log('缓存为空，正在获取数据...');
        }
    } catch (error) {
            console.error('缓存API调用失败:', error);
            // 如果缓存API失败，尝试直接获取数据
            console.log('缓存API失败，尝试直接获取数据...');
        }
    }
    
    // 如果强制刷新或缓存不可用/不足，使用直接API调用获取数据并上传到缓存
    console.log('使用直接API调用获取数据...');
    
    // 获取各类型内容（多页获取，每类获取20页，确保有足够数据）
    const MAX_PAGES = 20; // 增加到20页
    const allRecentMovies = [];
    const allClassicMovies = [];
    const allOtherMovies = [];
    const allRecentTV = [];
    const allClassicTV = [];
    const allOtherTV = [];
    
    // 串行获取多页数据，避免API限流
    const fetchWithErrorHandling = async (fetchFn, targetArray, type) => {
        for (let page = 1; page <= MAX_PAGES; page++) {
            try {
                const data = await fetchFn(page);
                if (data && Array.isArray(data) && data.length > 0) {
                    targetArray.push(...data);
                } else {
                    // 如果某页没有数据，提前结束
                    break;
                }
                // 每页之间延迟，避免API限流（减少到150ms）
                await new Promise(r => setTimeout(r, 150));
            } catch (error) {
                console.warn(`${type} 第${page}页获取失败:`, error);
                // 继续获取下一页，不中断
            }
        }
    };
    
    // 并行获取不同类型，但每类内部串行
    await Promise.all([
        fetchWithErrorHandling((p) => fetchMovies(true, p), allRecentMovies, '近两年电影'),
        fetchWithErrorHandling((p) => fetchMovies(false, p), allClassicMovies, '经典电影'),
        fetchWithErrorHandling((p) => fetchOtherMovies(p), allOtherMovies, '其它电影'),
        fetchWithErrorHandling((p) => fetchTVShows(true, p), allRecentTV, '近两年剧集'),
        fetchWithErrorHandling((p) => fetchTVShows(false, p), allClassicTV, '经典剧集'),
        fetchWithErrorHandling((p) => fetchOtherTV(p), allOtherTV, '其它剧集')
    ]);
    
    console.log('获取到的数据:', {
        recentMovies: allRecentMovies.length,
        classicMovies: allClassicMovies.length,
        otherMovies: allOtherMovies.length,
        recentTV: allRecentTV.length,
        classicTV: allClassicTV.length,
        otherTV: allOtherTV.length
    });
    
    const filterShown = (items, type) => items.filter(i => !shownIds.includes(`${type}_${i.id}`));
    
    const processed = [];
    const currentYear = new Date().getFullYear();
    const targetCount = 30; // 目标30部
    const recentTarget = 10; // 近两年至少10部
    const classicTarget = 10; // 经典至少10部
    const MAX_PROCESS = 200; // 最多处理200个，确保有足够数据
    
    // 去重
    const seenIds = new Set();
    const uniqueItems = [];
    
    const addUnique = (items, type) => {
        for (const item of items) {
            const itemId = `${type}_${item.id}`;
            if (!seenIds.has(itemId) && !shownIds.includes(itemId)) {
                seenIds.add(itemId);
                uniqueItems.push({...item, _type: type});
            }
        }
    };
    
    addUnique(allRecentMovies, 'movie');
    addUnique(allClassicMovies, 'movie');
    addUnique(allOtherMovies, 'movie');
    addUnique(allRecentTV, 'tv');
    addUnique(allClassicTV, 'tv');
    addUnique(allOtherTV, 'tv');
    
    console.log(`去重后共有 ${uniqueItems.length} 个唯一项目，开始处理详细信息...`);
    
    // 处理近两年（至少10部，确保超过一半）
    const recentItems = uniqueItems.filter(i => {
        const year = i.release_date || i.first_air_date;
        if (!year) return false;
        const itemYear = new Date(year).getFullYear();
        return itemYear >= currentYear - 2;
    });
    
    // 批量并行处理（限制并发数为5，避免API限流）
    const processBatch = async (items, batchSize = 5) => {
        const results = [];
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(async (item) => {
                    try {
                        return item.title ? await processMovie(item) : await processTVShow(item);
                    } catch (error) {
                        console.warn('处理项目失败:', item.id, error);
                        return null;
                    }
                })
            );
            results.push(...batchResults.filter(Boolean));
            
            // 检查是否已达到目标
            const currentRecent = results.filter(p => p && p.year >= currentYear - 2).length;
            const currentClassic = results.filter(p => p && p.year < currentYear - 5).length;
            if (results.length >= targetCount && currentRecent >= recentTarget && currentClassic >= classicTarget) {
                break;
            }
            
            // 批次之间短暂延迟（减少到50ms）
            if (i + batchSize < items.length) {
                await new Promise(r => setTimeout(r, 50));
            }
        }
        return results;
    };
    
    let processedCount = 0;
    const recentProcessed = await processBatch(recentItems.slice(0, Math.min(MAX_PROCESS, recentItems.length)));
    processed.push(...recentProcessed);
    processedCount += recentProcessed.length;
    
    // 处理经典（至少10部，确保超过一半）
    const classicItems = uniqueItems.filter(i => {
        const year = i.release_date || i.first_air_date;
        if (!year) return false;
        const itemYear = new Date(year).getFullYear();
        return itemYear < currentYear - 5;
    }).filter(i => {
        // 去重：排除已处理的
        const itemId = `${i.title ? 'movie' : 'tv'}_${i.id}`;
        return !processed.find(p => `${p.type}_${p.id}` === itemId);
    });
    
    if (processed.filter(p => p.year < currentYear - 5).length < classicTarget && processed.length < targetCount) {
        const classicProcessed = await processBatch(classicItems.slice(0, Math.min(MAX_PROCESS - processedCount, classicItems.length)));
        processed.push(...classicProcessed);
        processedCount += classicProcessed.length;
    }
    
    // 其它（补充到30部）
    const otherItems = uniqueItems.filter(i => {
        const year = i.release_date || i.first_air_date;
        if (!year) return true;
        const itemYear = new Date(year).getFullYear();
        return itemYear >= currentYear - 5 && itemYear < currentYear - 2;
    }).filter(i => {
        // 去重：排除已处理的
        const itemId = `${i.title ? 'movie' : 'tv'}_${i.id}`;
        return !processed.find(p => `${p.type}_${p.id}` === itemId);
    });
    
    if (processed.length < targetCount) {
        const otherProcessed = await processBatch(otherItems.slice(0, Math.min(MAX_PROCESS - processedCount, targetCount - processed.length)));
        processed.push(...otherProcessed);
    }
    
    // 打乱顺序
    processed.sort(() => Math.random() - 0.5);
    allMovies = processed.slice(0, targetCount);
    
    console.log('最终处理结果:', {
        total: allMovies.length,
        movies: allMovies.filter(m => m.type === 'movie').length,
        tv: allMovies.filter(m => m.type === 'tv').length,
        recent: allMovies.filter(m => m.year >= currentYear - 2).length,
        classic: allMovies.filter(m => m.year < currentYear - 5).length,
        uniqueItemsCount: uniqueItems.length,
        processedCount: processed.length
    });
    
    if (allMovies.length === 0) {
        if (uniqueItems.length === 0) {
            throw new Error('未获取到影视数据，请检查网络连接或稍后重试');
        } else if (processed.length === 0) {
            throw new Error('获取到的影视数据不符合条件（需要7.0+评分且有评语）');
        } else {
            // 如果处理了一些但被过滤掉了，至少显示处理过的
    allMovies = processed;
        }
    }
    
    saveCache(allMovies);
    saveShownItems([...shownIds, ...allMovies.map(m => `${m.type}_${m.id}`)]);
    
    // 上传到缓存数据库（后台异步，不阻塞渲染）
    uploadToCache(allMovies).catch(err => {
        console.warn('上传到缓存失败:', err);
    });
    
    renderItems(allMovies);
    translateAllPlots();
}

// 上传电影数据到缓存
async function uploadToCache(movies) {
    try {
        if (!movies || movies.length === 0) return;
        
        // 准备上传数据（确保包含所有必要字段）
        const uploadData = movies.map(m => ({
            id: m.id || m.tmdb_id,
            tmdb_id: m.tmdb_id || m.id,
            type: m.type,
            title: m.title,
            originalTitle: m.originalTitle || m.original_title,
            year: m.year,
            rating: m.rating,
            voteCount: m.voteCount || m.vote_count || 0,
            poster: m.poster || m.poster_path,
            poster_path: m.poster_path || (m.poster ? m.poster.split('/').pop() : ''),
            plot: m.plot,
            fullPlot: m.fullPlot || m.plot,
            tagline: m.tagline,
            director: m.director,
            genres: m.genres || [],
            runtime: m.runtime || 0,
            seasons: m.seasons || 0,
            episodes: m.episodes || 0,
            mediaInfo: m.mediaInfo || m.media_info || ''
        }));
        
        const result = await APIService.uploadMoviesToCache(uploadData);
        if (result && result.success) {
            console.log(`✓ 成功上传 ${result.count || uploadData.length} 部电影到缓存`);
        } else {
            console.warn('上传到缓存失败:', result);
        }
    } catch (error) {
        console.warn('上传到缓存出错:', error);
    }
}

// 批量并行翻译所有简介（优化性能）
async function translateAllPlots() {
    const itemsToTranslate = allMovies.filter(item => item.fullPlot && !item.translatedPlot);
    if (itemsToTranslate.length === 0) return;
    
    // 批量翻译（每批3个，避免API限流）
    const batchSize = 3;
    for (let i = 0; i < itemsToTranslate.length; i += batchSize) {
        const batch = itemsToTranslate.slice(i, i + batchSize);
        await Promise.all(
            batch.map(async (item) => {
            try {
                item.translatedPlot = await translateText(item.fullPlot, 'fr', 'zh');
                if (item.translatedPlot.length > 160) {
                    item.translatedPlot = item.translatedPlot.substring(0, 120) + '...';
                }
                updateItemTranslation(item);
            } catch (e) {
                item.translatedPlot = '翻译暂不可用';
                    updateItemTranslation(item);
            }
            })
        );
        // 批次之间延迟（减少到100ms）
        if (i + batchSize < itemsToTranslate.length) {
            await new Promise(r => setTimeout(r, 100));
        }
    }
}

// 更新单个翻译
function updateItemTranslation(item) {
    const card = document.querySelector(`[data-item-id="${item.type}_${item.id}"]`);
    if (card && item.translatedPlot) {
        const plotContainer = card.querySelector('.plot-container');
        if (plotContainer) {
            plotContainer.dataset.translated = item.translatedPlot;
        }
    }
}

// 添加控制按钮
function addControlButtons() {
    const section = document.getElementById('movies');
    if (!section) return;
    
    // 如果已经存在控制按钮，先移除
    const existingControls = section.querySelector('.movie-controls');
    if (existingControls) {
        existingControls.remove();
    }
    
    const h2 = section.querySelector('h2');
    if (!h2) return;
    
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'movie-controls flex justify-end gap-2 mb-4';
    controlsDiv.innerHTML = `
        <button id="refresh-movies-btn" class="px-4 py-2 rounded transition-colors text-sm" style="background-color: var(--primary-700); color: white;">
            🔄 换一批
        </button>
        <button id="view-watchlist-btn" class="px-4 py-2 rounded transition-colors text-sm" style="background-color: var(--accent-600); color: white;">
            ⭐ 想看列表
        </button>
    `;
    
    h2.after(controlsDiv);
    
    // 绑定事件监听器
    const refreshBtn = document.getElementById('refresh-movies-btn');
    const watchlistBtn = document.getElementById('view-watchlist-btn');
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            console.log('换一批按钮被点击');
            await refreshContent();
        });
    }
    
    if (watchlistBtn) {
        watchlistBtn.addEventListener('click', toggleWatchlistView);
    }
}

// 刷新内容
async function refreshContent() {
    const loadingEl = document.getElementById('movies-loading');
    const gridEl = document.getElementById('movies-grid');
    const errorEl = document.getElementById('movies-error');
    
    if (loadingEl) showLoading(loadingEl);
    if (errorEl) errorEl.classList.add('hidden');
    if (gridEl) gridEl.innerHTML = '';
    
    // 清除缓存，强制重新获取
    localStorage.removeItem(CACHE_KEY);
    
    // 清除当前已显示的项目记录，这样loadContent会基于新的session状态过滤
    sessionStorage.removeItem(SHOWN_KEY);
    
    try {
        // 刷新时强制从API获取，跳过本地文件，并传递refresh参数
        await loadContent(true);
    } catch (error) {
        console.error('刷新失败:', error);
        if (errorEl) {
            errorEl.textContent = `刷新失败：${error.message}`;
            errorEl.classList.remove('hidden');
        }
    } finally {
        if (loadingEl) hideLoading(loadingEl);
    }
}

let showingWatchlist = false;

function toggleWatchlistView() {
    const btn = document.getElementById('view-watchlist-btn');
    const refreshBtn = document.getElementById('refresh-movies-btn');
    
    if (showingWatchlist) {
        showingWatchlist = false;
        if (btn) btn.innerHTML = '<span>⭐</span><span>想看</span>';
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        renderItems(allMovies);
    } else {
        showingWatchlist = true;
        if (btn) btn.innerHTML = '<span>←</span><span>返回</span>';
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        renderWatchlist();
    }
}

// 渲染想看列表
function renderWatchlist() {
    const gridEl = document.getElementById('movies-grid');
    if (!gridEl) return;
    
    const list = getWatchlist();
    
    if (list.length === 0) {
        gridEl.innerHTML = '<p class="text-gray-500 text-center py-8 col-span-full">想看列表为空，点击影视卡片上的 ☆ 添加</p>';
        return;
    }
    
    gridEl.innerHTML = '';
    list.forEach(item => renderCard(item, gridEl, true));
}

// 渲染列表
function renderItems(items) {
    const gridEl = document.getElementById('movies-grid');
    if (!gridEl) return;
    
    gridEl.innerHTML = '';

    if (items.length === 0) {
        gridEl.innerHTML = '<p class="text-gray-500 text-center py-8 col-span-full">暂无影视数据，请点击"换一批"刷新</p>';
        return;
    }

    items.forEach(item => renderCard(item, gridEl, false));
}

// 渲染单个卡片
function renderCard(item, container, isWatchlist) {
    const card = document.createElement('div');
    // 桌面端：横向布局（flex-row），移动端：纵向布局（flex-col）
    card.className = 'movie-card bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow flex flex-col md:flex-row cursor-pointer';
    card.setAttribute('data-item-id', `${item.type}_${item.id}`);
    // 桌面端固定高度200px，移动端自适应（增加高度以显示更多内容）
    card.style.minHeight = window.innerWidth < 768 ? 'auto' : '200px';
    
    const inList = isInWatchlist(item.id, item.type);
    const tmdbUrl = item.type === 'movie' 
        ? `https://www.themoviedb.org/movie/${item.id}` 
        : `https://www.themoviedb.org/tv/${item.id}`;
    
    const typeLabel = item.type === 'tv' ? '剧集' : '电影';
    const typeBadgeColor = item.type === 'tv' ? 'bg-purple-500' : 'bg-blue-500';
    
    card.innerHTML = `
        <div class="relative flex-shrink-0 w-full md:w-[140px] h-48 md:h-[200px]">
            ${item.poster 
                ? `<img src="${item.poster}" alt="${item.title}" class="w-full h-full object-cover">`
                : `<div class="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">${item.title.substring(0, 2)}</div>`
            }
            <span class="absolute top-2 left-2 px-2 py-1 ${typeBadgeColor} text-white text-xs rounded">${typeLabel}</span>
            <button class="watchlist-btn absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center hover:scale-110 transition-transform text-sm" style="${inList ? 'background-color: var(--accent-600);' : 'background-color: rgba(0, 0, 0, 0.5);'} color: white;" data-item-type="${item.type}" data-item-id="${item.id}">
                ${inList ? '⭐' : '☆'}
            </button>
        </div>
        <div class="flex-1 p-4 md:p-4 flex flex-col justify-between min-w-0 md:h-[200px]">
            <div class="flex-1 overflow-hidden">
                <div class="flex items-start justify-between mb-1">
                    <h3 class="text-base md:text-base font-bold text-gray-800 line-clamp-2 flex-1 pr-2">${item.title}</h3>
                    <span class="px-2 py-0.5 text-white text-xs rounded flex-shrink-0" style="background-color: var(--accent-600);">⭐${parseFloat(item.rating).toFixed(1)}</span>
                </div>
                ${item.originalTitle && item.originalTitle !== item.title ? `<div class="text-xs text-gray-500 mb-0.5 italic">${item.originalTitle}</div>` : ''}
                <div class="text-xs text-gray-600 mb-1">
                    ${item.year || '未知'}${item.director ? ' · ' + item.director : ''}${item.mediaInfo ? ' · ' + item.mediaInfo : ''}
                </div>
                <div class="flex flex-wrap gap-1 mb-1">
                    ${(item.genres || []).map(genre => `<span class="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">${genre}</span>`).join('')}
                </div>
                <div class="text-xs text-gray-600 mb-1 relative plot-container md:line-clamp-4 line-clamp-6" style="line-height: 1.35;" data-original="${item.plot}" data-translated="${item.translatedPlot || ''}">
                    ${item.plot}
                </div>
                ${item.tagline ? `<p class="text-xs text-gray-500 italic line-clamp-2 mb-1">"${item.tagline}"</p>` : ''}
            </div>
            <div class="flex justify-end mt-2 pt-2 border-t border-gray-100">
                <span class="text-xs text-gray-400 italic">点击卡片查看详情</span>
            </div>
        </div>
    `;
    
    // 绑定事件
    card.addEventListener('click', (e) => {
        // 如果点击的是收藏/移除按钮，不跳转
        if (e.target.closest('.watchlist-btn')) return;
        window.open(tmdbUrl, '_blank');
    });
    
    // 简介悬停翻译
    const plotContainer = card.querySelector('.plot-container');
    if (plotContainer) {
        let hoverTimer = null;
        plotContainer.addEventListener('mouseenter', () => {
            hoverTimer = setTimeout(() => {
                const translated = plotContainer.dataset.translated;
                if (translated && translated !== '') {
                    plotContainer.textContent = translated;
                    plotContainer.style.color = '#2563eb';
                }
            }, 100); // 100ms 延迟避免快速移动时闪烁
        });
        
        plotContainer.addEventListener('mouseleave', () => {
            if (hoverTimer) clearTimeout(hoverTimer);
            const original = plotContainer.dataset.original;
            plotContainer.textContent = original;
            plotContainer.style.color = '';
        });
    }
    
    const watchlistBtn = card.querySelector('.watchlist-btn');
    if (watchlistBtn) {
        watchlistBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (isWatchlist) {
                // 想看列表中：点击星星切换收藏状态，但不立即移除卡片
                // 卡片会在下次进入收藏夹时根据实际收藏状态决定是否显示
                const added = toggleWatchlist(item);
                
                // 只更新按钮状态，不移除卡片
                watchlistBtn.innerHTML = added ? '⭐' : '☆';
                watchlistBtn.style.backgroundColor = added ? 'var(--accent-600)' : 'rgba(0, 0, 0, 0.5)';
                watchlistBtn.style.color = 'white';
                watchlistBtn.className = 'watchlist-btn absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center hover:scale-110 transition-transform text-sm';
            } else {
                // 推荐列表中：直接切换收藏状态
                const added = toggleWatchlist(item);
                watchlistBtn.innerHTML = added ? '⭐' : '☆';
                watchlistBtn.style.backgroundColor = added ? 'var(--accent-600)' : 'rgba(0, 0, 0, 0.5)';
                watchlistBtn.style.color = 'white';
                watchlistBtn.className = 'watchlist-btn absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center hover:scale-110 transition-transform text-sm';
            }
        });
    }
    
    container.appendChild(card);
}
