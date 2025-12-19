#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导入 French-Dictionary (GitHub: hbenbel/French-Dictionary) 词典数据
将 CSV 格式转换为项目需要的 JSON 格式
"""

import json
import csv
import os
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).resolve().parents[2]
DICT_DIR = BASE_DIR / 'public' / 'data' / 'dicts'
OUTPUT_FILE = DICT_DIR / 'french_dict.json'

# 词性映射（法语 -> 中文）
POS_MAP = {
    'adjective': '形容词',
    'adverb': '副词',
    'conjunction': '连词',
    'determiner': '限定词',
    'noun': '名词',
    'preposition': '介词',
    'pronoun': '代词',
    'verb': '动词'
}

# 性别映射
GENDER_MAP = {
    'm': '阳性',
    'f': '阴性',
    'm/f': '阳性/阴性'
}

def load_csv_file(csv_path):
    """加载 CSV 文件并返回数据列表
    
    Args:
        csv_path: CSV 文件路径
        
    Returns:
        list: 包含字典的列表，每个字典代表一行数据
    """
    if not csv_path.exists():
        print(f"警告: 文件不存在 {csv_path}")
        return []
    
    data = []
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                data.append(row)
    except Exception as e:
        print(f"读取文件失败 {csv_path}: {e}")
        return []
    
    return data

def parse_noun(noun_data):
    """解析名词数据
    
    Args:
        noun_data: 名词的 CSV 行数据
        
    Returns:
        dict: 格式化的词条数据
    """
    word = noun_data.get('word', '').strip()
    if not word:
        return None
    
    gender = noun_data.get('gender', '').strip()
    pos_info = [{
        'abbr': f"n. {gender}." if gender else 'n.',
        'full': f"{GENDER_MAP.get(gender, gender)}名词" if gender else '名词'
    }]
    
    return {
        'word': word,
        'phonetic': '',
        'pos': pos_info,
        'definitions': [{
            'text': f"名词{'（' + GENDER_MAP.get(gender, gender) + '）' if gender else ''}",
            'examples': []
        }],
        'gender': gender if gender else None
    }

def parse_verb(verb_data):
    """解析动词数据
    
    Args:
        verb_data: 动词的 CSV 行数据
        
    Returns:
        dict: 格式化的词条数据
    """
    word = verb_data.get('word', '').strip()
    if not word:
        return None
    
    verb_type = verb_data.get('type', '').strip()
    pos_info = []
    
    # 根据动词类型确定词性
    if verb_type:
        type_map = {
            'transitive': '及物动词',
            'intransitive': '不及物动词',
            'reflexive': '代动词',
            'auxiliary': '助动词',
            'impersonal': '无人称动词'
        }
        pos_full = type_map.get(verb_type.lower(), verb_type)
        pos_info.append({
            'abbr': f"v. {verb_type[0] if verb_type else ''}.",
            'full': pos_full
        })
    else:
        pos_info.append({
            'abbr': 'v.',
            'full': '动词'
        })
    
    # 获取变位信息（如果有）
    conjugation = verb_data.get('conjugation', '').strip()
    
    return {
        'word': word,
        'phonetic': '',
        'pos': pos_info,
        'definitions': [{
            'text': f"动词{('（' + verb_type + '）' if verb_type else '')}",
            'examples': []
        }],
        'conjugation': conjugation if conjugation else None
    }

def parse_adjective(adj_data):
    """解析形容词数据
    
    Args:
        adj_data: 形容词的 CSV 行数据
        
    Returns:
        dict: 格式化的词条数据
    """
    word = adj_data.get('word', '').strip()
    if not word:
        return None
    
    return {
        'word': word,
        'phonetic': '',
        'pos': [{'abbr': 'a.', 'full': '形容词'}],
        'definitions': [{
            'text': '形容词',
            'examples': []
        }]
    }

def parse_adverb(adv_data):
    """解析副词数据
    
    Args:
        adv_data: 副词的 CSV 行数据
        
    Returns:
        dict: 格式化的词条数据
    """
    word = adv_data.get('word', '').strip()
    if not word:
        return None
    
    return {
        'word': word,
        'phonetic': '',
        'pos': [{'abbr': 'adv.', 'full': '副词'}],
        'definitions': [{
            'text': '副词',
            'examples': []
        }]
    }

def parse_other_pos(data, pos_name):
    """解析其他词性（连词、介词、代词、限定词）
    
    Args:
        data: CSV 行数据
        pos_name: 词性名称
        
    Returns:
        dict: 格式化的词条数据
    """
    word = data.get('word', '').strip()
    if not word:
        return None
    
    pos_map = {
        'conjunction': {'abbr': 'conj.', 'full': '连词'},
        'preposition': {'abbr': 'prép.', 'full': '介词'},
        'pronoun': {'abbr': 'pron.', 'full': '代词'},
        'determiner': {'abbr': 'det.', 'full': '限定词'}
    }
    
    pos_info = pos_map.get(pos_name, {'abbr': pos_name, 'full': pos_name})
    
    return {
        'word': word,
        'phonetic': '',
        'pos': [pos_info],
        'definitions': [{
            'text': pos_info['full'],
            'examples': []
        }]
    }

def merge_word_entries(words_dict):
    """合并同一单词的不同词性
    
    Args:
        words_dict: 以单词为键的字典，值为词条列表
        
    Returns:
        list: 合并后的词条列表
    """
    merged = []
    for word, entries in words_dict.items():
        if len(entries) == 1:
            merged.append(entries[0])
        else:
            # 合并多个词性
            main_entry = entries[0].copy()
            all_pos = []
            all_definitions = []
            
            for entry in entries:
                all_pos.extend(entry.get('pos', []))
                all_definitions.extend(entry.get('definitions', []))
            
            # 去重词性
            seen_pos = set()
            unique_pos = []
            for pos in all_pos:
                pos_key = pos.get('abbr', '')
                if pos_key not in seen_pos:
                    seen_pos.add(pos_key)
                    unique_pos.append(pos)
            
            main_entry['pos'] = unique_pos
            main_entry['definitions'] = all_definitions
            merged.append(main_entry)
    
    return merged

def main():
    """主函数：导入并转换词典数据"""
    print("=" * 60)
    print("French-Dictionary 导入工具")
    print("=" * 60)
    print()
    print("注意: French-Dictionary 使用 MIT License")
    print("请确保已包含原始许可证文件 (LICENSE-French-Dictionary)")
    print()
    
    # 检查词典目录（支持两种路径）
    dict_source_dir = BASE_DIR / 'dictionary'
    if not dict_source_dir.exists():
        # 尝试在项目根目录的父目录查找
        alt_dir = BASE_DIR.parent / 'French-Dictionary' / 'dictionary'
        if alt_dir.exists():
            dict_source_dir = alt_dir
        else:
            print(f"错误: 找不到词典源目录")
            print(f"已检查: {BASE_DIR / 'dictionary'}")
            print(f"已检查: {alt_dir}")
            print()
            print("请先下载 French-Dictionary:")
            print("1. 访问: https://github.com/hbenbel/French-Dictionary")
            print("2. 下载或克隆仓库")
            print("3. 将 dictionary 文件夹复制到项目根目录")
            print("   或者将整个 French-Dictionary 文件夹放在项目同级目录")
            print()
            print("下载方式:")
            print("  - 方式1: git clone https://github.com/hbenbel/French-Dictionary.git")
            print("  - 方式2: 访问 https://github.com/hbenbel/French-Dictionary")
            print("           点击 'Code' -> 'Download ZIP'")
            print()
            return
    
    # 确保输出目录存在
    DICT_DIR.mkdir(parents=True, exist_ok=True)
    
    # 定义要处理的文件
    files_to_process = {
        'nouns.csv': ('noun', parse_noun),
        'verbs.csv': ('verb', parse_verb),
        'adjectives.csv': ('adjective', parse_adjective),
        'adverbs.csv': ('adverb', parse_adverb),
        'conjunctions.csv': ('conjunction', lambda x: parse_other_pos(x, 'conjunction')),
        'prepositions.csv': ('preposition', lambda x: parse_other_pos(x, 'preposition')),
        'pronouns.csv': ('pronoun', lambda x: parse_other_pos(x, 'pronoun')),
        'determiners.csv': ('determiner', lambda x: parse_other_pos(x, 'determiner'))
    }
    
    words_dict = defaultdict(list)
    total_count = 0
    
    # 处理每个 CSV 文件
    for filename, (pos_name, parser_func) in files_to_process.items():
        csv_path = dict_source_dir / filename
        
        if not csv_path.exists():
            print(f"跳过: {filename} (文件不存在)")
            continue
        
        print(f"处理: {filename}...")
        data = load_csv_file(csv_path)
        
        count = 0
        for row in data:
            word_entry = parser_func(row)
            if word_entry:
                word = word_entry['word'].lower()
                words_dict[word].append(word_entry)
                count += 1
        
        print(f"  ✓ 已处理 {count} 条")
        total_count += count
    
    print()
    print(f"总计: {total_count} 条原始词条")
    
    # 合并同一单词的不同词性
    print("合并重复单词...")
    merged_words = merge_word_entries(words_dict)
    print(f"合并后: {len(merged_words)} 条唯一词条")
    
    # 按字母顺序排序
    merged_words.sort(key=lambda x: x['word'].lower())
    
    # 构建输出数据
    output_data = {
        'name': 'French Dictionary (Wiktionary)',
        'description': '基于 Wiktionary 的法语词典，包含所有词性和变位信息',
        'count': len(merged_words),
        'source': 'https://github.com/hbenbel/French-Dictionary',
        'words': merged_words
    }
    
    # 保存 JSON 文件
    print(f"\n保存到: {OUTPUT_FILE}")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"✓ 完成！共 {len(merged_words)} 条词条")
    print()
    print("=" * 60)
    print("提示: 现在可以在词典模块中使用新的词典数据了")
    print("=" * 60)

if __name__ == '__main__':
    main()
