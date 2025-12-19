#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导入 French-Dictionary (GitHub: hbenbel/French-Dictionary) 词典数据
将 CSV 格式转换为项目需要的 JSON 格式
基于实际的CSV结构：form 和 tags 列
"""

import json
import csv
import ast
import os
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).resolve().parents[2]
DICT_DIR = BASE_DIR / 'public' / 'data' / 'dicts'
OUTPUT_FILE = DICT_DIR / 'french_dict.json'

# 词性映射
POS_MAP = {
    'noun': {'abbr': 'n.', 'full': '名词'},
    'verb': {'abbr': 'v.', 'full': '动词'},
    'adj': {'abbr': 'a.', 'full': '形容词'},
    'adv': {'abbr': 'adv.', 'full': '副词'},
    'conj': {'abbr': 'conj.', 'full': '连词'},
    'prep': {'abbr': 'prép.', 'full': '介词'},
    'pron': {'abbr': 'pron.', 'full': '代词'},
    'det': {'abbr': 'det.', 'full': '限定词'}
}

# 性别映射（从tags中提取）
GENDER_TAGS = {'masculine': 'm', 'feminine': 'f'}

# 动词类型映射（从tags中提取）
VERB_TYPE_TAGS = {
    'transitive': '及物动词',
    'intransitive': '不及物动词',
    'reflexive': '代动词',
    'auxiliary': '助动词',
    'impersonal': '无人称动词'
}

def parse_tags(tags_str):
    """解析tags字符串，返回标签列表
    
    Args:
        tags_str: tags字符串，如 "['plural']" 或 "['present', 'reflexive']"
        
    Returns:
        list: 标签列表
    """
    if not tags_str or tags_str.strip() == '':
        return []
    
    try:
        # 尝试解析为Python列表
        tags = ast.literal_eval(tags_str)
        if isinstance(tags, list):
            return [str(tag).lower() for tag in tags]
        return []
    except:
        # 如果解析失败，尝试简单分割
        tags_str = tags_str.strip()
        if tags_str.startswith('[') and tags_str.endswith(']'):
            tags_str = tags_str[1:-1]
            return [tag.strip().strip("'\"") for tag in tags_str.split(',') if tag.strip()]
        return []

def extract_gender_from_tags(tags):
    """从tags中提取性别信息"""
    for tag in tags:
        if tag in GENDER_TAGS:
            return GENDER_TAGS[tag]
        if tag == 'masculine' or tag == 'feminine':
            return tag[0]  # 'm' or 'f'
    return None

def extract_verb_type_from_tags(tags):
    """从tags中提取动词类型"""
    for tag in tags:
        if tag in VERB_TYPE_TAGS:
            return tag
    # 检查reflexive标签
    if 'reflexive' in tags:
        return 'reflexive'
    return None

def is_base_form(tags):
    """判断是否是词的原形（非变位、非复数等）"""
    if not tags:
        return True
    # 排除变位、复数等标签
    excluded_tags = ['plural', 'singular', 'present', 'past', 'future', 
                     'imperfect', 'conditional', 'subjunctive', 'imperative',
                     'first-person', 'second-person', 'third-person',
                     'reflexive', 'participle', 'infinitive']
    return not any(tag in excluded_tags for tag in tags)

def load_csv_file(csv_path):
    """加载 CSV 文件并返回数据列表"""
    if not csv_path.exists():
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

def process_pos_file(csv_path, pos_name):
    """处理特定词性的CSV文件
    
    Args:
        csv_path: CSV文件路径
        pos_name: 词性名称（noun, verb, adj等）
        
    Returns:
        dict: {word: entry} 字典
    """
    data = load_csv_file(csv_path)
    if not data:
        return {}
    
    words_dict = {}
    pos_info = POS_MAP.get(pos_name, {'abbr': pos_name, 'full': pos_name})
    
    for row in data:
        form = row.get('form', '').strip()
        tags_str = row.get('tags', '').strip()
        
        if not form:
            continue
        
        tags = parse_tags(tags_str)
        
        # 确定是否是原形词（优先选择没有变位标签的词）
        is_base = is_base_form(tags)
        
        # 如果这个词已经存在，检查是否需要更新
        if form.lower() in words_dict:
            existing = words_dict[form.lower()]
            # 如果当前是原形，优先使用
            if is_base and not is_base_form(parse_tags(existing.get('raw_tags', ''))):
                # 更新为原形
                words_dict[form.lower()] = create_word_entry(form, pos_name, pos_info, tags, tags_str)
        else:
            # 创建新词条
            words_dict[form.lower()] = create_word_entry(form, pos_name, pos_info, tags, tags_str)
    
    return words_dict

def create_word_entry(form, pos_name, pos_info, tags, tags_str):
    """创建词条数据
    
    Args:
        form: 单词形式
        pos_name: 词性名称
        pos_info: 词性信息字典
        tags: 解析后的标签列表
        tags_str: 原始tags字符串
        
    Returns:
        dict: 词条数据
    """
    entry = {
        'word': form,
        'phonetic': '',
        'pos': [{
            'abbr': pos_info['abbr'],
            'full': pos_info['full'],
            'original': pos_name
        }],
        'definitions': [{
            'text': pos_info['full'],
            'examples': []
        }],
        'raw_tags': tags_str,
        'tags': tags
    }
    
    # 根据词性添加特定信息
    if pos_name == 'noun':
        gender = extract_gender_from_tags(tags)
        if gender:
            entry['gender'] = gender
            entry['pos'][0]['abbr'] = f"n. {gender}."
            entry['pos'][0]['full'] = f"{'阳性' if gender == 'm' else '阴性'}名词"
            entry['definitions'][0]['text'] = f"名词（{'阳性' if gender == 'm' else '阴性'}）"
    
    elif pos_name == 'verb':
        verb_type = extract_verb_type_from_tags(tags)
        if verb_type:
            entry['verb_type'] = verb_type
            type_full = VERB_TYPE_TAGS.get(verb_type, verb_type)
            entry['pos'][0]['full'] = type_full
            entry['definitions'][0]['text'] = f"动词（{type_full}）"
        
        # 检查是否有变位信息（从tags中）
        conjugation_tags = [t for t in tags if t in ['present', 'past', 'future', 'imperfect', 
                                                      'conditional', 'subjunctive', 'imperative',
                                                      'infinitive', 'participle']]
        if conjugation_tags:
            entry['conjugation_info'] = conjugation_tags
    
    return entry

def merge_word_entries(all_words_dict):
    """合并同一单词的不同词性
    
    Args:
        all_words_dict: 所有词性的词条字典
        
    Returns:
        list: 合并后的词条列表
    """
    # 按单词合并
    merged_dict = {}
    
    for pos_words in all_words_dict.values():
        for word, entry in pos_words.items():
            if word not in merged_dict:
                merged_dict[word] = entry.copy()
            else:
                # 合并词性
                existing = merged_dict[word]
                # 合并pos
                existing_pos_abbrs = {p['abbr'] for p in existing['pos']}
                for pos in entry['pos']:
                    if pos['abbr'] not in existing_pos_abbrs:
                        existing['pos'].append(pos)
                        existing['definitions'].append(entry['definitions'][0])
                
                # 合并特殊字段
                if 'gender' in entry and entry['gender']:
                    existing['gender'] = entry['gender']
                if 'verb_type' in entry and entry['verb_type']:
                    existing['verb_type'] = entry['verb_type']
                if 'conjugation_info' in entry:
                    if 'conjugation_info' not in existing:
                        existing['conjugation_info'] = []
                    existing['conjugation_info'].extend(entry['conjugation_info'])
    
    return list(merged_dict.values())

def main():
    """主函数：导入并转换词典数据"""
    print("=" * 60)
    print("French-Dictionary Import Tool")
    print("=" * 60)
    print()
    print("Note: French-Dictionary uses MIT License")
    print("Please ensure LICENSE-French-Dictionary file is included")
    print()
    
    # 检查词典目录
    dict_source_dir = BASE_DIR / 'dictionary'
    if not dict_source_dir.exists():
        alt_dir = BASE_DIR.parent / 'French-Dictionary' / 'dictionary'
        if alt_dir.exists():
            dict_source_dir = alt_dir
        else:
            print(f"Error: Dictionary source directory not found")
            print(f"Checked: {BASE_DIR / 'dictionary'}")
            print(f"Checked: {alt_dir}")
            print()
            print("Please download French-Dictionary first:")
            print("  git clone https://github.com/hbenbel/French-Dictionary.git")
            print()
            return
    
    # 确保输出目录存在
    DICT_DIR.mkdir(parents=True, exist_ok=True)
    
    # 定义要处理的文件（使用实际文件名）
    files_to_process = {
        'noun.csv': 'noun',
        'verb.csv': 'verb',
        'adj.csv': 'adj',
        'adv.csv': 'adv',
        'conj.csv': 'conj',
        'prep.csv': 'prep',
        'pron.csv': 'pron',
        'det.csv': 'det'
    }
    
    all_words_dict = {}
    total_count = 0
    
    # 处理每个 CSV 文件
    for filename, pos_name in files_to_process.items():
        csv_path = dict_source_dir / filename
        
        if not csv_path.exists():
            print(f"Skipping: {filename} (file not found)")
            continue
        
        print(f"Processing: {filename}...")
        words_dict = process_pos_file(csv_path, pos_name)
        all_words_dict[pos_name] = words_dict
        count = len(words_dict)
        total_count += count
        print(f"  Processed {count} entries")
    
    print()
    print(f"Total: {total_count} entries from all files")
    
    # 合并同一单词的不同词性
    print("Merging duplicate words...")
    merged_words = merge_word_entries(all_words_dict)
    print(f"Merged: {len(merged_words)} unique words")
    
    # 按字母顺序排序
    merged_words.sort(key=lambda x: x['word'].lower())
    
    # 构建输出数据
    output_data = {
        'name': 'French Dictionary (Wiktionary)',
        'description': 'Complete French dictionary based on Wiktionary, includes all parts of speech, gender, conjugation info',
        'count': len(merged_words),
        'source': 'https://github.com/hbenbel/French-Dictionary',
        'license': 'MIT License',
        'copyright': 'Copyright (c) 2021 Hussem Ben Belgacem',
        'words': merged_words
    }
    
    # 保存 JSON 文件
    print(f"\nSaving to: {OUTPUT_FILE}")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"Done! Total {len(merged_words)} words")
    print()
    print("=" * 60)
    print("Tip: You can now use the new dictionary data in the dictionary module")
    print("All original information (POS, gender, conjugation, etc.) has been preserved")
    print("=" * 60)

if __name__ == '__main__':
    main()
