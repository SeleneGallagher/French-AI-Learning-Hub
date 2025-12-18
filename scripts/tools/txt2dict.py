#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将《公共法语学习词典》TXT 转换为 JSON 格式
"""

import re
import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
TXT_FILE = BASE / 'public' / 'data' / 'dicts' / '公共法语学习词典.txt'
OUT_JSON = BASE / 'public' / 'data' / 'dicts' / 'gonggong.json'
INDEX_FILE = BASE / 'public' / 'data' / 'dicts' / 'index.json'

def parse_pos(text):
    """从文本中提取词性信息
    
    Args:
        text: 包含词性标记的文本
        
    Returns:
        list: 词性信息列表，每个元素包含abbr和full字段
    """
    pos_map = {
        'n. m.': '阳性名词',
        'n. f.': '阴性名词',
        'n.': '名词',
        'a.': '形容词',
        'adv.': '副词',
        'v. t.': '及物动词',
        'v. i.': '不及物动词',
        'v. pr.': '代动词',
        'v. t. ind.': '间接及物动词',
        'v. t. dir.': '直接及物动词',
        'v. aux.': '助动词',
        'v. impers.': '无人称动词',
        'prép.': '介词',
        'conj.': '连词',
        'interj.': '感叹词',
        'pron.': '代词',
        'loc. adv.': '副词短语',
        'loc. conj.': '连词短语',
        'loc. prép.': '介词短语',
        'loc. verb.': '动词短语',
    }
    
    found = []
    for abbr, full in sorted(pos_map.items(), key=lambda x: -len(x[0])):
        if abbr in text:
            found.append({'abbr': abbr, 'full': full})
            break
    return found

def parse_examples(text):
    """从文本中提取例句（使用◇标记分割）
    
    Args:
        text: 包含例句的文本
        
    Returns:
        list: 例句列表，每个例句包含fr（法语）和zh（中文）字段
    """
    examples = []
    # 使用 ◇ 分割例句
    parts = re.split(r'◇', text)
    for part in parts[1:]:  # 跳过第一个（定义部分）
        part = part.strip()
        if not part:
            continue
        # 尝试分离法语和中文
        # 通常格式是: 法语句子。中文翻译。
        match = re.match(r'(.+?[.!?])(.+)', part, re.DOTALL)
        if match:
            fr = match.group(1).strip()
            zh = match.group(2).strip()
            examples.append({'fr': fr, 'zh': zh})
        else:
            examples.append({'fr': part, 'zh': ''})
    return examples

def parse_definition(text):
    """解析词条定义文本（移除例句部分）
    
    Args:
        text: 包含定义和例句的文本
        
    Returns:
        str: 清理后的定义文本
    """
    # 移除例句标记，只保留定义
    text = re.split(r'◇', text)[0].strip()
    return text

def clean_text(text):
    """清理文本中的页面标记和多余空白
    
    Args:
        text: 原始文本
        
    Returns:
        str: 清理后的文本
    """
    # 移除页面标记
    text = re.sub(r'<\d+>', '', text)
    # 移除多余空白
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def main():
    """主函数：解析TXT词典文件并转换为JSON格式"""
    if not TXT_FILE.exists():
        print(f'错误: 找不到源文件: {TXT_FILE}')
        print('提示: 此脚本用于将《公共法语学习词典》TXT文件转换为JSON格式')
        print('      如果TXT文件已删除，可以直接使用已生成的 gonggong.json')
        return
    
    print(f'读取文件: {TXT_FILE}')
    content = TXT_FILE.read_text(encoding='utf-8')
    
    # 移除开头的说明部分（到第一个 >A 之前）
    start_match = re.search(r'>A\s*\n', content)
    if start_match:
        content = content[start_match.start():]
    
    # 分割词条
    entries = re.split(r'\n>', content)
    
    words = []
    current_letter = ''
    
    for entry in entries:
        entry = entry.strip()
        if not entry:
            continue
        
        # 跳过单独的字母标题（如 >A, >B）
        if re.match(r'^[A-Z]\s*$', entry):
            current_letter = entry.strip()
            continue
        
        # 跳过页面标记和无关内容
        if entry.startswith('公共法语学习词典') or entry.startswith('Dictionnaire'):
            continue
        
        # 提取词头
        lines = entry.split('\n')
        first_line = lines[0].strip()
        
        # 提取单词和词性
        # 格式通常是: word  pos
        # 匹配法语单词（包含重音字符）
        word_pattern = r"^([a-zA-ZàâäéèêëïîôùûüçœæÀÂÄÉÈÊËÏÎÔÙÛÜÇŒÆ][a-zA-ZàâäéèêëïîôùûüçœæÀÂÄÉÈÊËÏÎÔÙÛÜÇŒÆ'\-\s]*?)(?:\s{2,}|\t|$)"
        match = re.match(word_pattern, first_line)
        
        if not match:
            # 尝试其他格式
            match = re.match(r"^([a-zA-ZàâäéèêëïîôùûüçœæÀÂÄÉÈÊËÏÎÔÙÛÜÇŒÆ']+)", first_line)
            if match:
                word = match.group(1).strip()
                rest = first_line[len(word):].strip()
            else:
                continue
        else:
            word = match.group(1).strip()
            rest = first_line[len(word):].strip()
        
        # 清理词头
        word = re.sub(r'\s+', ' ', word).strip()
        if not word or len(word) < 1:
            continue
        
        # 跳过非词条内容
        if word.isdigit() or word in ['公共法语学习词典', 'Dictionnaire', 'pour', 'débutants']:
            continue
        
        # 组合全部内容
        full_text = clean_text('\n'.join(lines))
        
        # 提取词性
        pos_info = parse_pos(full_text)
        
        # 提取音标（如果有）
        phonetic = ''
        phonetic_match = re.search(r'\[([^\]]+)\]', full_text)
        if phonetic_match:
            phonetic = phonetic_match.group(1)
        
        # 提取过去分词（如果有）
        pp = ''
        pp_match = re.search(r'\(p\.\s*p\.\s*([^)]+)\)', full_text)
        if pp_match:
            pp = pp_match.group(1).strip()
        
        # 解析定义和例句
        # 定义通常在词性之后，例句之前
        definitions = []
        
        # 按数字编号分割多个义项
        meaning_parts = re.split(r'(?:^|\n)\s*(\d+)\s+', full_text)
        
        if len(meaning_parts) > 2:
            # 有多个义项
            for i in range(1, len(meaning_parts), 2):
                if i + 1 < len(meaning_parts):
                    num = meaning_parts[i]
                    content = meaning_parts[i + 1]
                    
                    # 提取定义
                    def_text = parse_definition(content)
                    examples = parse_examples(content)
                    
                    definitions.append({
                        'text': def_text,
                        'examples': examples
                    })
        else:
            # 单一义项
            def_text = parse_definition(full_text)
            examples = parse_examples(full_text)
            
            # 移除词头和词性部分
            def_text = re.sub(r"^[a-zA-ZàâäéèêëïîôùûüçœæÀÂÄÉÈÊËÏÎÔÙÛÜÇŒÆ',\s\-]+\s*(n\.\s*[mf]\.?|a\.|adv\.|v\.\s*[tip]\.?[a-z.]*|prép\.|conj\.|interj\.|pron\.)", '', def_text, flags=re.IGNORECASE)
            def_text = def_text.strip()
            
            if def_text or examples:
                definitions.append({
                    'text': def_text,
                    'examples': examples
                })
        
        # 构建词条
        entry_data = {
            'word': word,
            'phonetic': phonetic,
            'pos': pos_info,
            'definitions': definitions,
        }
        
        if pp:
            entry_data['past_participle'] = pp
        
        words.append(entry_data)
    
    print(f'解析完成，共 {len(words):,} 条词条')
    
    # 去重并排序
    seen = set()
    unique_words = []
    for w in words:
        key = w['word'].lower()
        if key not in seen:
            seen.add(key)
            unique_words.append(w)
    
    unique_words.sort(key=lambda x: x['word'].lower())
    
    print(f'去重后共 {len(unique_words):,} 条词条')
    
    # 保存 JSON
    output = {
        'name': '公共法语学习词典',
        'description': '专供非法语专业学生、法语专业一二年级及法语爱好者使用的学习词典，共收录词目5850条',
        'count': len(unique_words),
        'words': unique_words
    }
    
    OUT_JSON.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'已保存到: {OUT_JSON}')
    
    # 更新 index.json
    info = {
        'id': 'gonggong',
        'name': '公共法语学习词典',
        'level': 'A1-B2',
        'count': len(unique_words),
        'description': '专供法语学习者使用，收录5850词'
    }
    
    try:
        index_data = json.loads(INDEX_FILE.read_text(encoding='utf-8'))
    except Exception:
        index_data = []
    
    index_data = [d for d in index_data if d.get('id') != 'gonggong']
    index_data.append(info)
    INDEX_FILE.write_text(json.dumps(index_data, ensure_ascii=False, indent=2), encoding='utf-8')
    print('已更新 index.json')

if __name__ == '__main__':
    main()

